/**
 * Nom Hole — hungry hole arcade game engine.
 * One rAF loop owned by the class for its entire lifetime.
 */
import { tap, gulp, roundEnd } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { sfxGulp, sfxRoundEnd, sfxStart } from '../lib/sfx';

// ——— constants ———
export const WORLD = 1600;
const ROUND_SEC = 75;
const HOLE_SPEED = 180;        // px/s
const HOLE_START_R = 22;
const HOLE_MAX_R = 70;
const COMBO_WINDOW = 1500;     // ms
const EAT_ANIM_MS = 300;
const TOTAL_OBJECTS = 80; // 24+20+14+10+7+5

// City object tiers — radius, score²
const TIER_DEFS: { r: number; label: string; colors: string[] }[] = [
  /* 1 */ { r: 8,  label: 'hydrant/cone',  colors: ['#ff3a3a','#ff8c00','#ffcc00','#e63946'] },
  /* 2 */ { r: 13, label: 'bench/mailbox', colors: ['#4e9fff','#00b4d8','#8338ec','#06d6a0'] },
  /* 3 */ { r: 20, label: 'car',           colors: ['#e63946','#06d6a0','#ffbe0b','#8338ec','#3a86ff','#fb5607'] },
  /* 4 */ { r: 28, label: 'truck/tree',    colors: ['#2d6a4f','#40916c','#1b4332','#e76f51','#264653','#457b9d'] },
  /* 5 */ { r: 38, label: 'building',      colors: ['#6b4226','#9b5de5','#f15bb5','#00bbf9','#fee440','#00f5d4'] },
  /* 6 */ { r: 52, label: 'tower',         colors: ['#3d405b','#e07a5f','#81b29a','#f2cc8f','#6d6875','#b5838d'] },
];

// Minimal seeded random (xoshiro128** substitute — good enough for layout)
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 13), 0x45d9f3b);
    s ^= s >>> 7;
    s = Math.imul(s ^ (s >>> 17), 0x9e3779b9);
    s ^= s >>> 16;
    return ((s >>> 0) / 0xffffffff);
  };
}

export interface CityObject {
  id: number;
  x: number;
  y: number;
  tier: number;    // 1-6
  r: number;
  color: string;
  alive: boolean;
  /** eating animation: 0=none, progress 0..1 during eat anim */
  eatProgress: number;
  eatStartAt: number;
  /** spiral angle accumulator */
  eatAngle: number;
  /** original position before spiral */
  ox: number;
  oy: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; color: string;
  life: number; // 0..1
}

interface FloatText {
  x: number; y: number;
  text: string;
  life: number; // 0..1
}

export interface HudState {
  score: number;
  best: number;
  timeLeft: number; // seconds, ceil
  combo: number;
  phase: 'ready' | 'playing' | 'over';
  eaten: number;
  total: number;
}

// ——— main class ———

