/**
 * Swing King — endless rope-swing across a glowing canyon.
 * Hold: latch onto the best hook ahead. Release: fly. Distance is glory.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { sfxLatch, sfxSwingLoop, sfxStarChirp, sfxSplash, sfxStart } from '../lib/sfx';

const W = 390;
const H = 700;
const GRAVITY = 1500;
const ROPE_MAX = 250;
const FLOOR_Y = H - 70;
const PX_PER_M = 40;

interface Hook { x: number; y: number }
interface Star { x: number; y: number; got: boolean }

export interface SwingHud {
  distance: number;
  best: number;
  stars: number;
  phase: 'ready' | 'playing' | 'dead';
  attached: boolean;
}

export class SwingGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;
  private viewH = H;

  private px = 80;
  private py = 240;
  private vx = 240;
  private vy = -60;
  private rope: { hook: Hook; len: number } | null = null;
  private wantAttach = false;
  private hooks: Hook[] = [];
  private stars: Star[] = [];
  private genX = 0;
  private starCount = 0;
  private best: number;
  private phase: 'ready' | 'playing' | 'dead' = 'ready';
  private hitstopUntil = 0;
  private shake = 0;
  private starCombo = 0;
  private trail: { x: number; y: number }[] = [];
  private particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }[] = [];
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: SwingHud) => void;
  private reducedMotion: () => boolean;

  constructor(canvas: HTMLCanvasElement, onHud: (h: SwingHud) => void, reducedMotion: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.generateAhead();
    this.setupDebug();
    this.emit();
    this.rafId = requestAnimationFrame((t) => {
      this.lastT = t;
      this.loop(t);
    });
  }

  resize(w: number, h: number, canvas: HTMLCanvasElement): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = w;
    this.viewH = h;
    canvas.width = w * this.dpr;
    canvas.height = h * this.dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__swing'];
  }

  start(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'playing';
    sfxStart();
    this.emit();
  }

  restart(): void {
    this.px = 80;
    this.py = 240;
    this.vx = 240;
    this.vy = -60;
    this.rope = null;
    this.wantAttach = false;
    this.hooks = [];
    this.stars = [];
    this.genX = 0;
    this.starCount = 0;
    this.starCombo = 0;
    this.trail = [];
    this.phase = 'playing';
    this.generateAhead();
    sfxStart();
    this.emit();
  }

  attach(): void {
    this.wantAttach = true;
    this.tryAttach();
  }

  release(): void {
    this.wantAttach = false;
    if (this.rope) {
      this.rope = null;
      tap();
      this.emit();
    }
  }

  private tryAttach(): void {
    if (this.phase !== 'playing' || this.rope || !this.wantAttach) return;
    // best hook: ahead of the player, above, within rope range
    let best: Hook | null = null;
    let bestScore = -Infinity;
    for (const h of this.hooks) {
      const dx = h.x - this.px;
      const dy = h.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > ROPE_MAX || dy > -20 || dx < -40) continue;
      const score = dx - Math.abs(d - 170) * 0.5; // prefer ahead + comfy length
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    if (best) {
      this.rope = { hook: best, len: Math.hypot(best.x - this.px, best.y - this.py) };
      sfxLatch();
      tap();
      this.emit();
    }
  }

  private generateAhead(): void {
    while (this.genX < this.px + W * 2.5) {
      this.genX += 175 + Math.random() * 95;
      const hook: Hook = { x: this.genX, y: 70 + Math.random() * 130 };
      this.hooks.push(hook);
      if (Math.random() < 0.65) {
        this.stars.push({
          x: hook.x + 40 + Math.random() * 90,
          y: hook.y + 160 + Math.random() * 140,
          got: false,
        });
      }
    }
    this.hooks = this.hooks.filter((h) => h.x > this.px - W);
    this.stars = this.stars.filter((s) => s.x > this.px - W);
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__swing'] = {
      distance: () => Math.floor(this.px / PX_PER_M),
      stars: () => this.starCount,
      phase: () => this.phase,
      attach: () => this.attach(),
      release: () => this.release(),
      attached: () => this.rope !== null,
      restart: () => this.restart(),
      start: () => this.start(),
    };
  }

  private emit(): void {
    this.onHud({
      distance: Math.floor(this.px / PX_PER_M),
      best: this.best,
      stars: this.starCount,
      phase: this.phase,
      attached: this.rope !== null,
    });
  }

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const scale = Date.now() < this.hitstopUntil ? 0.05 : 1;
      const rawMs = Math.min(t - this.lastT, 100);
      const dt = rawMs * scale / 1000;
      const speed = Math.hypot(this.vx, this.vy);
      if (this.phase === 'playing') this.step(dt, speed);
      this.render(t);
      // decay shake
      this.shake = Math.max(0, this.shake - rawMs / 1000 * 14);
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number, speed: number = 0): void {
    this.vy += GRAVITY * dt;
    this.px += this.vx * dt;
    this.py += this.vy * dt;

    // rope constraint: project back to rope length, kill radial velocity
    if (this.rope) {
      const { hook, len } = this.rope;
      const dx = this.px - hook.x;
      const dy = this.py - hook.y;
      const d = Math.hypot(dx, dy);
      if (d > len) {
        const nx = dx / d;
        const ny = dy / d;
        this.px = hook.x + nx * len;
        this.py = hook.y + ny * len;
        const vr = this.vx * nx + this.vy * ny;
        if (vr > 0) {
          this.vx -= vr * nx;
          this.vy -= vr * ny;
        }
        // gentle pump so swings keep momentum forward
        this.vx += 26 * dt * (this.vx >= 0 ? 1 : -1);
      }
      // subtle whoosh while swinging
      sfxSwingLoop(speed);
    } else if (this.wantAttach) {
      this.tryAttach();
    }

    // ceiling bounce-soft
    if (this.py < 20) {
      this.py = 20;
      this.vy = Math.max(this.vy, 0);
    }

    // stars
    for (const s of this.stars) {
      if (!s.got && Math.hypot(s.x - this.px, s.y - this.py) < 26) {
        s.got = true;
        this.starCount++;
        this.starCombo++;
        sfxStarChirp(this.starCombo);
        this.burst(s.x, s.y, '#ffe066', 8);
        pop();
        this.emit();
      }
    }

    // trail
    this.trail.push({ x: this.px, y: this.py });
    if (this.trail.length > 22) this.trail.shift();

    this.generateAhead();

    // death: the glow floor
    if (this.py > FLOOR_Y) {
      this.phase = 'dead';
      this.hitstopUntil = Date.now() + 60;
      this.shake = 1.4;
      sfxSplash();
      this.burst(this.px, FLOOR_Y, '#ff6e8a', 24);
      const dist = Math.floor(this.px / PX_PER_M);
      if (dist > this.best) {
        this.best = dist;
        save('best', this.best);
      }
      death();
      this.emit();
    } else if (Math.floor(this.px / PX_PER_M) % 5 === 0) {
      this.emit();
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 2.5, color, life: 1 });
    }
  }

  private render(t: number): void {
    const { ctx, dpr } = this;
    const s = this.viewH / H;
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    const camX = this.px - this.viewW / s * 0.38;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

    // dusk sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1038');
    sky.addColorStop(0.6, '#2c1650');
    sky.addColorStop(1, '#4a1c52');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.viewW / s, Math.max(H, this.viewH / s));

    // parallax canyon silhouettes
    const sceneW = this.viewW / s;
    for (const [speed, color, base] of [[0.25, '#241345', 540], [0.5, '#1b0d33', 600]] as const) {
      ctx.fillStyle = color;
      const off = (camX * speed) % 280;
      for (let x = -off - 280; x < sceneW + camX + 280; x += 280) {
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(x + 60, base);
        ctx.lineTo(x + 140, base + 50);
        ctx.lineTo(x + 220, base - 20);
        ctx.lineTo(x + 280, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(-camX + shx, shy);

    // hooks
    for (const h of this.hooks) {
      if (h.x < camX - 40 || h.x > camX + sceneW + 40) continue;
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    // stars
    for (const st of this.stars) {
      if (st.got || st.x < camX - 30 || st.x > camX + sceneW + 30) continue;
      const tw = 0.75 + Math.sin(t / 220 + st.x) * 0.25;
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#7df0ff';
      ctx.shadowColor = '#7df0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(st.x, st.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i]!;
      ctx.globalAlpha = (i / this.trail.length) * 0.35;
      ctx.fillStyle = '#ff9ec7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // rope
    if (this.rope) {
      ctx.strokeStyle = '#f5e9d0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.rope.hook.x, this.rope.hook.y);
      ctx.lineTo(this.px, this.py);
      ctx.stroke();
    }

    // player — round adventurer with a cape hint
    if (this.phase === 'playing') {
      const pg = ctx.createRadialGradient(this.px - 3, this.py - 3, 2, this.px, this.py, 13);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.35, '#ff9ec7');
      pg.addColorStop(1, '#d9568f');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(this.px, this.py, 13, 0, Math.PI * 2);
      ctx.fill();
      // eyes facing travel
      const dir = this.vx >= 0 ? 1 : -1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.px + 4 * dir, this.py - 3, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#33122a';
      ctx.beginPath();
      ctx.arc(this.px + 5.2 * dir, this.py - 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // glow floor (death)
    const fg = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    fg.addColorStop(0, 'rgba(255, 110, 138, 0.85)');
    fg.addColorStop(1, 'rgba(255, 110, 138, 0.2)');
    ctx.fillStyle = fg;
    ctx.fillRect(camX - 50, FLOOR_Y, sceneW + 100, H - FLOOR_Y);
    ctx.strokeStyle = '#ff6e8a';
    ctx.shadowColor = '#ff6e8a';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(camX - 50, FLOOR_Y);
    ctx.lineTo(camX + sceneW + 50, FLOOR_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= 0.025;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

export const SWING_SCENE = { W, H };
