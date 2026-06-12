/**
 * Helix Twist — Helix Jump inverted: the ball falls in place,
 * YOU spin the tower under it by dragging. Line up the gaps.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';

const W = 390;
const H = 700;
const CX = W / 2;
const BALL_X = CX;
const BALL_HOME_Y = 170;
const RING_GAP = 95;        // vertical distance between rings
const RING_RY = 26;         // ring ellipse vertical radius
const RING_RX = 150;        // ring ellipse horizontal radius
const SEGMENTS = 12;
const GRAVITY = 1900;
const BOUNCE_VY = -420;

const HUES = [265, 200, 330, 150, 25, 45];

interface Ring {
  /** per segment: 0 gap, 1 safe, 2 danger */
  segs: number[];
  broken: boolean;
}

export interface HelixHud {
  depth: number;
  score: number;
  best: number;
  combo: number;
  tower: number;
  phase: 'playing' | 'dead' | 'won';
}

export class HelixGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;

  private rings: Ring[] = [];
  private towerLen = 30;
  private tower: number;
  private rotation = 0;          // tower rotation (radians)
  private depth = 0;             // rings passed
  private scrollY = 0;           // smooth scroll offset
  private ballY = BALL_HOME_Y;
  private ballVy = 0;
  private combo = 0;
  private score = 0;
  private best: number;
  private phase: 'playing' | 'dead' | 'won' = 'playing';
  private particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }[] = [];
  private dragX: number | null = null;
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: HelixHud) => void;
  private reducedMotion: () => boolean;

  constructor(canvas: HTMLCanvasElement, onHud: (h: HelixHud) => void, reducedMotion: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.tower = 1;
    this.buildTower();
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
    delete (window as unknown as Record<string, unknown>)['__helix'];
  }

  dragStart(x: number): void {
    this.dragX = x;
  }

  dragMove(x: number): void {
    if (this.dragX === null || this.phase !== 'playing') return;
    this.rotation += (x - this.dragX) * 0.012;
    this.dragX = x;
  }

  dragEnd(): void {
    this.dragX = null;
  }

  restart(nextTower: boolean): void {
    if (nextTower) this.tower++;
    else {
      this.tower = 1;
      this.score = 0;
    }
    this.depth = 0;
    this.scrollY = 0;
    this.ballY = BALL_HOME_Y;
    this.ballVy = 0;
    this.combo = 0;
    this.rotation = 0;
    this.phase = 'playing';
    this.buildTower();
    this.emit();
  }

  private buildTower(): void {
    this.rings = [];
    this.towerLen = 26 + this.tower * 4;
    const dangerChance = Math.min(0.34, 0.1 + this.tower * 0.035);
    for (let i = 0; i < this.towerLen; i++) {
      const segs = new Array<number>(SEGMENTS).fill(1);
      // carve 3-4 contiguous gap segments at a random rotation
      const gapLen = 3 + (Math.random() < 0.4 ? 1 : 0);
      const gapStart = Math.floor(Math.random() * SEGMENTS);
      for (let g = 0; g < gapLen; g++) segs[(gapStart + g) % SEGMENTS] = 0;
      // danger segments on safe parts (not on first 2 rings)
      if (i > 1) {
        for (let s = 0; s < SEGMENTS; s++) {
          if (segs[s] === 1 && Math.random() < dangerChance) segs[s] = 2;
        }
        // guarantee at least 3 safe segments remain
        const safe = segs.filter((v) => v === 1).length;
        if (safe < 3) {
          for (let s = 0; safe + s < 3 && s < SEGMENTS; s++) {
            const idx = segs.findIndex((v) => v === 2);
            if (idx >= 0) segs[idx] = 1;
          }
        }
      }
      this.rings.push({ segs, broken: false });
    }
  }

  /** which segment of ring `i` is under the ball (front center)? */
  private segUnderBall(ring: Ring): number {
    // front-center corresponds to angle -PI/2 in screen space; tower rotation shifts it
    const a = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor((a / (Math.PI * 2)) * SEGMENTS) % SEGMENTS;
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__helix'] = {
      depth: () => this.depth,
      score: () => this.score,
      phase: () => this.phase,
      rotate: (rad: number) => {
        this.rotation += rad;
      },
      alignGap: () => {
        // rotate so a gap segment sits under the ball on the next ring
        const ring = this.rings[this.depth];
        if (!ring) return;
        const gapIdx = ring.segs.findIndex((v) => v === 0);
        if (gapIdx < 0) return;
        const segCenter = ((gapIdx + 0.5) / SEGMENTS) * Math.PI * 2;
        this.rotation = -Math.PI / 2 - segCenter;
      },
      alignDanger: () => {
        const ring = this.rings[this.depth];
        if (!ring) return;
        const idx = ring.segs.findIndex((v) => v === 2);
        if (idx < 0) return;
        const segCenter = ((idx + 0.5) / SEGMENTS) * Math.PI * 2;
        this.rotation = -Math.PI / 2 - segCenter;
      },
      restart: (next: boolean) => this.restart(next),
    };
  }

  private emit(): void {
    this.onHud({
      depth: this.depth,
      score: this.score,
      best: this.best,
      combo: this.combo,
      tower: this.tower,
      phase: this.phase,
    });
  }

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const dt = Math.min((t - this.lastT) / 1000, 0.04);
      if (this.phase === 'playing') this.step(dt);
      this.render(t);
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    this.ballVy += GRAVITY * dt;
    this.ballY += this.ballVy * dt;

    const ringScreenY = BALL_HOME_Y + RING_GAP; // the next ring sits one gap below home
    if (this.ballVy > 0 && this.ballY >= ringScreenY - 14) {
      const ring = this.rings[this.depth];
      if (!ring) {
        // tower cleared
        this.phase = 'won';
        if (this.score > this.best) {
          this.best = this.score;
          save('best', this.best);
        }
        pop();
        this.emit();
        return;
      }
      const seg = this.segUnderBall(ring);
      const v = ring.segs[seg]!;
      if (v === 0) {
        // fall through the gap: ring passes, combo grows
        this.depth++;
        this.combo++;
        this.score += 5 * this.combo;
        this.scrollY += RING_GAP;
        this.ballY -= RING_GAP; // keep ball at home height relative to next ring
        if (this.combo >= 3) this.burst(BALL_X, ringScreenY, '#ffd84d', 10);
        tap();
        this.emit();
      } else if (v === 2 && this.combo < 3) {
        // danger! (3+ combo = fire mode smashes danger too)
        this.phase = 'dead';
        this.burst(BALL_X, this.ballY, '#ff5a6e', 22);
        if (this.score > this.best) {
          this.best = this.score;
          save('best', this.best);
        }
        death();
        this.emit();
      } else {
        // bounce on safe (or smash danger while on fire)
        if (v === 2) {
          ring.segs[seg] = 0;
          this.score += 15;
          this.burst(BALL_X, ringScreenY, '#ff9a44', 12);
        }
        this.ballY = ringScreenY - 14;
        this.ballVy = BOUNCE_VY;
        if (this.combo > 0) {
          this.combo = 0;
          this.emit();
        }
        this.burst(BALL_X, ringScreenY - 6, 'rgba(255,255,255,0.8)', 4);
      }
    }
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, r: 1.5 + Math.random() * 3, color, life: 1 });
    }
  }

  private render(t: number): void {
    const { ctx, dpr } = this;
    const s = this.viewW / W;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

    const hue = HUES[(this.tower - 1) % HUES.length]!;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `hsl(${hue}, 45%, 12%)`);
    sky.addColorStop(1, `hsl(${(hue + 40) % 360}, 50%, 18%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // center pole
    ctx.fillStyle = `hsl(${hue}, 30%, 26%)`;
    ctx.fillRect(CX - 13, 0, 26, H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(CX - 13, 0, 8, H);

    // rings below the ball (draw far→near)
    for (let i = Math.min(this.rings.length - 1, this.depth + 5); i >= this.depth; i--) {
      const ring = this.rings[i]!;
      const y = BALL_HOME_Y + RING_GAP * (i - this.depth + 1);
      if (y > H + 60) continue;
      this.drawRing(ring, y, hue, i === this.depth);
    }

    // ball with squash + fire mode at combo ≥3
    const onFire = this.combo >= 3 && this.phase === 'playing';
    const squash = Math.max(0, Math.min(0.25, -this.ballVy / 2200));
    ctx.save();
    ctx.translate(BALL_X, this.ballY);
    ctx.scale(1 + squash, 1 - squash);
    if (onFire) {
      ctx.shadowColor = '#ff9a44';
      ctx.shadowBlur = 26;
    } else {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
    }
    const bg = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.4, onFire ? '#ffb347' : '#ff6ec4');
    bg.addColorStop(1, onFire ? '#e0651a' : '#c2399b');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -3, 3.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#33122a';
    ctx.beginPath();
    ctx.arc(-5, -2, 1.9, 0, Math.PI * 2);
    ctx.arc(5, -2, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // fire trail
    if (onFire && !this.reducedMotion()) {
      this.particles.push({
        x: BALL_X + (Math.random() - 0.5) * 10,
        y: this.ballY + 10,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1 + Math.random(),
        r: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ff9a44' : '#ffd84d',
        life: 0.7,
      });
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
      p.vy += 0.05;
      p.life -= 0.03;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;
  }

  private drawRing(ring: Ring, y: number, hue: number, isNext: boolean): void {
    const { ctx } = this;
    const depthFade = Math.max(0.35, 1 - (y - BALL_HOME_Y) / (H * 0.9));
    // draw back half first, then front half, for fake 3D
    for (const front of [false, true]) {
      for (let seg = 0; seg < SEGMENTS; seg++) {
        const v = ring.segs[seg]!;
        if (v === 0) continue;
        const a0 = (seg / SEGMENTS) * Math.PI * 2 + this.rotation;
        const a1 = ((seg + 1) / SEGMENTS) * Math.PI * 2 + this.rotation;
        const mid = (a0 + a1) / 2;
        const isFront = Math.sin(mid) < 0 ? false : true; // sin>0 = front (screen lower half of ellipse)
        if (isFront !== front) continue;
        const light = front ? 1 : 0.55;
        const color =
          v === 2
            ? `hsla(350, 80%, ${38 * light}%, ${depthFade})`
            : `hsla(${hue}, 70%, ${52 * light}%, ${depthFade})`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 16;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.ellipse(CX, y, RING_RX, RING_RY, 0, a0, a1);
        ctx.stroke();
        if (v === 2 && front) {
          // danger stripes
          ctx.strokeStyle = `rgba(20, 8, 14, ${depthFade})`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(CX, y, RING_RX, RING_RY, 0, a0 + 0.07, a0 + 0.14);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(CX, y, RING_RX, RING_RY, 0, (a0 + a1) / 2, (a0 + a1) / 2 + 0.07);
          ctx.stroke();
        }
      }
    }
    if (isNext) {
      // subtle highlight ellipse under the ball's landing spot
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(CX, y, RING_RX + 12, RING_RY + 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export const HELIX_SCENE = { W, H };
