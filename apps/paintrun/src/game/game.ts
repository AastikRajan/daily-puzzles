/**
 * Paint Rush — auto-runner that paints the floor. Steer through color gates;
 * only matching-color floor gets painted. Finish-line paint % = stars.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';

const W = 390;
const H = 700;
const LANE_W = 300;
const LANE_X = (W - LANE_W) / 2;
const RUN_SPEED = 300;        // world px/s scrolling down
const STEER = 520;            // px/s lateral
const TRACK_LEN = 7200;       // one level length
const CELL = 30;              // paint grid cell
const COLS = LANE_W / CELL;   // 10

export const PAINTS = [
  { name: 'pink', main: '#ff4ecd', deep: '#cc30a0' },
  { name: 'cyan', main: '#36d6ff', deep: '#1ca3cc' },
  { name: 'lime', main: '#a8e34d', deep: '#7eb52e' },
];

interface Gate { y: number; halves: [number, number]; passed: boolean } // paint index per half
interface Blocker { y: number; x: number; w: number }

export interface PaintHud {
  pct: number;
  level: number;
  best: number;
  color: number;
  phase: 'playing' | 'crashed' | 'finished';
  stars: number;
}

export class PaintGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;

  private px = W / 2;          // player x (screen)
  private worldY = 0;          // distance run
  private targetX: number | null = null;
  private color = 0;
  private level: number;
  private best: number;
  private paint = new Map<number, number>(); // cellIndex → paint color idx
  private gates: Gate[] = [];
  private blockers: Blocker[] = [];
  private phase: 'playing' | 'crashed' | 'finished' = 'playing';
  private splats: { x: number; y: number; r: number; color: string; life: number }[] = [];
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: PaintHud) => void;
  private reducedMotion: () => boolean;

  constructor(canvas: HTMLCanvasElement, onHud: (h: PaintHud) => void, reducedMotion: () => boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.level = load<number>('level', 1);
    this.best = load<number>('best-pct', 0);
    this.buildTrack();
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
    delete (window as unknown as Record<string, unknown>)['__paint'];
  }

  steerTo(screenX: number | null): void {
    this.targetX = screenX;
  }

  restart(nextLevel: boolean): void {
    if (nextLevel) {
      this.level++;
      save('level', this.level);
    }
    this.px = W / 2;
    this.worldY = 0;
    this.color = 0;
    this.paint.clear();
    this.splats = [];
    this.phase = 'playing';
    this.buildTrack();
    this.emit();
  }

  private buildTrack(): void {
    this.gates = [];
    this.blockers = [];
    // gates every ~700px; halves get two different paints
    for (let y = 600; y < TRACK_LEN - 400; y += 650 + Math.random() * 220) {
      const a = Math.floor(Math.random() * PAINTS.length);
      let b = Math.floor(Math.random() * PAINTS.length);
      if (b === a) b = (a + 1) % PAINTS.length;
      this.gates.push({ y, halves: [a, b], passed: false });
    }
    // blockers (crash!) between gates, more with level
    const nBlockers = Math.min(4 + this.level, 12);
    for (let i = 0; i < nBlockers; i++) {
      const y = 900 + Math.random() * (TRACK_LEN - 1600);
      const w = 70 + Math.random() * 80;
      this.blockers.push({ y, x: LANE_X + Math.random() * (LANE_W - w), w });
    }
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__paint'] = {
      pct: () => this.pct(),
      phase: () => this.phase,
      level: () => this.level,
      steer: (frac: number) => {
        this.px = LANE_X + frac * LANE_W;
      },
      finish: () => {
        this.worldY = TRACK_LEN - 60;
      },
      crash: () => this.crash(),
      restart: (next: boolean) => this.restart(next),
    };
  }

  private pct(): number {
    const totalCells = Math.floor(TRACK_LEN / CELL) * COLS;
    return Math.round((this.paint.size / totalCells) * 100);
  }

  private emit(): void {
    const pct = this.pct();
    this.onHud({
      pct,
      level: this.level,
      best: this.best,
      color: this.color,
      phase: this.phase,
      stars: pct >= 75 ? 3 : pct >= 55 ? 2 : pct >= 35 ? 1 : 0,
    });
  }

  private crash(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'crashed';
    death();
    this.emit();
  }

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const dt = Math.min((t - this.lastT) / 1000, 0.04);
      if (this.phase === 'playing') this.step(dt);
      this.render();
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    this.worldY += RUN_SPEED * dt;
    // steer toward pointer
    if (this.targetX !== null) {
      const diff = this.targetX - this.px;
      const m = Math.min(Math.abs(diff), STEER * dt);
      this.px += Math.sign(diff) * m;
    }
    this.px = Math.max(LANE_X + 16, Math.min(LANE_X + LANE_W - 16, this.px));

    // paint the cells under the roller (3 cells wide)
    const row = Math.floor(this.worldY / CELL);
    const col = Math.floor((this.px - LANE_X) / CELL);
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      if (c < 0 || c >= COLS) continue;
      this.paint.set(row * COLS + c, this.color);
    }

    // gates
    for (const g of this.gates) {
      if (!g.passed && Math.abs(g.y - this.worldY) < 14) {
        g.passed = true;
        const half = this.px < W / 2 ? 0 : 1;
        const next = g.halves[half]!;
        if (next !== this.color) {
          this.color = next;
          this.splat(this.px, PAINTS[next]!.main);
          tap();
        }
        this.emit();
      }
    }

    // blockers
    for (const b of this.blockers) {
      if (Math.abs(b.y - this.worldY) < 18 && this.px > b.x - 14 && this.px < b.x + b.w + 14) {
        this.crash();
        return;
      }
    }

    // finish line
    if (this.worldY >= TRACK_LEN) {
      this.phase = 'finished';
      const pct = this.pct();
      if (pct > this.best) {
        this.best = pct;
        save('best-pct', this.best);
      }
      pop();
      this.emit();
    }

    if (Math.floor(this.worldY) % 120 < 6) this.emit();
  }

  private splat(x: number, color: string): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < 10; i++) {
      this.splats.push({
        x: x + (Math.random() - 0.5) * 50,
        y: 560 + (Math.random() - 0.5) * 40,
        r: 4 + Math.random() * 8,
        color,
        life: 1,
      });
    }
  }

  private render(): void {
    const { ctx, dpr } = this;
    const s = this.viewW / W;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);

    // backdrop
    ctx.fillStyle = '#14122b';
    ctx.fillRect(0, 0, W, H);

    const playerScreenY = 560;
    const topWorld = this.worldY - playerScreenY; // worldY at screen top... lane scrolls down

    // lane base
    ctx.fillStyle = '#211e3e';
    ctx.fillRect(LANE_X, 0, LANE_W, H);

    // painted cells (visible rows)
    const firstRow = Math.floor(topWorld / CELL) - 1;
    const lastRow = Math.floor((topWorld + H) / CELL) + 1;
    for (let r = firstRow; r <= lastRow; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.paint.get(r * COLS + c);
        if (p === undefined) continue;
        const sy = r * CELL - topWorld;
        ctx.fillStyle = PAINTS[p]!.main;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(LANE_X + c * CELL, sy, CELL + 0.5, CELL + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // lane edges
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(LANE_X, -4, LANE_W, H + 8);

    // gates
    for (const g of this.gates) {
      const sy = g.y - topWorld;
      if (sy < -40 || sy > H + 40) continue;
      for (const half of [0, 1] as const) {
        const p = PAINTS[g.halves[half]]!;
        const x = LANE_X + half * (LANE_W / 2);
        ctx.fillStyle = p.main;
        ctx.globalAlpha = g.passed ? 0.25 : 0.9;
        ctx.fillRect(x, sy - 9, LANE_W / 2, 18);
        ctx.globalAlpha = 1;
        if (!g.passed) {
          ctx.fillStyle = '#fff';
          ctx.font = "800 12px 'Nunito Variable', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(p.name.toUpperCase(), x + LANE_W / 4, sy + 4);
        }
      }
    }

    // blockers
    for (const b of this.blockers) {
      const sy = b.y - topWorld;
      if (sy < -40 || sy > H + 40) continue;
      ctx.fillStyle = '#0c0a1c';
      ctx.strokeStyle = '#ff5a6e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(b.x, sy - 14, b.w, 28, 8);
      ctx.fill();
      ctx.stroke();
      // warning stripes
      ctx.strokeStyle = 'rgba(255, 90, 110, 0.6)';
      ctx.lineWidth = 4;
      for (let x = b.x + 8; x < b.x + b.w - 4; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, sy + 10);
        ctx.lineTo(x + 8, sy - 10);
        ctx.stroke();
      }
    }

    // finish line
    const finishY = TRACK_LEN - topWorld;
    if (finishY > -40 && finishY < H + 40) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = c % 2 === 0 ? '#fff' : '#1a1830';
        ctx.fillRect(LANE_X + c * CELL, finishY - 10, CELL, 20);
      }
    }

    // splats
    for (const sp of this.splats) {
      ctx.globalAlpha = Math.max(0, sp.life) * 0.8;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
      sp.life -= 0.03;
    }
    this.splats = this.splats.filter((sp) => sp.life > 0);
    ctx.globalAlpha = 1;

    // player — paint roller blob
    if (this.phase !== 'crashed') {
      const p = PAINTS[this.color]!;
      const pg = ctx.createRadialGradient(this.px - 4, playerScreenY - 4, 2, this.px, playerScreenY, 17);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.35, p.main);
      pg.addColorStop(1, p.deep);
      ctx.fillStyle = pg;
      ctx.shadowColor = p.main;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(this.px, playerScreenY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.px - 5, playerScreenY - 4, 3.6, 0, Math.PI * 2);
      ctx.arc(this.px + 5, playerScreenY - 4, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1230';
      ctx.beginPath();
      ctx.arc(this.px - 5, playerScreenY - 3, 1.9, 0, Math.PI * 2);
      ctx.arc(this.px + 5, playerScreenY - 3, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const PAINT_SCENE = { W, H };