export class NomHoleGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = 390;
  private viewH = 844;
  private zoom = 1;

  private holeX = WORLD / 2;
  private holeY = WORLD / 2;
  private holeR = HOLE_START_R;

  private objects: CityObject[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];

  private score = 0;
  private best: number;
  private combo = 0;
  private lastEatAt = 0;   // rAF timestamp
  private eaten = 0;

  private timeLeft = ROUND_SEC; // seconds (float, counts down)
  private phase: 'ready' | 'playing' | 'over' = 'ready';

  private pointer: { x: number; y: number } | null = null;
  private pulse = 0; // screen pulse 0..1

  private lastT = 0;
  private rafId = 0;
  private destroyed = false;

  private hitstopUntil = 0;

  private onHud: (h: HudState) => void;
  private reducedMotion: () => boolean;

  // swirl angle for hole rendering
  private swirlAngle = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: HudState) => void,
    reducedMotion: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.buildCity(Math.random());
    this.setupDebug();
    this.emitHud();
    this.rafId = requestAnimationFrame((t) => {
      this.lastT = t;
      this.loop(t);
    });
  }

  resize(w: number, h: number, canvas: HTMLCanvasElement): void {
    this.viewW = w;
    this.viewH = h;
    this.zoom = Math.max(0.9, Math.min(w, h) / 800);
    canvas.width = w * this.dpr;
    canvas.height = h * this.dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  setPointer(p: { x: number; y: number } | null): void {
    this.pointer = p;
  }

  /** Transition ready → playing */
  start(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'playing';
    sfxStart();
    this.emitHud();
  }

  restart(): void {
    this.holeX = WORLD / 2;
    this.holeY = WORLD / 2;
    this.holeR = HOLE_START_R;
    this.score = 0;
    this.combo = 0;
    this.lastEatAt = 0;
    this.eaten = 0;
    this.timeLeft = ROUND_SEC;
    this.phase = 'playing';
    this.particles = [];
    this.floats = [];
    this.pulse = 0;
    this.pointer = null;
    this.hitstopUntil = 0;
    this.buildCity(Math.random());
    this.emitHud();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__nomhole'];
  }

  // ——— city builder ———

  private buildCity(seed: number): void {
    const rng = makeRng((seed * 0xffffffff) | 0);
    this.objects = [];
    let id = 0;

    // Distribute objects so tiers 1-2 are plentiful, 5-6 are rare
    const distribution = [24, 20, 14, 10, 7, 5]; // tiers 1-6, total 80
    const margin = 100;
    // Objects placed on a loose grid with jitter, ensuring spread across world
    // and some objects close to starting position (so you see them immediately)

    for (let tier = 1; tier <= 6; tier++) {
      const count = distribution[tier - 1]!;
      const def = TIER_DEFS[tier - 1]!;
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0;
        let attempts = 0;
        // First few objects of each tier are placed near camera start
        // so the city is visually rich from the first frame
        const nearCenter = i < 3;
        const cx = WORLD / 2;
        const cy = WORLD / 2;
        do {
          if (nearCenter && attempts < 15) {
            // Place within 300-600px of center (visible but not on top of hole)
            const angle = rng() * Math.PI * 2;
            const dist = 140 + rng() * 380;
            x = cx + Math.cos(angle) * dist;
            y = cy + Math.sin(angle) * dist;
          } else {
            x = margin + rng() * (WORLD - margin * 2);
            y = margin + rng() * (WORLD - margin * 2);
          }
          attempts++;
        } while (
          attempts < 40 &&
          (
            // avoid directly on top of hole start
            Math.hypot(x - cx, y - cy) < 80 ||
            // avoid collision with existing objects
            this.objects.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + def.r + 12)
          )
        );

        // Clamp to world bounds
        x = Math.max(margin, Math.min(WORLD - margin, x));
        y = Math.max(margin, Math.min(WORLD - margin, y));

        const colors = def.colors;
        const color = colors[Math.floor(rng() * colors.length)]!;
        this.objects.push({
          id: id++,
          x, y, ox: x, oy: y,
          tier,
          r: def.r,
          color,
          alive: true,
          eatProgress: 0,
          eatStartAt: 0,
          eatAngle: 0,
        });
      }
    }
  }

  // ——— debug/test API ———

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__nomhole'] = {
      score: () => this.score,
      radius: () => this.holeR,
      phase: () => this.phase,
      endRound: () => {
        if (this.phase === 'playing') {
          this.timeLeft = 0;
          this.finishRound();
        }
      },
      restart: () => this.restart(),
      start: () => this.start(),
      eatNearest: () => {
        if (this.phase !== 'playing') return;
        // Find nearest eatable (alive, r <= holeR) and teleport hole onto it
        let best: CityObject | null = null;
        let bestDist = Infinity;
        for (const obj of this.objects) {
          if (!obj.alive || obj.eatProgress > 0) continue;
          if (obj.r > this.holeR) continue;
          const d = Math.hypot(obj.x - this.holeX, obj.y - this.holeY);
          if (d < bestDist) {
            bestDist = d;
            best = obj;
          }
        }
        if (best) {
          this.holeX = best.x;
          this.holeY = best.y;
          this.startEat(best, performance.now());
        }
      },
    };
  }

  // ——— core loop (rAF-owned, never recreated) ———

  private loop = (t: number): void => {
    if (this.destroyed) return;
    const scale = Date.now() < this.hitstopUntil ? 0.05 : 1;
    const dt = Math.min((t - this.lastT) / 1000, 0.1) * scale; // seconds, capped
    this.lastT = t;

    if (document.visibilityState === 'visible') {
      this.step(dt, t);
      this.render(t);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number, t: number): void {
    if (this.phase === 'playing') {
      // timer
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finishRound();
        return;
      }

      // move hole toward pointer
      if (this.pointer) {
        const dx = this.pointer.x - this.holeX;
        const dy = this.pointer.y - this.holeY;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const move = Math.min(HOLE_SPEED * dt, dist);
          this.holeX += (dx / dist) * move;
          this.holeY += (dy / dist) * move;
        }
      }

      // clamp hole to world
      this.holeX = Math.max(this.holeR, Math.min(WORLD - this.holeR, this.holeX));
      this.holeY = Math.max(this.holeR, Math.min(WORLD - this.holeR, this.holeY));

      // eat objects
      for (const obj of this.objects) {
        if (!obj.alive || obj.eatProgress > 0) continue;
        if (obj.r > this.holeR) continue;
        const dist = Math.hypot(obj.x - this.holeX, obj.y - this.holeY);
        if (dist < this.holeR) {
          this.startEat(obj, t);
        }
      }

      // combo decay
      if (this.combo > 0 && t - this.lastEatAt > COMBO_WINDOW) {
        this.combo = 0;
        this.emitHud();
      }

      this.emitHud();
    }

    // animate eating objects (runs in all phases for smooth anim after phase change)
    for (const obj of this.objects) {
      if (obj.eatProgress <= 0 || !obj.alive) continue;
      const elapsed = t - obj.eatStartAt;
      obj.eatProgress = Math.min(elapsed / EAT_ANIM_MS, 1);
      obj.eatAngle += dt * 12; // spiral spin
      if (obj.eatProgress >= 1) {
        obj.alive = false;
        obj.eatProgress = 0;
      }
    }

    // particles
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt * 2;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // float texts
    for (const f of this.floats) f.life -= dt * 1.2;
    this.floats = this.floats.filter((f) => f.life > 0);

    // pulse decay
    this.pulse = Math.max(0, this.pulse - dt * 5);

    // swirl animation (always runs so hole looks alive in ready phase too)
    this.swirlAngle += dt * 2.5;
  }

  private startEat(obj: CityObject, t: number): void {
    obj.eatProgress = 0.001;
    obj.eatStartAt = t;
    obj.eatAngle = 0;
    obj.ox = obj.x;
    obj.oy = obj.y;

    const tier = obj.tier;
    const points = tier * tier;

    // combo check
    if (t - this.lastEatAt < COMBO_WINDOW) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastEatAt = t;

    const finalPoints = points * (this.combo > 1 ? this.combo : 1);
    this.score += finalPoints;
    if (this.score > this.best) {
      this.best = this.score;
      save('best', this.best);
    }

    this.eaten++;

    // grow hole
    const grow = tier * 0.8;
    this.holeR = Math.min(HOLE_MAX_R, this.holeR + grow);

    // hitstop for big objects
    if (tier >= 5) this.hitstopUntil = Date.now() + 45;

    // pulse
    this.pulse = 0.6 + tier * 0.06;

    // haptic
    tap();
    if (tier >= 4) gulp();

    // SFX
    sfxGulp(tier, this.combo);

    // burst particles
    if (!this.reducedMotion()) {
      this.burst(obj.x, obj.y, obj.color, 6 + tier * 2);
    }

    // float text
    const label = this.combo > 1
      ? `+${finalPoints} ×${this.combo}!`
      : `+${finalPoints}`;
    this.floats.push({ x: obj.x, y: obj.y - 20, text: label, life: 1 });
  }

  private finishRound(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    roundEnd();
    sfxRoundEnd();
    this.emitHud();
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 2 + Math.random() * 3,
        color,
        life: 1,
      });
    }
  }

  private emitHud(): void {
    this.onHud({
      score: this.score,
      best: this.best,
      timeLeft: Math.ceil(this.timeLeft),
      combo: this.combo,
      phase: this.phase,
      eaten: this.eaten,
      total: TOTAL_OBJECTS,
    });
  }

  /** screen→world coordinate conversion (accounts for zoom) */
  toWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.camera();
    return { x: sx / this.zoom + cam.x, y: sy / this.zoom + cam.y };
  }

  private camera(): { x: number; y: number } {
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    return {
      x: Math.max(0, Math.min(WORLD - vw, this.holeX - vw / 2)),
      y: Math.max(0, Math.min(WORLD - vh, this.holeY - vh / 2)),
    };
  }

  // ——— rendering ———

  private render(t: number): void {
    const { ctx, dpr } = this;
    const zoom = this.zoom;
    const cam = this.camera();
    const isDark = document.documentElement.dataset.theme !== 'light';

    // viewport dimensions in world-space
    const vw = this.viewW / zoom;
    const vh = this.viewH / zoom;

    const bgColor = isDark ? '#0d0720' : '#e8e4f0';
    const streetColor = isDark ? 'rgba(80,60,140,0.18)' : 'rgba(160,150,200,0.3)';
    const streetLineColor = isDark ? 'rgba(140,110,200,0.12)' : 'rgba(100,80,160,0.18)';
    const gridColor = isDark ? 'rgba(100,80,180,0.08)' : 'rgba(80,60,140,0.08)';

    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);

    // background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, vw, vh);

    // pulse overlay
    if (this.pulse > 0) {
      ctx.fillStyle = `rgba(160,100,255,${this.pulse * 0.18})`;
      ctx.fillRect(0, 0, vw, vh);
    }

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // ——— street grid backdrop ———
    const BLOCK = 220;
    const STREET = 38;
    const gx0 = Math.floor(cam.x / BLOCK) * BLOCK;
    const gy0 = Math.floor(cam.y / BLOCK) * BLOCK;

    // street fill
    ctx.fillStyle = streetColor;
    for (let x = gx0; x < cam.x + vw + BLOCK; x += BLOCK) {
      ctx.fillRect(x, cam.y, STREET, vh);
    }
    for (let y = gy0; y < cam.y + vh + BLOCK; y += BLOCK) {
      ctx.fillRect(cam.x, y, vw, STREET);
    }

    // street lines (dashes)
    ctx.strokeStyle = streetLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 14]);
    for (let x = gx0; x < cam.x + vw + BLOCK; x += BLOCK) {
      ctx.beginPath();
      ctx.moveTo(x + STREET / 2, cam.y);
      ctx.lineTo(x + STREET / 2, cam.y + vh);
      ctx.stroke();
    }
    for (let y = gy0; y < cam.y + vh + BLOCK; y += BLOCK) {
      ctx.beginPath();
      ctx.moveTo(cam.x, y + STREET / 2);
      ctx.lineTo(cam.x + vw, y + STREET / 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // subtle grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const grid = 55;
    const gx1 = Math.floor(cam.x / grid) * grid;
    const gy1 = Math.floor(cam.y / grid) * grid;
    for (let x = gx1; x < cam.x + vw + grid; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, cam.y); ctx.lineTo(x, cam.y + vh); ctx.stroke();
    }
    for (let y = gy1; y < cam.y + vh + grid; y += grid) {
      ctx.beginPath(); ctx.moveTo(cam.x, y); ctx.lineTo(cam.x + vw, y); ctx.stroke();
    }

    // ——— city objects ———
    // Pass 1: small eatable objects (draw BEFORE hole so they appear to go under it)
    for (const obj of this.objects) {
      if (!obj.alive || obj.eatProgress > 0) continue;
      if (obj.r <= this.holeR) {
        this.drawObject(obj);
      }
    }

    // ——— HOLE ———
    this.drawHole(t);

    // Pass 2: eating animations (spiral into hole, drawn on top of hole)
    for (const obj of this.objects) {
      if (!obj.alive || obj.eatProgress <= 0) continue;
      this.drawEatingObject(obj);
    }

    // Pass 3: big objects (r > holeR) drawn ON TOP of hole so they visually block it
    for (const obj of this.objects) {
      if (!obj.alive || obj.eatProgress > 0) continue;
      if (obj.r > this.holeR) {
        this.drawObject(obj);
      }
    }

    // ——— particles ———
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ——— float texts ———
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = "800 16px 'Baloo 2 Variable', cursive";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#c77dff';
      ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 28);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawObject(obj: CityObject): void {
    const { ctx } = this;
    const r = obj.r;
    const x = obj.x;
    const y = obj.y;
    const tier = obj.tier;

    ctx.save();

    // drop shadow for depth
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    if (tier <= 2) {
      // small objects: circles
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // highlight
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 3) {
      // car: rounded rectangle
      const w = r * 2.2;
      const h = r * 1.3;
      this.roundRect(ctx, x - w / 2, y - h / 2, w, h, 7);
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      // windshield
      ctx.fillStyle = 'rgba(200,240,255,0.55)';
      this.roundRect(ctx, x - w * 0.22, y - h * 0.38, w * 0.44, h * 0.42, 4);
      ctx.fill();
      // wheels
      ctx.fillStyle = '#222';
      for (const wx of [x - w * 0.32, x + w * 0.32]) {
        ctx.beginPath();
        ctx.arc(wx, y + h * 0.4, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tier === 4) {
      // truck/tree
      const isTree = obj.id % 2 === 0;
      if (isTree) {
        // tree: circle crown + stem
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#6b3a1f';
        ctx.fillRect(x - r * 0.18, y + r * 0.7, r * 0.36, r * 0.55);
      } else {
        // truck
        const tw = r * 2.6;
        const th = r * 1.5;
        ctx.fillStyle = obj.color;
        this.roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'rgba(200,240,255,0.4)';
        this.roundRect(ctx, x + tw * 0.15, y - th * 0.38, tw * 0.3, th * 0.45, 4);
        ctx.fill();
        // wheels
        ctx.fillStyle = '#1a1a1a';
        for (const wx of [x - tw * 0.28, x + tw * 0.28]) {
          ctx.beginPath();
          ctx.arc(wx, y + th * 0.42, r * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (tier === 5) {
      // building: tall rounded rect
      const bw = r * 1.8;
      const bh = r * 2.5;
      ctx.fillStyle = obj.color;
      this.roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      // windows grid
      ctx.fillStyle = 'rgba(255,240,160,0.65)';
      const cols = 2;
      const rows = 3;
      const ww = bw * 0.22;
      const wh = bh * 0.14;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = x - bw * 0.26 + col * bw * 0.52;
          const wy = y - bh * 0.35 + row * bh * 0.28;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    } else {
      // tower: tall narrow rect with pointy top
      const tw = r * 1.4;
      const th = r * 3.2;
      ctx.fillStyle = obj.color;
      this.roundRect(ctx, x - tw / 2, y - th * 0.6, tw, th, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      // antenna
      ctx.strokeStyle = 'rgba(200,200,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - th * 0.6);
      ctx.lineTo(x, y - th * 0.75);
      ctx.stroke();
      // windows
      ctx.fillStyle = 'rgba(200,240,255,0.6)';
      for (let row = 0; row < 4; row++) {
        const wy = y - th * 0.48 + row * th * 0.22;
        ctx.fillRect(x - tw * 0.25, wy, tw * 0.18, th * 0.1);
        ctx.fillRect(x + tw * 0.07, wy, tw * 0.18, th * 0.1);
      }
    }

    ctx.restore();
  }

  private drawEatingObject(obj: CityObject): void {
    const { ctx } = this;
    const p = obj.eatProgress; // 0..1
    // spiral toward hole center
    const startDist = Math.hypot(obj.ox - this.holeX, obj.oy - this.holeY);
    const dist = startDist * (1 - p);
    const angle = obj.eatAngle;
    const x = this.holeX + Math.cos(angle) * dist;
    const y = this.holeY + Math.sin(angle) * dist;
    const scale = 1 - p;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1 - p * 0.6;
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(0, 0, obj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawHole(t: number): void {
    const { ctx } = this;
    const x = this.holeX;
    const y = this.holeY;
    const r = this.holeR;
    const isDark = document.documentElement.dataset.theme !== 'light';

    // outer glow
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.8);
    glow.addColorStop(0, 'rgba(138,43,226,0.35)');
    glow.addColorStop(0.5, 'rgba(100,0,180,0.15)');
    glow.addColorStop(1, 'rgba(60,0,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // hole body (pure black ellipse)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // clip swirl inside the hole
    ctx.clip();

    // swirl lines
    const swirlCount = 3;
    for (let i = 0; i < swirlCount; i++) {
      const baseAngle = this.swirlAngle + (i / swirlCount) * Math.PI * 2;
      const gradient = ctx.createLinearGradient(
        x + Math.cos(baseAngle) * r,
        y + Math.sin(baseAngle) * r,
        x, y
      );
      gradient.addColorStop(0, 'rgba(138,43,226,0.0)');
      gradient.addColorStop(0.5, 'rgba(138,43,226,0.25)');
      gradient.addColorStop(1, 'rgba(138,43,226,0.0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = r * 0.18;
      ctx.beginPath();
      ctx.moveTo(
        x + Math.cos(baseAngle) * r * 0.9,
        y + Math.sin(baseAngle) * r * 0.75
      );
      ctx.quadraticCurveTo(
        x + Math.cos(baseAngle + 0.8) * r * 0.45,
        y + Math.sin(baseAngle + 0.8) * r * 0.37,
        x, y
      );
      ctx.stroke();
    }

    ctx.restore();

    // accent rim
    const rimColor = isDark ? '#c77dff' : '#9b5de5';
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // inner specular dot
    ctx.save();
    const specR = r * 0.18;
    const sg = ctx.createRadialGradient(
      x - r * 0.28, y - r * 0.22, 0,
      x - r * 0.28, y - r * 0.22, specR * 2
    );
    sg.addColorStop(0, 'rgba(200,150,255,0.45)');
    sg.addColorStop(1, 'rgba(200,150,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.22, specR * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // pulse ring if just ate
    if (this.pulse > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, r + this.pulse * 12, (r + this.pulse * 12) * 0.82, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200,100,255,${this.pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // suppress unused param warning
    void t;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
