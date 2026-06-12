/**
 * Helix Twist — Helix Jump inverted: the ball falls in place,
 * YOU spin the tower under it by dragging. Line up the gaps.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { sfxFall, sfxBounce, sfxFireIgnite, sfxDeath, sfxWin, sfxStart } from '../lib/sfx';

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
const STEP = 1000 / 60;

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
  phase: 'ready' | 'playing' | 'dead' | 'won';
}

export class HelixGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;
  private viewH = H;

  private rings: Ring[] = [];
  private towerLen = 30;
  private tower: number;
  private rotation = 0;          // tower rotation (radians)
  private depth = 0;             // rings passed
  private scrollY = 0;           // smooth scroll offset
  private ballY = BALL_HOME_Y;
  private ballVy = 0;
  private combo = 0;
  private prevOnFire = false;
  private score = 0;
  private best: number;
  private phase: 'ready' | 'playing' | 'dead' | 'won' = 'ready';
  private shake = 0;
  private hitstopUntil = 0;
  private acc = 0;
  private particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }[] = [];
  private dragX: number | null = null;
  private lastT = 0;
  private rafId = 0;
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
    this.viewH = h;
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

  start(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'playing';
    sfxStart();
    this.emit();
  }

  dragStart(x: number): void {
    this.dragX = x;
  }

  dragMove(x: number): void {
    if (this.dragX === null || (this.phase !== 'playing' && this.phase !== 'ready')) return;
    this.rotation += (x - this.dragX) * 0.012;
    this.dragX = x;
  }

  dragEnd(): void {
    this.dragX = null;
  }

  rotateKey(rad: number): void {
    if (this.phase !== 'playing') return;
    this.rotation += rad;
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
    this.prevOnFire = false;
    this.rotation = 0;
    this.shake = 0;
    this.particles = [];
    this.phase = 'playing';
    this.buildTower();
    sfxStart();
    this.emit();
  }

  private buildTower(): void {
    this.rings = [];
    this.towerLen = 26 + this.tower * 4;
    const dangerChance = Math.min(0.34, 0.1 + this.tower * 0.035);
    for (let i = 0; i < this.towerLen; i++) {
      const segs = new Array<number>(SEGMENTS).fill(1);
      const gapLen = 3 + (Math.random() < 0.4 ? 1 : 0);
      const gapStart = Math.floor(Math.random() * SEGMENTS);
      for (let g = 0; g < gapLen; g++) segs[(gapStart + g) % SEGMENTS] = 0;
      if (i > 1) {
        for (let s = 0; s < SEGMENTS; s++) {
          if (segs[s] === 1 && Math.random() < dangerChance) segs[s] = 2;
        }
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

  /** which segment of ring is under the ball */
  private segUnderBall(_ring: Ring): number {
    const a = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor((a / (Math.PI * 2)) * SEGMENTS) % SEGMENTS;
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__helix'] = {
      depth: () => this.depth,
      score: () => this.score,
      phase: () => this.phase,
      start: () => this.start(),
      rotate: (rad: number) => { this.rotation += rad; },
      alignGap: () => {
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
      const scale = Date.now() < this.hitstopUntil ? 0.05 : 1;
      this.acc += Math.min(t - this.lastT, 100) * scale;
      while (this.acc >= STEP) {
        if (this.phase === 'playing') this.step(STEP / 1000);
        // particles always decay
        this.decayParticles(STEP / 1000);
        this.shake = Math.max(0, this.shake - (STEP / 1000) * 12);
        this.acc -= STEP;
      }
      this.render(t);
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private decayParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= dt * 1.8;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private step(dt: number): void {
    this.ballVy += GRAVITY * dt;
    this.ballY += this.ballVy * dt;

    const ringScreenY = BALL_HOME_Y + RING_GAP;
    if (this.ballVy > 0 && this.ballY >= ringScreenY - 14) {
      const ring = this.rings[this.depth];
      if (!ring) {
        this.phase = 'won';
        if (this.score > this.best) {
          this.best = this.score;
          save('best', this.best);
        }
        sfxWin();
        pop();
        this.emit();
        return;
      }
      const seg = this.segUnderBall(ring);
      const v = ring.segs[seg]!;
      if (v === 0) {
        // fall through gap
        this.depth++;
        this.combo++;
        this.score += 5 * this.combo;
        this.scrollY += RING_GAP;
        this.ballY -= RING_GAP;
        sfxFall(this.combo);
        const onFire = this.combo >= 3;
        if (onFire && !this.prevOnFire) sfxFireIgnite();
        this.prevOnFire = onFire;
        if (this.combo >= 3) this.burst(BALL_X, ringScreenY, '#ffd84d', 12);
        tap();
        this.emit();
      } else if (v === 2 && this.combo < 3) {
        // danger death
        this.phase = 'dead';
        this.burst(BALL_X, this.ballY, '#ff5a6e', 24);
        if (this.score > this.best) {
          this.best = this.score;
          save('best', this.best);
        }
        sfxDeath();
        death();
        if (!this.reducedMotion()) {
          this.shake = 1.4;
          this.hitstopUntil = Date.now() + 70;
        }
        this.emit();
      } else {
        // bounce (safe or fire-smash danger)
        if (v === 2) {
          ring.segs[seg] = 0;
          this.score += 15;
          this.burst(BALL_X, ringScreenY, '#ff9a44', 14);
          if (!this.reducedMotion()) {
            this.hitstopUntil = Date.now() + 40;
          }
        }
        this.ballY = ringScreenY - 14;
        this.ballVy = BOUNCE_VY;
        this.prevOnFire = false;
        if (this.combo > 0) {
          this.combo = 0;
          this.emit();
        }
        sfxBounce();
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
    const heightScale = this.viewH / H;
    const scale = Math.min(s, heightScale);
    const offsetX = (this.viewW - W * scale) / 2;
    const offsetY = (this.viewH - H * scale) / 2;

    const shx = this.shake > 0 ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ——— decorated gutters (tower hue gradient on sides) ———
    const hue = HUES[(this.tower - 1) % HUES.length]!;
    const gutter = ctx.createLinearGradient(0, 0, 0, this.viewH);
    gutter.addColorStop(0, `hsl(${hue}, 40%, 9%)`);
    gutter.addColorStop(0.5, `hsl(${(hue + 30) % 360}, 35%, 13%)`);
    gutter.addColorStop(1, `hsl(${hue}, 40%, 8%)`);
    ctx.fillStyle = gutter;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // vignette on gutters
    if (offsetX > 2) {
      const vigL = ctx.createLinearGradient(0, 0, offsetX + 30, 0);
      vigL.addColorStop(0, 'rgba(0,0,0,0.6)');
      vigL.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vigL;
      ctx.fillRect(0, 0, offsetX + 30, this.viewH);

      const vigR = ctx.createLinearGradient(this.viewW, 0, this.viewW - offsetX - 30, 0);
      vigR.addColorStop(0, 'rgba(0,0,0,0.6)');
      vigR.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vigR;
      ctx.fillRect(this.viewW - offsetX - 30, 0, offsetX + 30, this.viewH);
    }

    // scene transform
    ctx.save();
    ctx.translate(offsetX + shx, offsetY + shy);
    ctx.scale(scale, scale);

    // scene background
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

    // ball with squash + fire mode at combo >=3
    const onFire = this.combo >= 3 && this.phase === 'playing';
    const squash = Math.max(0, Math.min(0.25, -this.ballVy / 2200));
    ctx.save();
    ctx.translate(BALL_X, this.ballY);
    ctx.scale(1 + squash * 0.3, 1 - squash * 0.3);
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
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    void t; // suppress unused var warning
  }

  private drawRing(ring: Ring, y: number, hue: number, isNext: boolean): void {
    const { ctx } = this;
    const depthFade = Math.max(0.35, 1 - (y - BALL_HOME_Y) / (H * 0.9));
    for (const front of [false, true]) {
      for (let seg = 0; seg < SEGMENTS; seg++) {
        const v = ring.segs[seg]!;
        if (v === 0) continue;
        const a0 = (seg / SEGMENTS) * Math.PI * 2 + this.rotation;
        const a1 = ((seg + 1) / SEGMENTS) * Math.PI * 2 + this.rotation;
        const mid = (a0 + a1) / 2;
        const isFront = Math.sin(mid) >= 0;
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
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(CX, y, RING_RX + 12, RING_RY + 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export const HELIX_SCENE = { W, H };
