import Matter from 'matter-js';
import confetti from 'canvas-confetti';
import { getTier, randomSpawnTier } from './orbs';
import { Renderer, type Particle, type FloatText, type OrbVisual } from './renderer';
import { tap, pop } from '../lib/haptics';
import { sfxMerge, sfxDrop, sfxDeath, sfxStart, resumeCtx } from '../lib/sfx';

export type GamePhase = 'ready' | 'playing' | 'over';

export interface GameState {
  score: number;
  best: number;
  phase: GamePhase;
  currentTier: number;
  nextTier: number;
}

interface OrbBody extends Matter.Body {
  orbTier: number;
  orbId: number;
  landedAt: number | null;
  squashUntil: number;
}

const WALL_W = 24;           // logical px — thickness of static walls
const DANGER_Y_FRAC = 0.15;  // danger line = 15% from top of container
const DANGER_GRACE = 1500;   // ms before game-over triggers
const DROP_COOLDOWN = 400;   // ms between drops
const COMBO_WINDOW = 1200;   // ms for combo chain

// Confetti colors per high tier (tiers 9-11)
const HIGH_TIER_CONFETTI: Record<number, string[]> = {
  9:  ['#ff6ec4', '#ffd84d', '#ffffff'],
  10: ['#ff5e62', '#ff9a44', '#ffffff'],
  11: ['#ffd84d', '#ffb030', '#ff6eb4', '#ffffff'],
};

export class GameEngine {
  private engine: Matter.Engine;
  private runner: Matter.Runner;
  private renderer: Renderer;

  // Container bounds in logical CSS px
  private contLeft = 0;
  private contRight = 0;
  private contTop = 0;
  private contBottom = 0;

  // Walls/floor bodies (recreated on resize)
  private walls: Matter.Body[] = [];

  // Active orb bodies map id → OrbBody
  private orbBodies = new Map<number, OrbBody>();
  private nextOrbId = 1;

  // Game state
  private score = 0;
  private best = 0;
  private phase: GamePhase = 'ready';
  private currentTier: number;
  private nextTier: number;

  // Input state
  private aimX: number | null = null;
  private lastDropTime = 0;

  // Danger line
  private dangerStartTime: number | null = null;

  // Combo
  private comboCount = 0;
  private lastMergeTime = 0;

  // Particles + float texts
  private particles: Particle[] = [];
  private floatTexts: FloatText[] = [];

  // Pop-in anim queue: id → { startTime, duration }
  private popAnims = new Map<number, { startTime: number; duration: number }>();

  // Confetti tiers already celebrated
  private celebrated = new Set<number>();

  // Hitstop — deadline in real ms (Date.now)
  private hitstopUntil = 0;

  // Animation loop
  private rafId = 0;
  private lastFrameTime = 0;

  // State-change callback (React re-render trigger)
  private onStateChange: ((s: GameState) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, best: number) {
    this.renderer = new Renderer(canvas);
    this.best = best;
    this.currentTier = randomSpawnTier();
    this.nextTier = randomSpawnTier();

    this.engine = Matter.Engine.create({ gravity: { y: 1.8 } });
    this.runner = Matter.Runner.create();

    this.setupCollisionHandler();
    this.setupDebugAPI();
    this.startRenderLoop();
  }

  // ——— Public API ———

  setOnStateChange(cb: (s: GameState) => void): void { this.onStateChange = cb; }
  /** @deprecated — sound is now controlled via sfx.ts mute flag */
  setSoundEnabled(_v: boolean): void { /* no-op — use setMuted() from sfx.ts */ }

  /** Transitions 'ready' → 'playing', starts physics, plays sfxStart. */
  start(): void {
    if (this.phase !== 'ready') return;
    resumeCtx();
    sfxStart();
    this.phase = 'playing';
    Matter.Runner.run(this.runner, this.engine);
    this.emitState();
  }

  getState(): GameState {
    return {
      score: this.score,
      best: this.best,
      phase: this.phase,
      currentTier: this.currentTier,
      nextTier: this.nextTier,
    };
  }

  resize(cssW: number, cssH: number): void {
    this.renderer.resize(cssW, cssH);

    const pad = WALL_W;
    this.contLeft = pad;
    this.contRight = cssW - pad;
    this.contTop = 0;
    this.contBottom = cssH;

    this.rebuildWalls(cssW, cssH);
  }

  setAimX(cssX: number): void {
    const r = getTier(this.currentTier).radius;
    this.aimX = Math.max(this.contLeft + r, Math.min(this.contRight - r, cssX));
  }

  clearAim(): void { this.aimX = null; }

  drop(cssX: number): void {
    if (this.phase !== 'playing') return;
    const now = Date.now();
    if (now - this.lastDropTime < DROP_COOLDOWN) return;
    this.lastDropTime = now;

    const tier = this.currentTier;
    const tierData = getTier(tier);
    const r = tierData.radius;
    const clampedX = Math.max(this.contLeft + r, Math.min(this.contRight - r, cssX));
    const spawnY = this.contTop + r + 4;

    this.spawnOrb(tier, clampedX, spawnY);
    sfxDrop();

    this.currentTier = this.nextTier;
    this.nextTier = randomSpawnTier();
    this.aimX = null;
    this.emitState();
  }

