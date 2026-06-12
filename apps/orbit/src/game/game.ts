/**
 * Orbit Hop — one-finger orbit-ring hopper with a gravity slingshot.
 * Tap: hop to the next ring (direction bounces at the edges).
 * Hold ≥ 300ms then release: slingshot two rings in one leap.
 * Collect stars, dodge debris; speed ramps forever.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';

const W = 390;
const H = 700;
const CX = W / 2;
const CY = H / 2 - 20;
const RINGS = [62, 104, 146, 188, 230];
const PLAYER_R = 9;
const STAR_R = 7;
const DEBRIS_R = 8;
const HOP_MS = 220;
const SLING_MS = 320;
const CHARGE_MS = 300;

interface Mover { ring: number; angle: number; speed: number }

export interface OrbitHud {
  score: number;
  best: number;
  phase: 'playing' | 'dead';
  charging: boolean;
}

export class OrbitGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;

  private ring = 2;
  private angle = -Math.PI / 2;
  private dir = 1; // hop direction: +1 outward
  private angSpeed = 1.1;
  private hop: { from: number; to: number; t0: number; dur: number } | null = null;
  private holdStart: number | null = null;
  private charging = false;
  private stars: Mover[] = [];
  private debris: Mover[] = [];
  private particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }[] = [];
  private score = 0;
  private best: number;
  private phase: 'playing' | 'dead' = 'playing';
  private elapsed = 0;
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: OrbitHud) => void;
  private reducedMotion: () => boolean;

  constructor(canvas: HTMLCanvasElement, onHud: (h: OrbitHud) => void, reducedMotion: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.seedField();
    this.setupDebug();
    this.emit();
    this.rafId = requestAnimationFrame((t) => {
      this.lastT = t;
      this.loop(t);
    });
  }

  resize(w: number, h: number, canvas: HTMLCanvasElement): void {
    this.viewW = w;
    canvas.width = w * this.dpr;
    canvas.height = h * this.dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__orbit'];
  }

  restart(): void {
    this.ring = 2;
    this.angle = -Math.PI / 2;
    this.dir = 1;
    this.angSpeed = 1.1;
    this.hop = null;
    this.charging = false;
    this.holdStart = null;
    this.score = 0;
    this.elapsed = 0;
    this.phase = 'playing';
    this.seedField();
    this.emit();
  }

  pointerDown(): void {
    if (this.phase !== 'playing') return;
    this.holdStart = Date.now();
  }

  pointerUp(): void {
    if (this.phase !== 'playing' || this.holdStart === null) return;
    const held = Date.now() - this.holdStart;
    this.holdStart = null;
    this.charging = false;
    this.doHop(held >= CHARGE_MS ? 2 : 1);
    this.emit();
  }

  private doHop(distance: number): void {
    if (this.hop) return;
    let to = this.ring + this.dir * distance;
    if (to >= RINGS.length || to < 0) {
      this.dir *= -1;
      to = this.ring + this.dir * distance;
      to = Math.max(0, Math.min(RINGS.length - 1, to));
    }
    if (to === this.ring) return;
    this.hop = { from: this.ring, to, t0: Date.now(), dur: distance === 2 ? SLING_MS : HOP_MS };
    if (this.ring + this.dir * distance >= RINGS.length - 1 || this.ring + this.dir * distance <= 0) {
      // next hop will bounce — flip handled above on demand
    }
    tap();
  }

  private seedField(): void {
    this.stars = [];
    this.debris = [];
    for (let i = 0; i < 4; i++) this.spawnStar();
    for (let i = 0; i < 5; i++) this.spawnDebris();
  }

  private spawnStar(): void {
    this.stars.push({
      ring: Math.floor(Math.random() * RINGS.length),
      angle: Math.random() * Math.PI * 2,
      speed: 0,
    });
  }

  private spawnDebris(): void {
    const dirSign = Math.random() < 0.5 ? -1 : 1;
    this.debris.push({
      ring: Math.floor(Math.random() * RINGS.length),
      angle: Math.random() * Math.PI * 2,
      speed: dirSign * (0.5 + Math.random() * 0.7),
    });
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__orbit'] = {
      score: () => this.score,
      ring: () => this.ring,
      phase: () => this.phase,
      hop: () => {
        this.doHop(1);
      },
      die: () => this.die(),
      restart: () => this.restart(),
      placeStarOnPath: () => {
        this.stars.push({ ring: this.ring, angle: this.angle + 0.25, speed: 0 });
      },
    };
  }

  private emit(): void {
    this.onHud({ score: this.score, best: this.best, phase: this.phase, charging: this.charging });
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
    const now = Date.now();
    this.elapsed += dt;
    // difficulty ramp
    this.angSpeed = 1.1 + Math.min(1.1, this.elapsed * 0.018);
    if (this.debris.length < 5 + Math.floor(this.elapsed / 12) && Math.random() < dt * 0.4) {
      this.spawnDebris();
    }

    this.angle += this.angSpeed * dt;
    for (const d of this.debris) d.angle += d.speed * dt;

    // charging indicator
    this.charging = this.holdStart !== null && now - this.holdStart >= CHARGE_MS;

    // hop completion
    if (this.hop && now - this.hop.t0 >= this.hop.dur) {
      this.ring = this.hop.to;
      this.hop = null;
      this.burst(...this.playerXY(), '#7df0ff', 6);
    }

    // collisions (only when not mid-hop — you're untouchable in flight)
    if (!this.hop) {
      const [px, py] = this.playerXY();
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const s = this.stars[i]!;
        const [sx, sy] = this.ringXY(s.ring, s.angle);
        if (Math.hypot(sx - px, sy - py) < PLAYER_R + STAR_R) {
          this.stars.splice(i, 1);
          this.score += 10;
          if (this.score > this.best) {
            this.best = this.score;
            save('best', this.best);
          }
          this.burst(sx, sy, '#ffe066', 10);
          pop();
          this.spawnStar();
          this.emit();
        }
      }
      for (const d of this.debris) {
        const [dx, dy] = this.ringXY(d.ring, d.angle);
        if (Math.hypot(dx - px, dy - py) < PLAYER_R + DEBRIS_R - 2) {
          this.die();
          return;
        }
      }
    }
  }

  private die(): void {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    const [px, py] = this.playerXY();
    this.burst(px, py, '#ff6e8a', 22);
    death();
    this.emit();
  }

  private ringXY(ring: number, angle: number): [number, number] {
    return [CX + Math.cos(angle) * RINGS[ring]!, CY + Math.sin(angle) * RINGS[ring]!];
  }

  private playerXY(): [number, number] {
    if (this.hop) {
      const f = Math.min(1, (Date.now() - this.hop.t0) / this.hop.dur);
      const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const r = RINGS[this.hop.from]! + (RINGS[this.hop.to]! - RINGS[this.hop.from]!) * ease;
      return [CX + Math.cos(this.angle) * r, CY + Math.sin(this.angle) * r];
    }
    return this.ringXY(this.ring, this.angle);
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 2.6;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 2.5, color, life: 1 });
    }
  }

  private render(t: number): void {
    const { ctx, dpr } = this;
    const s = this.viewW / W;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.fillStyle = '#0a0a1f';
    ctx.fillRect(0, 0, W, H);

    // starfield
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 50; i++) {
      ctx.fillRect((i * 89) % W, (i * 197) % H, 1.4, 1.4);
    }

    // central star
    const cg = ctx.createRadialGradient(CX, CY, 2, CX, CY, 42);
    cg.addColorStop(0, '#fff4c2');
    cg.addColorStop(0.4, '#ffd84d');
    cg.addColorStop(1, 'rgba(255, 216, 77, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(CX, CY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb99';
    ctx.beginPath();
    ctx.arc(CX, CY, 17, 0, Math.PI * 2);
    ctx.fill();

    // rings
    for (let i = 0; i < RINGS.length; i++) {
      ctx.strokeStyle = i === this.ring && !this.hop ? 'rgba(125, 240, 255, 0.5)' : 'rgba(125, 240, 255, 0.16)';
      ctx.lineWidth = i === this.ring && !this.hop ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(CX, CY, RINGS[i]!, 0, Math.PI * 2);
      ctx.stroke();
    }

    // stars
    for (const st of this.stars) {
      const [x, y] = this.ringXY(st.ring, st.angle);
      const tw = 0.8 + Math.sin(t / 200 + st.angle * 7) * 0.2;
      ctx.save();
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#ffe066';
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 12;
      ctx.translate(x, y);
      ctx.rotate(t / 900);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        ctx.lineTo(Math.cos(a1) * STAR_R, Math.sin(a1) * STAR_R);
        ctx.lineTo(Math.cos(a2) * STAR_R * 0.45, Math.sin(a2) * STAR_R * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // debris
    for (const d of this.debris) {
      const [x, y] = this.ringXY(d.ring, d.angle);
      ctx.save();
      ctx.fillStyle = '#5a4a6e';
      ctx.strokeStyle = '#ff6e8a';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#ff6e8a';
      ctx.shadowBlur = 8;
      ctx.translate(x, y);
      ctx.rotate(d.angle * 3);
      ctx.beginPath();
      ctx.moveTo(-DEBRIS_R, -DEBRIS_R * 0.5);
      ctx.lineTo(0, -DEBRIS_R);
      ctx.lineTo(DEBRIS_R, -DEBRIS_R * 0.3);
      ctx.lineTo(DEBRIS_R * 0.7, DEBRIS_R * 0.8);
      ctx.lineTo(-DEBRIS_R * 0.6, DEBRIS_R * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // player comet
    if (this.phase === 'playing') {
      const [px, py] = this.playerXY();
      // trail
      for (let i = 1; i <= 5; i++) {
        const ta = this.angle - i * 0.07;
        const r = this.hop ? Math.hypot(px - CX, py - CY) : RINGS[this.ring]!;
        const tx = CX + Math.cos(ta) * r;
        const ty = CY + Math.sin(ta) * r;
        ctx.globalAlpha = 0.3 * (1 - i / 6);
        ctx.fillStyle = '#7df0ff';
        ctx.beginPath();
        ctx.arc(tx, ty, PLAYER_R * (1 - i / 7), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const pg = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, PLAYER_R + (this.charging ? 4 : 0));
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, this.charging ? '#ffd84d' : '#7df0ff');
      ctx.fillStyle = pg;
      ctx.shadowColor = this.charging ? '#ffd84d' : '#7df0ff';
      ctx.shadowBlur = this.charging ? 22 : 14;
      ctx.beginPath();
      ctx.arc(px, py, PLAYER_R + (this.charging ? 2.5 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
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
      p.life -= 0.03;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;
  }
}

export const ORBIT_SCENE = { W, H };
