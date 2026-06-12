/**
 * Bank Shot — main game engine.
 * ONE rAF loop, owned by this class. No per-tick state in React.
 */
import { tap, hit, clear as clearHaptic, fizzle } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { sfxShot, sfxBounce, sfxHit, sfxClear, sfxStar, sfxFizzle, sfxStart } from '../lib/sfx';
import { generateLevel, TURRET, SCENE_W, SCENE_H, type Target, type Wall, type LevelDef } from './levels';

// ——— constants ———
const BULLET_SPEED = 380;    // px/s logical
const MAX_RICOCHETS = 4;
const BULLET_R = 6;
const TARGET_HIT_R = 22;
const BULLET_TIME_DIST = 60;
const BULLET_TIME_SCALE = 0.25;
const BULLET_TIME_MS = 400;
const TOTAL_LEVELS = 12;

// ——— types ———
interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ricochets: number;
  trail: { x: number; y: number }[];
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  type: 'spark' | 'confetti';
  rot?: number;
  rotV?: number;
}

export interface HudState {
  level: number;
  shots: number;
  stars: number;
  totalStars: number;
  phase: 'ready' | 'aiming' | 'shooting' | 'cleared' | 'done';
  targetsLeft: number;
  clearStars: number;   // stars for the just-cleared level (0 until clear)
}

export interface AimState {
  active: boolean;
  angle: number;
  preview: { x: number; y: number }[];
}

// ——— helpers ———

function reflect(vx: number, vy: number, nx: number, ny: number): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny;
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}

function rayMarch(
  ox: number, oy: number,
  dx: number, dy: number,
  maxDist: number,
  walls: Wall[],
): { dist: number; nx: number; ny: number; type: 'wall' | 'edge' } | null {
  let best: { dist: number; nx: number; ny: number; type: 'wall' | 'edge' } | null = null;

  const edges = [
    { t: -ox / dx, nx: 1, ny: 0 },
    { t: (SCENE_W - ox) / dx, nx: -1, ny: 0 },
    { t: -oy / dy, nx: 0, ny: 1 },
    { t: (SCENE_H - oy) / dy, nx: 0, ny: -1 },
  ];
  for (const e of edges) {
    if (e.t > 0.5 && e.t < maxDist) {
      if (!best || e.t < best.dist) {
        best = { dist: e.t, nx: e.nx, ny: e.ny, type: 'edge' };
      }
    }
  }

  for (const w of walls) {
    const invdx = dx !== 0 ? 1 / dx : Infinity;
    const invdy = dy !== 0 ? 1 / dy : Infinity;
    const tx1 = (w.x - ox) * invdx;
    const tx2 = (w.x + w.w - ox) * invdx;
    const ty1 = (w.y - oy) * invdy;
    const ty2 = (w.y + w.h - oy) * invdy;
    const txMin = Math.min(tx1, tx2);
    const txMax = Math.max(tx1, tx2);
    const tyMin = Math.min(ty1, ty2);
    const tyMax = Math.max(ty1, ty2);
    const tMin = Math.max(txMin, tyMin);
    const tMax = Math.min(txMax, tyMax);
    if (tMax > 0.5 && tMin < tMax && tMin < maxDist) {
      if (!best || tMin < best.dist) {
        let nx = 0, ny = 0;
        if (txMin > tyMin) {
          nx = dx < 0 ? 1 : -1;
        } else {
          ny = dy < 0 ? 1 : -1;
        }
        best = { dist: tMin, nx, ny, type: 'wall' };
      }
    }
  }

  return best;
}