  restart(): void {
    // Remove all orb bodies
    const bodies = [...this.orbBodies.values()];
    Matter.World.remove(this.engine.world, bodies);
    this.orbBodies.clear();

    // Restart runner if stopped
    if (!this.runner.enabled) {
      Matter.Runner.run(this.runner, this.engine);
    }

    // Reset state — goes straight to 'playing' (not 'ready')
    this.score = 0;
    this.phase = 'playing';
    this.currentTier = randomSpawnTier();
    this.nextTier = randomSpawnTier();
    this.aimX = null;
    this.lastDropTime = 0;
    this.dangerStartTime = null;
    this.comboCount = 0;
    this.lastMergeTime = 0;
    this.particles = [];
    this.floatTexts = [];
    this.popAnims.clear();
    this.celebrated.clear();
    this.hitstopUntil = 0;

    this.emitState();
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    Matter.Runner.stop(this.runner);
    Matter.Engine.clear(this.engine);
    // Clean up debug API
    delete (window as unknown as Record<string, unknown>)['__mergeDrop'];
  }

  // ——— Private: setup ———

  private rebuildWalls(cssW: number, cssH: number): void {
    if (this.walls.length) Matter.World.remove(this.engine.world, this.walls);

    const opts = { isStatic: true, restitution: 0.1, friction: 0.3 };
    const halfW = WALL_W / 2;
    const leftWall  = Matter.Bodies.rectangle(halfW,           cssH / 2, WALL_W, cssH * 2, opts);
    const rightWall = Matter.Bodies.rectangle(cssW - halfW,    cssH / 2, WALL_W, cssH * 2, opts);
    const floor     = Matter.Bodies.rectangle(cssW / 2,        cssH + halfW, cssW * 2, WALL_W, opts);

    this.walls = [leftWall, rightWall, floor];
    Matter.World.add(this.engine.world, this.walls);
  }

  private spawnOrb(tier: number, x: number, y: number): OrbBody {
    const tierData = getTier(tier);
    const r = tierData.radius;
    const id = this.nextOrbId++;

    const body = Matter.Bodies.circle(x, y, r, {
      restitution: 0.1,
      friction: 0.5,
      frictionAir: 0.008,
      density: 0.004 * tier,   // heavier tiers sink faster
    }) as OrbBody;

    body.orbTier = tier;
    body.orbId = id;
    body.landedAt = null;
    body.squashUntil = 0;

    Matter.World.add(this.engine.world, body);
    this.orbBodies.set(id, body);

    // Pop-in animation
    this.popAnims.set(id, { startTime: Date.now(), duration: 220 });

    return body;
  }

