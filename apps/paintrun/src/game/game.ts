/**
 * Paint Rush — auto-runner that paints the floor.
 * Steer through color gates; only matching-color floor gets painted.
 * Finish-line paint % = stars.
 */
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { sfxGate, sfxCrash, sfxFinish, sfxTick, sfxStart, sfxClick } from '../lib/sfx';

const W = 390;
const H = 700;
const LANE_W = 300;
const LANE_X = (W - LANE_W) / 2;
const RUN_SPEED = 300;        // world px/s scrolling down
const STEER = 520;            // px/s lateral
const TRACK_LEN = 7200;       // one level length
const CELL = 30;              // paint grid cell
const COLS = LANE_W / CELL;   // 10
const STEP = 1000 / 60;

export const PAINTS = [
  { name: 'pink', main: '#ff4ecd', deep: '#cc30a0' },
  { name: 'cyan', main: '#36d6ff', deep: '#1ca3cc' },
  { name: 'lime', main: '#a8e34d', deep: '#7eb52e' },
];

interface Gate { y: number; halves: [number, number]; passed: boolean }
interface Blocker { y: number; x: number; w: number }

export interface PaintHud {
  pct: number;
  level: number;
  best: number;
  color: number;
  phase: 'ready' | 'playing' | 'crashed' | 'finished';
  stars: number;
}

export class PaintGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;
  private viewH = H;
  private sceneScale = 1;   // scale to fit scene into viewport
  private sceneOffX = 0;    // horizontal centering offset

  private px = W / 2;          // player x (scene coords)
  private worldY = 0;          // distance run
  private targetX: number | null = null;
  private color = 0;
  private level: number;
  private best: number;
  private paint = new Map<number, number>(); // cellIndex → paint color idx
  private gates: Gate[] = [];
  private blockers: Blocker[] = [];
  private phase: 'ready' | 'playing' | 'crashed' | 'finished' = 'ready';
  private splats: { x: number; y: number; r: number; color: string; life: number }[] = [];
  private floats: { x: number; y: number; text: string; life: number }[] = [];
  private shake = 0;
  private hitstopUntil = 0;
  private acc = 0;
  private lastT = 0;
  private rafId = 0;
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
    this.viewH = h;
    // Scale scene to fit height; center horizontally
    this.sceneScale = Math.min(w / W, h / H);
    this.sceneOffX = (w - W * this.sceneScale) / 2;
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

  start(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'playing';
    sfxStart();
    sfxClick();
    this.emit();
  }

  steerTo(screenX: number | null): void {
    if (screenX === null) { this.targetX = null; return; }
    // map screen X → scene X
    this.targetX = (screenX - this.sceneOffX) / this.sceneScale;
  }

  steerKey(direction: 'left' | 'right' | null): void {
    if (direction === null) { this.targetX = null; return; }
    this.targetX = direction === 'left' ? LANE_X + 16 : LANE_X + LANE_W - 16;
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
    this.floats = [];
    this.shake = 0;
    this.phase = 'playing';
    this.buildTrack();
    sfxStart();
    this.emit();
  }

  private buildTrack(): void {
    this.gates = [];
    this.blockers = [];
    for (let y = 600; y < TRACK_LEN - 400; y += 650 + Math.random() * 220) {
      const a = Math.floor(Math.random() * PAINTS.length);
      let b = Math.floor(Math.random() * PAINTS.length);
      if (b === a) b = (a + 1) % PAINTS.length;
      this.gates.push({ y, halves: [a, b], passed: false });
    }
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
      start: () => this.start(),
      steer: (frac: number) => { this.px = LANE_X + frac * LANE_W; },
      finish: () => { this.worldY = TRACK_LEN - 60; },
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
    sfxCrash();
    death();
    if (!this.reducedMotion()) {
      this.shake = 1.2;
      this.hitstopUntil = Date.now() + 70;
    }
    this.emit();
  }

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const scale = Date.now() < this.hitstopUntil ? 0.05 : 1;
      this.acc += Math.min(t - this.lastT, 100) * scale;
      while (this.acc >= STEP) {
        this.stepFixed(STEP / 1000);
        this.acc -= STEP;
      }
      this.render();
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private stepFixed(dt: number): void {
    if (this.phase === 'playing') this.step(dt);
    // decay effects always
    for (const f of this.floats) f.life -= dt * 1.1;
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 10);
  }

  private step(dt: number): void {
    this.worldY += RUN_SPEED * dt;
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
          sfxGate();
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
      sfxFinish();
      pop();
      this.emit();
    }

    if (Math.floor(this.worldY) % 120 < 6) this.emit();
  }

  private splat(x: number, color: string): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < 12; i++) {
      this.splats.push({
        x: x + (Math.random() - 0.5) * 60,
        y: 560 + (Math.random() - 0.5) * 50,
        r: 4 + Math.random() * 10,
        color,
        life: 1,
      });
    }
  }

  // expose for score countup tick sound
  sfxTick = sfxTick;

  private render(): void {
    const { ctx, dpr } = this;
    const sc = this.sceneScale;
    const ox = this.sceneOffX;
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 4 * this.shake : 0;

    // draw at base DPR (no extra scale here — scene transform handles it)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ——— full-viewport decorated gutters (track gradient + paint splats) ———
    const gutterGrad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    gutterGrad.addColorStop(0, '#1a0a2e');
    gutterGrad.addColorStop(0.5, '#2a1050');
    gutterGrad.addColorStop(1, '#1a0828');
    ctx.fillStyle = gutterGrad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // gutter paint splat artwork
    this.drawGutterSplats(ox, this.viewW, this.viewH);

    // ——— now draw the scene with letterbox transform ———
    ctx.save();
    ctx.translate(ox + shx, shy);
    ctx.scale(sc, sc);

    const playerScreenY = 560;
    const topWorld = this.worldY - playerScreenY;

    // scene background
    ctx.fillStyle = '#14122b';
    ctx.fillRect(0, 0, W, H);

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
        ctx.globalAlpha = 0.82;
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
      sp.life -= 0.02;
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
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(this.px, playerScreenY, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
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

    // float texts
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = "800 18px 'Baloo 2 Variable', cursive";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ff4ecd';
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 40);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore(); // end scene transform
  }

  private _gutterSeed = Math.random() * 1000;
  private drawGutterSplats(sceneOffX: number, viewW: number, viewH: number): void {
    const { ctx } = this;
    const colors = PAINTS.map((p) => p.main);
    ctx.save();
    const seed = this._gutterSeed;
    const leftGW = sceneOffX;
    const rightStart = sceneOffX + W * this.sceneScale;
    const rightGW = viewW - rightStart;
    for (let i = 0; i < 16; i++) {
      const inLeft = i % 2 === 0;
      const gw = inLeft ? leftGW : rightGW;
      if (gw < 8) continue;
      const x = inLeft
        ? 6 + ((seed * (i + 1) * 7.3) % Math.max(1, gw - 12))
        : rightStart + 6 + ((seed * (i + 1) * 5.7) % Math.max(1, rightGW - 12));
      const y = (((seed * (i + 1) * 13.1) % 1) + i / 16) * viewH;
      const r = 8 + ((seed * (i + 1) * 3.3) % 24);
      const colorIdx = i % colors.length;
      ctx.globalAlpha = 0.15 + ((seed * (i * 2.9)) % 0.20);
      ctx.fillStyle = colors[colorIdx]!;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export const PAINT_SCENE = { W, H };