function computePreview(
  angle: number,
  walls: Wall[],
  segCount = 80,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let x = TURRET.x;
  let y = TURRET.y - 20;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remainingRicochets = 2;
  let totalDist = 0;
  const MAX_DIST = 1200;
  const stepSize = MAX_DIST / segCount;

  pts.push({ x, y });

  for (let seg = 0; seg < segCount && totalDist < MAX_DIST; seg++) {
    const h = rayMarch(x, y, dx, dy, stepSize * 2, walls);
    if (h && h.dist < stepSize) {
      x = x + dx * h.dist;
      y = y + dy * h.dist;
      pts.push({ x, y });
      const r = reflect(dx, dy, h.nx, h.ny);
      dx = r.vx;
      dy = r.vy;
      totalDist += h.dist;
      remainingRicochets--;
      if (remainingRicochets < 0) break;
    } else {
      x += dx * stepSize;
      y += dy * stepSize;
      totalDist += stepSize;
      pts.push({ x, y });
      if (x < -10 || x > SCENE_W + 10 || y < -10 || y > SCENE_H + 10) break;
    }
  }

  return pts;
}

// ——— main class ———

export class BankshotGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);

  private sceneW = SCENE_W;
  private sceneH = SCENE_H;
  private viewW = 390;
  private viewH = 844;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private levelIndex = 0;
  private levelDef!: LevelDef;
  private targets: (Target & { alive: boolean; hitAt: number })[] = [];
  private bullet: Bullet | null = null;
  private particles: Particle[] = [];

  private shots = 0;
  private totalStars = 0;
  private clearStars = 0;
  private bestStars: number;
  private bestLevel: number;

  private phase: HudState['phase'] = 'ready';
  private bulletTimeActive = false;
  private bulletTimeStartT = 0;
  private timeScale = 1;

  private gameTime = 0;

  // screenshake
  private shake = 0;
  private hitstopUntil = 0;

  private lastRafT = 0;
  private rafId = 0;
  private destroyed = false;

  private onHud: (h: HudState) => void;
  private onAim: (a: AimState) => void;
  private reducedMotion: () => boolean;

  private aimActive = false;
  private aimAngle = -Math.PI / 2;

  private clearAt = 0;

  // crosshair gutter decoration seed
  private readonly _gutterSeed = Math.random() * 100;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: HudState) => void,
    onAim: (a: AimState) => void,
    reducedMotion: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.onAim = onAim;
    this.reducedMotion = reducedMotion;
    this.bestStars = load<number>('bestStars', 0);
    this.bestLevel = load<number>('bestLevel', 0);
    this.loadLevel(0);
    this.setupDebug();
    this.emitHud();
    this.emitAim(false);
    this.rafId = requestAnimationFrame((t) => {
      this.lastRafT = t;
      this.loop(t);
    });
  }

  resize(w: number, h: number, canvas: HTMLCanvasElement): void {
    this.viewW = w;
    this.viewH = h;
    const scale = w / this.sceneW;
    this.scale = scale;
    this.offsetX = 0;
    const scaledH = this.sceneH * scale;
    this.offsetY = Math.max(0, (h - scaledH) / 2);
    const dpr = this.dpr;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__bankshot'];
  }

  // ——— public input ———

  start(): void {
    if (this.phase !== 'ready') return;
    this._started = true;
    this.phase = 'aiming';
    sfxStart();
    this.emitHud();
    this.emitAim(false);
  }

  startAim(sx: number, sy: number): void {
    if (this.phase !== 'aiming') return;
    const lp = this.screenToLogical(sx, sy);
    const angle = Math.atan2(lp.y - TURRET.y, lp.x - TURRET.x);
    this.aimAngle = Math.max(-Math.PI, Math.min(0, angle));
    this.aimActive = true;
    this.emitAim(true);
  }

  updateAim(sx: number, sy: number): void {
    if (!this.aimActive || this.phase !== 'aiming') return;
    const lp = this.screenToLogical(sx, sy);
    const angle = Math.atan2(lp.y - TURRET.y, lp.x - TURRET.x);
    this.aimAngle = Math.max(-Math.PI, Math.min(0, angle));
    this.emitAim(true);
  }

  releaseAim(): void {
    if (!this.aimActive || this.phase !== 'aiming') return;
    this.aimActive = false;
    this.fireAt(this.aimAngle);
    this.emitAim(false);
  }

  cancelAim(): void {
    this.aimActive = false;
    this.emitAim(false);
  }

  // ——— debug API ———

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__bankshot'] = {
      level: () => this.levelIndex + 1,
      stars: () => this.totalStars,
      shoot: (angleRad: number) => {
        if (this.phase === 'aiming') this.fireAt(angleRad);
      },
      targetsLeft: () => this.targets.filter(t => t.alive).length,
      targets: () => this.targets.filter(t => t.alive).map(t => {
        const pos = this.getTargetPos(t, this.gameTime);
        return { x: pos.x, y: pos.y };
      }),
      turret: () => ({ x: TURRET.x, y: TURRET.y }),
      skipLevel: () => this.advanceLevel(),
      restart: () => { this._started = false; this.totalStars = 0; this.loadLevel(0); this.emitHud(); this.emitAim(false); },
      start: () => this.start(),
    };
  }

  // ——— level management ———

  private _started = false;

  private loadLevel(idx: number): void {
    this.levelIndex = idx;
    this.levelDef = generateLevel(idx);
    this.targets = this.levelDef.targets.map(t => ({ ...t, alive: true, hitAt: 0 }));
    this.bullet = null;
    this.shots = 0;
    this.clearStars = 0;
    this.phase = this._started ? 'aiming' : 'ready';
    this.bulletTimeActive = false;
    this.timeScale = 1;
    this.particles = [];
    this.shake = 0;
  }


  private advanceLevel(): void {
    const next = this.levelIndex + 1;
    if (next >= TOTAL_LEVELS) {
      this.phase = 'done';
      this.emitHud();
      return;
    }
    this.loadLevel(next);
    this.emitHud();
    this.emitAim(false);
  }

  private starsForShots(shots: number): number {
    if (shots === 1) return 3;
    if (shots <= 2) return 2;
    return 1;
  }

  // ——— fire ———

  private fireAt(angle: number): void {
    if (this.phase !== 'aiming') return;
    this.shots++;
    const speed = BULLET_SPEED;
    this.bullet = {
      x: TURRET.x,
      y: TURRET.y - 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ricochets: 0,
      trail: [{ x: TURRET.x, y: TURRET.y - 20 }],
      active: true,
    };
    this.phase = 'shooting';
    sfxShot();
    this.emitHud();
    tap();
  }

  // ——— game loop ———

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const rawDt = Math.min((t - this.lastRafT) / 1000, 0.05);

      // hitstop
      const hitstopActive = Date.now() < this.hitstopUntil;

      if (this.bulletTimeActive) {
        const elapsed = t - this.bulletTimeStartT;
        if (elapsed > BULLET_TIME_MS) {
          this.bulletTimeActive = false;
          this.timeScale = 1;
        } else {
          this.timeScale = BULLET_TIME_SCALE;
        }
      }

      const timeScale = hitstopActive ? 0.05 : this.timeScale;
      const dt = rawDt * timeScale;
      this.gameTime += rawDt;

      this.shake = Math.max(0, this.shake - rawDt * 12);

      this.step(dt, rawDt, t);
      this.render();
    }
    this.lastRafT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number, _rawDt: number, nowMs: number): void {
    if (this.bullet && this.bullet.active) {
      this.stepBullet(dt, nowMs);
    }

    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += dt * 60 * 0.08;
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.rot !== undefined && p.rotV !== undefined) p.rot += p.rotV * dt * 60;
      p.life -= dt * (p.type === 'confetti' ? 0.6 : 1.4);
    }
    this.particles = this.particles.filter(p => p.life > 0);

    if (this.phase === 'cleared' && this.clearAt > 0 && nowMs - this.clearAt > 3000) {
      this.advanceLevel();
    }
  }

  private stepBullet(dt: number, nowMs: number): void {
    const b = this.bullet!;
    const dist = BULLET_SPEED * dt;

    let remaining = dist;
    let steps = 0;

    while (remaining > 0.5 && steps < 10 && b.active) {
      steps++;
      const len = Math.hypot(b.vx, b.vy);
      if (len < 0.001) { b.active = false; break; }
      const ndx = b.vx / len;
      const ndy = b.vy / len;

      const wallHit = rayMarch(b.x, b.y, ndx, ndy, remaining + BULLET_R, this.levelDef.walls);

      if (wallHit && wallHit.dist <= remaining + BULLET_R) {
        const moveDist = Math.max(0, wallHit.dist - BULLET_R * 0.5);
        b.x += ndx * moveDist;
        b.y += ndy * moveDist;
        remaining -= moveDist;

        if (this.checkTargetHits(b, nowMs)) {
          remaining = 0;
          break;
        }

        const ref = reflect(b.vx, b.vy, wallHit.nx, wallHit.ny);
        b.vx = ref.vx;
        b.vy = ref.vy;
        b.ricochets++;
        sfxBounce(b.ricochets);

        if (!this.reducedMotion()) {
          this.spawnSparks(b.x, b.y, 5, '#7ee8ff');
        }

        if (b.ricochets > MAX_RICOCHETS) {
          this.fizzleBullet();
          remaining = 0;
          break;
        }
      } else {
        b.x += ndx * remaining;
        b.y += ndy * remaining;
        remaining = 0;

        if (b.x < -20 || b.x > SCENE_W + 20 || b.y < -20 || b.y > SCENE_H + 20) {
          this.fizzleBullet();
          break;
        }
      }

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 60) b.trail.shift();

      if (this.checkTargetHits(b, nowMs)) {
        break;
      }
    }

    const aliveTargets = this.targets.filter(t => t.alive);
    if (aliveTargets.length === 1 && b.active && !this.bulletTimeActive) {
      const lastTarget = aliveTargets[0]!;
      const tpos = this.getTargetPos(lastTarget, this.gameTime);
      const dist2 = Math.hypot(b.x - tpos.x, b.y - tpos.y);
      if (dist2 < BULLET_TIME_DIST) {
        this.bulletTimeActive = true;
        this.bulletTimeStartT = nowMs;
        this.timeScale = BULLET_TIME_SCALE;
      }
    }
  }

  private checkTargetHits(b: Bullet, nowMs: number): boolean {
    for (const t of this.targets) {
      if (!t.alive) continue;
      const tpos = this.getTargetPos(t, this.gameTime);
      const dist = Math.hypot(b.x - tpos.x, b.y - tpos.y);
      if (dist < TARGET_HIT_R + BULLET_R) {
        t.alive = false;
        t.hitAt = nowMs;
        hit();
        sfxHit();
        if (!this.reducedMotion()) {
          this.shake = Math.max(this.shake, 0.6);
        }
        this.spawnExplosion(tpos.x, tpos.y);
        if (this.targets.every(t2 => !t2.alive)) {
          this.onLevelClear(nowMs);
          b.active = false;
          return true;
        }
        return false;
      }
    }
    return false;
  }

  private fizzleBullet(): void {
    if (!this.bullet) return;
    this.spawnSparks(this.bullet.x, this.bullet.y, 8, '#888');
    this.bullet.active = false;
    sfxFizzle();
    fizzle();
    this.phase = 'aiming';
    this.emitHud();
    this.emitAim(false);
  }

  private onLevelClear(nowMs: number): void {
    this.phase = 'cleared';
    this.clearAt = nowMs;
    const stars = this.starsForShots(this.shots);
    this.clearStars = stars;
    this.totalStars += stars;
    if (this.totalStars > this.bestStars) {
      this.bestStars = this.totalStars;
      save('bestStars', this.bestStars);
    }
    const nextLevel = this.levelIndex + 1;
    if (nextLevel > this.bestLevel) {
      this.bestLevel = nextLevel;
      save('bestLevel', this.bestLevel);
    }
    clearHaptic();
    sfxClear();
    // staggered star stamp sounds
    for (let i = 0; i < stars; i++) {
      setTimeout(() => sfxStar(i), 200 + i * 200);
    }
    this.spawnConfetti(TURRET.x, SCENE_H / 2);
    this.bulletTimeActive = false;
    this.timeScale = 1;
    if (!this.reducedMotion()) {
      this.shake = 1.0;
      this.hitstopUntil = Date.now() + 70;
    }
    this.emitHud();
  }

  // ——— particle helpers ———

  private spawnSparks(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: 2 + Math.random() * 2, color, life: 1, type: 'spark' });
    }
  }

  private spawnExplosion(x: number, y: number): void {
    if (this.reducedMotion()) return;
    const colors = ['#7ee8ff', '#00f5a0', '#ff4ecd', '#ffe94e', '#ff7b2e'];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + Math.random() * 0.3;
      const s = 2 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, r: 2.5 + Math.random() * 3, color, life: 1, type: 'spark' });
    }
  }

  private spawnConfetti(cx: number, _cy: number): void {
    if (this.reducedMotion()) return;
    const colors = ['#7ee8ff', '#00f5a0', '#ff4ecd', '#ffe94e', '#ff7b2e', '#ffffff'];
    for (let i = 0; i < 55; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const s = 3 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: SCENE_H * 0.6,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 4,
        color,
        life: 1,
        type: 'confetti',
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  // ——— coordinate helpers ———

  private screenToLogical(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  private getTargetPos(t: Target, gameTime: number): { x: number; y: number } {
    if (!t.motion) return { x: t.x, y: t.y };
    const offset = t.motion.amplitude * Math.sin((2 * Math.PI * gameTime) / t.motion.period + t.motion.phase);
    return {
      x: t.x + (t.motion.axis === 'x' ? offset : 0),
      y: t.y + (t.motion.axis === 'y' ? offset : 0),
    };
  }

  // ——— emit ———

  private emitHud(): void {
    this.onHud({
      level: this.levelIndex + 1,
      shots: this.shots,
      stars: this.totalStars,
      totalStars: this.totalStars,
      phase: this.phase,
      targetsLeft: this.targets.filter(t => t.alive).length,
      clearStars: this.clearStars,
    });
  }

  private emitAim(active: boolean): void {
    if (active) {
      const preview = computePreview(this.aimAngle, this.levelDef.walls);
      this.onAim({ active: true, angle: this.aimAngle, preview });
    } else {
      this.onAim({ active: false, angle: this.aimAngle, preview: [] });
    }
  }

  // ——— rendering ———

  private render(): void {
    const { ctx, dpr } = this;
    const W = this.viewW;
    const H = this.viewH;

    const shx = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;

    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);

    const isDark = document.documentElement.dataset.theme !== 'light';

    // ——— decorated gutters (slate gradient + crosshair motifs) ———
    const gutterBg = isDark
      ? ctx.createLinearGradient(0, 0, 0, H)
      : ctx.createLinearGradient(0, 0, 0, H);

    if (isDark) {
      gutterBg.addColorStop(0, '#060c18');
      gutterBg.addColorStop(0.5, '#0a1428');
      gutterBg.addColorStop(1, '#050a14');
    } else {
      gutterBg.addColorStop(0, '#d8e4f8');
      gutterBg.addColorStop(0.5, '#c8d8f0');
      gutterBg.addColorStop(1, '#d0dcf4');
    }
    ctx.fillStyle = gutterBg;
    ctx.fillRect(0, 0, W, H);

    // faint crosshair motifs in gutters
    if (this.offsetX > 4) {
      this.drawGutterCrosshairs(isDark);
    }

    // scene with offset + scale
    ctx.save();
    ctx.translate(this.offsetX + shx, this.offsetY + shy);
    ctx.scale(this.scale, this.scale);

    this.drawScene(isDark);

    ctx.restore();
  }

  private drawGutterCrosshairs(isDark: boolean): void {
    const ctx = this.ctx;
    const color = isDark ? 'rgba(126,232,255,0.08)' : 'rgba(60,100,220,0.08)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const seed = this._gutterSeed;
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 0 : this.viewW - this.offsetX;
      const gw = this.offsetX;
      if (gw < 4) continue;
      const cx = side === 0
        ? 4 + ((seed * (i + 1) * 7.3) % (gw - 8))
        : side + 4 + ((seed * (i + 1) * 5.7) % (gw - 8));
      const cy = (((seed * (i + 1) * 11.9) % 1) + i / 8) * this.viewH;
      const r = 8 + ((seed * (i * 3.3)) % 16);
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawScene(isDark: boolean): void {
    const ctx = this.ctx;
    const now = this.gameTime;

    const sceneBg = isDark ? '#111827' : '#f0f4ff';
    ctx.fillStyle = sceneBg;
    ctx.beginPath();
    ctx.roundRect(0, 0, SCENE_W, SCENE_H, 16);
    ctx.fill();

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,100,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= SCENE_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SCENE_H); ctx.stroke();
    }
    for (let y = 0; y <= SCENE_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SCENE_W, y); ctx.stroke();
    }

    for (const w of this.levelDef.walls) {
      this.drawWall(w, isDark);
    }

    if (this.aimActive && this.phase === 'aiming') {
      this.drawAimPreview(isDark);
    }

    for (const t of this.targets) {
      const pos = this.getTargetPos(t, now);
      if (t.alive) {
        this.drawTarget(pos.x, pos.y, t.r, isDark);
      } else {
        const age = (performance.now() - t.hitAt) / 600;
        if (age < 1) {
          ctx.globalAlpha = 1 - age;
          const puffR = t.r * (1 + age * 1.5);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, puffR, 0, Math.PI * 2);
          ctx.fillStyle = '#7ee8ff';
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    if (this.bullet && this.bullet.active) {
      this.drawBullet(isDark);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.type === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    this.drawTurret(isDark);

    ctx.strokeStyle = isDark ? 'rgba(126,232,255,0.25)' : 'rgba(60,80,200,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, SCENE_W - 2, SCENE_H - 2, 16);
    ctx.stroke();

    if (this.bulletTimeActive) {
      const progress = Math.min(1, (performance.now() - this.bulletTimeStartT) / BULLET_TIME_MS);
      const alpha = 0.18 * Math.sin(progress * Math.PI);
      ctx.fillStyle = `rgba(126,232,255,${alpha})`;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  }

  private drawWall(w: Wall, isDark: boolean): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
    if (isDark) {
      grad.addColorStop(0, '#1e3a5f');
      grad.addColorStop(1, '#0f2040');
    } else {
      grad.addColorStop(0, '#c0d0f0');
      grad.addColorStop(1, '#a0b8e8');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 6);
    ctx.fill();

    ctx.strokeStyle = isDark ? 'rgba(126,232,255,0.3)' : 'rgba(80,120,220,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 6);
    ctx.stroke();
  }

  private drawTarget(x: number, y: number, r: number, isDark: boolean): void {
    const ctx = this.ctx;
    const pulse = 0.7 + 0.3 * Math.sin(this.gameTime * 3.5);

    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 14 * pulse;

    const bodyColor = isDark ? '#2de0c0' : '#10b5a0';
    const bodyDeep = isDark ? '#0a8a70' : '#077a60';
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#e0fff8');
    grad.addColorStop(0.4, bodyColor);
    grad.addColorStop(1, bodyDeep);

    ctx.fillStyle = grad;
    ctx.beginPath();
    const blobOffset = r * 0.15 * Math.sin(this.gameTime * 2.2);
    ctx.ellipse(x, y + blobOffset, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.25, r * 0.38, r * 0.28, -0.4, 0, Math.PI * 2);
    ctx.fill();

    const eyeOffsetY = -r * 0.1 + blobOffset;
    for (const ex of [-r * 0.3, r * 0.3]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x + ex, y + eyeOffsetY, r * 0.2, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      let lookDx = 0, lookDy = 0.5;
      if (this.bullet && this.bullet.active) {
        const ld = Math.hypot(this.bullet.x - x, this.bullet.y - y);
        if (ld > 0) { lookDx = (this.bullet.x - x) / ld; lookDy = (this.bullet.y - y) / ld; }
      }
      ctx.fillStyle = '#1a2030';
      ctx.beginPath();
      ctx.ellipse(x + ex + lookDx * r * 0.06, y + eyeOffsetY + lookDy * r * 0.06, r * 0.12, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x + ex - r * 0.06, y + eyeOffsetY - r * 0.1, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
    }

    const mouthY = y + r * 0.28 + blobOffset;
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    if (this.bullet && this.bullet.active) {
      ctx.beginPath();
      ctx.arc(x, mouthY + r * 0.08, r * 0.2, Math.PI * 0.15, Math.PI * 0.85, false);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, mouthY - r * 0.1, r * 0.2, 0, Math.PI, false);
      ctx.stroke();
    }

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  private drawBullet(isDark: boolean): void {
    const ctx = this.ctx;
    const b = this.bullet!;

    if (b.trail.length > 1) {
      for (let i = 1; i < b.trail.length; i++) {
        const alpha = (i / b.trail.length) * 0.7;
        const r = BULLET_R * (i / b.trail.length) * 0.8;
        const pt = b.trail[i]!;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#7ee8ff';
        ctx.shadowColor = '#7ee8ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.shadowColor = '#7ee8ff';
    ctx.shadowBlur = isDark ? 22 : 14;
    const grad = ctx.createRadialGradient(b.x - 1, b.y - 1, 0.5, b.x, b.y, BULLET_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#7ee8ff');
    grad.addColorStop(1, '#0090c0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  private drawTurret(isDark: boolean): void {
    const ctx = this.ctx;
    const tx = TURRET.x;
    const ty = TURRET.y;

    ctx.save();
    ctx.shadowColor = isDark ? '#7ee8ff' : '#3060d0';
    ctx.shadowBlur = 12;

    const baseGrad = ctx.createRadialGradient(tx, ty, 2, tx, ty, 22);
    baseGrad.addColorStop(0, isDark ? '#4a7cff' : '#6080f0');
    baseGrad.addColorStop(1, isDark ? '#1a2a5a' : '#3050c0');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(tx, ty, 22, 0, Math.PI * 2);
    ctx.fill();

    const angle = this.aimActive ? this.aimAngle : -Math.PI / 2;
    const barrelLen = 28;
    ctx.strokeStyle = isDark ? '#a0d4ff' : '#5070e0';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(angle) * barrelLen, ty + Math.sin(angle) * barrelLen);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(angle) * barrelLen, ty + Math.sin(angle) * barrelLen);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  private drawAimPreview(isDark: boolean): void {
    const ctx = this.ctx;
    const preview = computePreview(this.aimAngle, this.levelDef.walls);

    if (preview.length < 2) return;

    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -(this.gameTime * 40 % 14);
    ctx.strokeStyle = isDark ? 'rgba(126,232,255,0.55)' : 'rgba(60,100,220,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = isDark ? '#7ee8ff' : '#4060e0';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(preview[0]!.x, preview[0]!.y);
    for (let i = 1; i < preview.length; i++) {
      ctx.lineTo(preview[i]!.x, preview[i]!.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.shadowBlur = 0;
  }
}
