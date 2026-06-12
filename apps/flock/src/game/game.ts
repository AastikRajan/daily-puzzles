/**
 * Flock! — herd a glowing boids swarm with your finger.
 * Guide fireflies from the start to the home ring, through multiplier gates,
 * past predators that eat stragglers. Deliver enough to clear the level.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';

const W = 390;
const H = 700;
const MAX_FLOCK = 90;

interface Boid { x: number; y: number; vx: number; vy: number; hue: number }
interface Gate { x: number; y: number; w: number; label: string; kind: 'x2' | 'plus10' | 'minus'; used: boolean }
interface Predator { x: number; y: number; r: number; vx: number; vy: number; gulpT: number }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }

export interface FlockHud {
  count: number;
  delivered: number;
  need: number;
  level: number;
  best: number;
  phase: 'playing' | 'won' | 'lost';
}

export class FlockGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;
  private viewH = H;

  private boids: Boid[] = [];
  private gates: Gate[] = [];
  private predators: Predator[] = [];
  private particles: Particle[] = [];
  private home = { x: W / 2, y: 80, r: 52 };
  private start = { x: W / 2, y: H - 90 };
  private pointer: { x: number; y: number } | null = null;
  private level = 1;
  private delivered = 0;
  private need = 20;
  private best: number;
  private phase: 'playing' | 'won' | 'lost' = 'playing';
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: FlockHud) => void;
  private reducedMotion: () => boolean;

  constructor(canvas: HTMLCanvasElement, onHud: (h: FlockHud) => void, reducedMotion: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best-level', 1);
    this.setupLevel(1);
    this.setupDebug();
    this.rafId = requestAnimationFrame((t) => {
      this.lastT = t;
      this.loop(t);
    });
  }

  resize(w: number, h: number, canvas: HTMLCanvasElement): void {
    this.viewW = w;
    this.viewH = h;
    canvas.width = w * this.dpr;
    canvas.height = h * this.dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  setPointer(p: { x: number; y: number } | null): void {
    this.pointer = p;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__flock'];
  }

  nextLevel(): void {
    if (this.phase !== 'won') return;
    this.setupLevel(this.level + 1);
  }

  retry(): void {
    if (this.phase !== 'lost') return;
    this.setupLevel(this.level);
  }

  private setupLevel(level: number): void {
    this.level = level;
    this.delivered = 0;
    this.need = 16 + level * 6;
    this.phase = 'playing';
    this.boids = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      this.boids.push({
        x: this.start.x + (Math.random() - 0.5) * 60,
        y: this.start.y + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        hue: 45 + Math.random() * 30,
      });
    }
    // gates: alternate sides going up; one minus gate from level 2
    this.gates = [];
    const gateKinds: Gate['kind'][] = level >= 3 ? ['x2', 'plus10', 'minus', 'x2'] : level === 2 ? ['x2', 'minus', 'plus10'] : ['x2', 'plus10'];
    gateKinds.forEach((kind, i) => {
      const y = H - 200 - i * (440 / gateKinds.length);
      this.gates.push({
        x: i % 2 === 0 ? 95 : W - 95,
        y,
        w: 110,
        kind,
        label: kind === 'x2' ? '×2' : kind === 'plus10' ? '+10' : '−8',
        used: false,
      });
    });
    // predators scale with level
    this.predators = [];
    for (let i = 0; i < Math.min(1 + Math.floor(level / 2), 4); i++) {
      this.predators.push({
        x: 60 + Math.random() * (W - 120),
        y: 220 + Math.random() * 260,
        r: 17,
        vx: 0,
        vy: 0,
        gulpT: 0,
      });
    }
    if (level > this.best) {
      this.best = level;
      save('best-level', this.best);
    }
    this.emit();
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__flock'] = {
      count: () => this.boids.length,
      delivered: () => this.delivered,
      level: () => this.level,
      phase: () => this.phase,
      warpToHome: () => {
        for (const b of this.boids) {
          b.x = this.home.x + (Math.random() - 0.5) * 30;
          b.y = this.home.y + (Math.random() - 0.5) * 30;
        }
      },
      nextLevel: () => this.nextLevel(),
      retry: () => this.retry(),
      kill: () => {
        this.boids = [];
      },
    };
  }

  private emit(): void {
    this.onHud({
      count: this.boids.length,
      delivered: this.delivered,
      need: this.need,
      level: this.level,
      best: this.best,
      phase: this.phase,
    });
  }

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const dt = Math.min((t - this.lastT) / 1000, 0.05);
      if (this.phase === 'playing') this.step(dt);
      this.render(t);
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    const bs = this.boids;
    // boids: separation + cohesion + alignment + pointer attraction
    for (const b of bs) {
      let sx = 0; let sy = 0;       // separation
      let cx = 0; let cy = 0;       // cohesion centroid
      let ax = 0; let ay = 0;       // alignment
      let nNear = 0;
      for (const o of bs) {
        if (o === b) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2500) {
          nNear++;
          cx += o.x; cy += o.y;
          ax += o.vx; ay += o.vy;
          if (d2 < 280 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            sx -= (dx / d) * (1 - d / 17);
            sy -= (dy / d) * (1 - d / 17);
          }
        }
      }
      if (nNear > 0) {
        b.vx += ((cx / nNear - b.x) * 0.6 + (ax / nNear - b.vx) * 1.4) * dt;
        b.vy += ((cy / nNear - b.y) * 0.6 + (ay / nNear - b.vy) * 1.4) * dt;
      }
      b.vx += sx * 130 * dt;
      b.vy += sy * 130 * dt;
      if (this.pointer) {
        const dx = this.pointer.x - b.x;
        const dy = this.pointer.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, d / 120) * 230;
        b.vx += (dx / d) * pull * dt;
        b.vy += (dy / d) * pull * dt;
      }
      // predator avoidance (the flock is afraid)
      for (const p of this.predators) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 80 && d > 0.01) {
          b.vx += (dx / d) * 320 * dt * (1 - d / 80);
          b.vy += (dy / d) * 320 * dt * (1 - d / 80);
        }
      }
      // speed cap + damping
      const sp = Math.hypot(b.vx, b.vy);
      const cap = 175;
      if (sp > cap) {
        b.vx = (b.vx / sp) * cap;
        b.vy = (b.vy / sp) * cap;
      }
      b.vx *= 0.995;
      b.vy *= 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = Math.max(8, Math.min(W - 8, b.x));
      b.y = Math.max(8, Math.min(H - 8, b.y));
    }

    // gates
    for (const g of this.gates) {
      if (g.used) continue;
      let inside = 0;
      for (const b of bs) {
        if (Math.abs(b.x - g.x) < g.w / 2 && Math.abs(b.y - g.y) < 16) inside++;
      }
      if (inside >= Math.max(3, bs.length * 0.3)) {
        g.used = true;
        if (g.kind === 'x2') {
          const add = Math.min(bs.length, MAX_FLOCK - bs.length);
          for (let i = 0; i < add; i++) {
            const src = bs[i % bs.length]!;
            bs.push({ x: src.x + (Math.random() - 0.5) * 14, y: src.y + (Math.random() - 0.5) * 14, vx: src.vx, vy: src.vy, hue: 45 + Math.random() * 30 });
          }
          this.burst(g.x, g.y, '#7ef0c0', 18);
        } else if (g.kind === 'plus10') {
          for (let i = 0; i < Math.min(10, MAX_FLOCK - bs.length); i++) {
            bs.push({ x: g.x + (Math.random() - 0.5) * 40, y: g.y + (Math.random() - 0.5) * 16, vx: 0, vy: 0, hue: 45 + Math.random() * 30 });
          }
          this.burst(g.x, g.y, '#8db8ff', 14);
        } else {
          const take = Math.min(8, bs.length);
          for (let i = 0; i < take; i++) {
            const victim = bs.pop()!;
            this.burst(victim.x, victim.y, '#ff7a8a', 3);
          }
        }
        tap();
        this.emit();
      }
    }

    // predators chase the nearest boid slowly
    for (const p of this.predators) {
      let nearest: Boid | null = null;
      let bd = Infinity;
      for (const b of bs) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < bd) {
          bd = d;
          nearest = b;
        }
      }
      if (nearest) {
        const d = bd || 1;
        p.vx += ((nearest.x - p.x) / d) * 60 * dt;
        p.vy += ((nearest.y - p.y) / d) * 60 * dt;
      }
      const sp = Math.hypot(p.vx, p.vy);
      const cap = 62;
      if (sp > cap) {
        p.vx = (p.vx / sp) * cap;
        p.vy = (p.vy / sp) * cap;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(p.r, Math.min(W - p.r, p.x));
      p.y = Math.max(160, Math.min(H - 140, p.y));
      p.gulpT = Math.max(0, p.gulpT - dt);
      // eat
      for (let i = bs.length - 1; i >= 0; i--) {
        const b = bs[i]!;
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 3) {
          bs.splice(i, 1);
          p.gulpT = 0.35;
          this.burst(b.x, b.y, '#ff7a8a', 4);
          this.emit();
        }
      }
    }

    // home delivery
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i]!;
      if (Math.hypot(b.x - this.home.x, b.y - this.home.y) < this.home.r - 6) {
        bs.splice(i, 1);
        this.delivered++;
        this.burst(b.x, b.y, '#ffe066', 4);
        this.emit();
      }
    }

    // win/lose
    if (this.delivered >= this.need) {
      this.phase = 'won';
      pop();
      this.emit();
    } else if (bs.length === 0 && this.delivered < this.need) {
      this.phase = 'lost';
      death();
      this.emit();
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 2.4;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 2.5, color, life: 1 });
    }
  }

  private render(t: number): void {
    const { ctx, dpr } = this;
    const s = this.viewW / W;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

    // night meadow background
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, Math.max(H, this.viewH / s));
    // faint stars
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % W;
      const sy = (i * 211) % H;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // home ring
    const pulse = 1 + Math.sin(t / 500) * 0.04;
    ctx.save();
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(this.home.x, this.home.y, this.home.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 224, 102, 0.07)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 224, 102, 0.85)';
    ctx.font = "800 13px 'Nunito Variable', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('HOME', this.home.x, this.home.y + 4);
    ctx.restore();

    // gates
    for (const g of this.gates) {
      ctx.save();
      const color = g.kind === 'minus' ? '#ff7a8a' : g.kind === 'x2' ? '#7ef0c0' : '#8db8ff';
      ctx.globalAlpha = g.used ? 0.18 : 1;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = g.used ? 0 : 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x - g.w / 2, g.y);
      ctx.lineTo(g.x + g.w / 2, g.y);
      ctx.stroke();
      // posts
      for (const px of [g.x - g.w / 2, g.x + g.w / 2]) {
        ctx.beginPath();
        ctx.arc(px, g.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.font = "800 15px 'Baloo 2 Variable', cursive";
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(g.label, g.x, g.y - 12);
      ctx.restore();
    }

    // predators — shadowy gulpers
    for (const p of this.predators) {
      ctx.save();
      const r = p.r * (p.gulpT > 0 ? 1.25 : 1);
      const g2 = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 1.6);
      g2.addColorStop(0, 'rgba(150, 40, 70, 0.95)');
      g2.addColorStop(1, 'rgba(150, 40, 70, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a0f1a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      // eyes
      ctx.fillStyle = '#ff7a8a';
      ctx.beginPath();
      ctx.arc(p.x - 5, p.y - 3, 2.6, 0, Math.PI * 2);
      ctx.arc(p.x + 5, p.y - 3, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // fireflies — glowing dots with soft halos
    for (const b of this.boids) {
      const flicker = 0.75 + Math.sin(t / 180 + b.x) * 0.25;
      ctx.save();
      ctx.globalAlpha = flicker;
      const halo = ctx.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, 9);
      halo.addColorStop(0, `hsla(${b.hue}, 100%, 72%, 0.9)`);
      halo.addColorStop(1, `hsla(${b.hue}, 100%, 72%, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsl(${b.hue}, 100%, 86%)`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // pointer lantern
    if (this.pointer && this.phase === 'playing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, 26 + Math.sin(t / 300) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;
  }
}

export const FLOCK_SCENE = { W, H };