  private setupCollisionHandler(): void {
    Matter.Events.on(this.engine, 'collisionStart', (evt) => {
      const now = Date.now();
      const processed = new Set<number>();

      for (const pair of evt.pairs) {
        const a = pair.bodyA as OrbBody;
        const b = pair.bodyB as OrbBody;

        if (!a.orbId || !b.orbId) {
          // One of them is a wall/floor — squash on land
          if (a.orbId || b.orbId) {
            const orb = (a.orbId ? a : b);
            if (!orb.landedAt) {
              orb.landedAt = now;
              orb.squashUntil = now + 120;
            }
          }
          continue;
        }

        if (processed.has(a.orbId) || processed.has(b.orbId)) continue;
        if (a.orbTier !== b.orbTier) continue;

        const tier = a.orbTier;
        if (tier >= 11) continue;  // max tier — no merge

        processed.add(a.orbId);
        processed.add(b.orbId);

        const mx = (a.position.x + b.position.x) / 2;
        const my = (a.position.y + b.position.y) / 2;

        // Remove both bodies
        Matter.World.remove(this.engine.world, [a, b]);
        this.orbBodies.delete(a.orbId);
        this.orbBodies.delete(b.orbId);

        const newTier = tier + 1;
        this.spawnOrb(newTier, mx, my);

        // Score + combo
        const comboExpired = (now - this.lastMergeTime) > COMBO_WINDOW;
        if (comboExpired) this.comboCount = 0;
        this.comboCount++;
        this.lastMergeTime = now;

        const baseScore = getTier(newTier).score;
        const combo = this.comboCount > 1 ? this.comboCount : 1;
        const earned = baseScore * combo;
        this.score += earned;
        if (this.score > this.best) this.best = this.score;

        // Hitstop on tier >= 7
        if (newTier >= 7) {
          this.hitstopUntil = Date.now() + 50;
        }

        // Particles
        this.spawnParticles(mx, my, getTier(newTier).color, 14);

        // Float text
        const label = combo > 1 ? `+${earned} x${combo}` : `+${earned}`;
        this.floatTexts.push({
          x: mx, y: my - getTier(newTier).radius - 8,
          text: label,
          color: getTier(newTier).colorLight,
          vy: -1.4,
          life: 1,
        });

        // Haptics + audio
        tap();
        sfxMerge(newTier, this.comboCount);

        // Confetti for tiers 9-11 (first time each)
        if (newTier >= 9 && !this.celebrated.has(newTier)) {
          this.celebrated.add(newTier);
          const colors = HIGH_TIER_CONFETTI[newTier] ?? ['#ffd84d'];
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors, scalar: 0.9 });
        }

        this.emitState();
      }
    });
  }

  private setupDebugAPI(): void {
    (window as unknown as Record<string, unknown>)['__mergeDrop'] = {
      score: () => this.score,
      forceGameOver: () => this.triggerGameOver(),
      dropAt: (xFrac: number) => {
        const x = this.contLeft + xFrac * (this.contRight - this.contLeft);
        this.drop(x);
      },
    };
  }

  // ——— Private: game loop ———

  /** Start the rAF render loop only (physics runner starts on start()). */
  private startRenderLoop(): void {
    const loop = (time: number) => {
      const rawDt = Math.min(time - this.lastFrameTime, 50);
      this.lastFrameTime = time;

      // Hitstop: slow physics dt to 5% when active
      const scale = Date.now() < this.hitstopUntil ? 0.05 : 1;
      const dt = rawDt * scale;

      this.tick(dt, Date.now());
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame((t) => {
      this.lastFrameTime = t;
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private tick(dt: number, now: number): void {
    if (this.phase === 'over' || this.phase === 'ready') {
      this.renderFrame(now);
      return;
    }

    this.updateParticles(dt);
    this.updateFloatTexts(dt);
    this.checkDangerLine(now);
    this.renderFrame(now);
  }

  private checkDangerLine(now: number): void {
    const dangerY = this.contTop + (this.contBottom - this.contTop) * DANGER_Y_FRAC;
    let anyAbove = false;

    for (const body of this.orbBodies.values()) {
      const topOfOrb = body.position.y - getTier(body.orbTier).radius;
      // "resting above" = orb top is above danger line AND body is mostly still
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (topOfOrb < dangerY && speed < 0.5) {
        anyAbove = true;
        break;
      }
    }

    if (anyAbove) {
      if (this.dangerStartTime === null) this.dangerStartTime = now;
      else if (now - this.dangerStartTime > DANGER_GRACE) {
        this.triggerGameOver();
      }
    } else {
      this.dangerStartTime = null;
    }
  }

  private triggerGameOver(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    Matter.Runner.stop(this.runner);
    pop();
    sfxDeath();
    this.emitState();
  }

  private renderFrame(now: number): void {
    this.renderer.clear();

    const dangerY = this.contTop + (this.contBottom - this.contTop) * DANGER_Y_FRAC;
    const dangerPulse = this.dangerStartTime !== null && ((now - this.dangerStartTime) % 600) < 300;

    // Container walls (cosmetic)
    this.renderer.drawContainer(
      this.contLeft, this.contRight,
      this.contTop, this.contBottom,
      WALL_W,
    );

    // Danger line
    this.renderer.drawDangerLine(dangerY, this.contLeft, this.contRight, dangerPulse);

    // Ghost + drop line
    if (this.aimX !== null && this.phase === 'playing') {
      const r = getTier(this.currentTier).radius;
      const ghostY = this.contTop + r + 4;
      this.renderer.drawDropLine(this.aimX, ghostY + r, this.contBottom);
      this.renderer.drawGhostOrb(this.aimX, ghostY, r, this.currentTier);
    }

    // Orbs
    const orbVisuals: OrbVisual[] = [];
    for (const body of this.orbBodies.values()) {
      const anim = this.popAnims.get(body.orbId);
      let scale = 1;
      if (anim) {
        const t = Math.max(0, Math.min(1, (now - anim.startTime) / anim.duration));
        if (t >= 1) {
          this.popAnims.delete(body.orbId);
        } else {
          // Overshoot spring: scale 0 → 1.18 → 1
          scale = t < 0.6
            ? (t / 0.6) * 1.18
            : 1.18 - (((t - 0.6) / 0.4) * 0.18);
        }
      }
      // Squash on land
      if (body.squashUntil > now) {
        const t = 1 - (body.squashUntil - now) / 120;
        scale *= 1 - Math.sin(t * Math.PI) * 0.12;
      }

      orbVisuals.push({
        id: body.orbId,
        x: body.position.x,
        y: body.position.y,
        r: getTier(body.orbTier).radius,
        tier: body.orbTier,
        scaleAnim: scale,
        angle: body.angle,
      });
    }

    // Sort back-to-front by tier (larger orbs behind smaller)
    orbVisuals.sort((a, b) => b.tier - a.tier);
    for (const ov of orbVisuals) this.renderer.drawOrb(ov);

    // Particles + float texts
    this.renderer.drawParticles(this.particles);
    this.renderer.drawFloatTexts(this.floatTexts);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 3,
        color,
        life: 1,
      });
    }
  }

  private updateParticles(dt: number): void {
    const decay = dt * 0.002;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;  // gravity on particles
      p.life -= decay;
      return p.life > 0;
    });
  }

  private updateFloatTexts(dt: number): void {
    const decay = dt * 0.0018;
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.y += ft.vy;
      ft.life -= decay;
      return ft.life > 0;
    });
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }
}
