/**
 * Snake Pop — the whole game in one deterministic-step engine.
 * The twist: your body IS the match-3 board. Eating a colored orb appends
 * a segment of that color; 3+ consecutive same-color segments pop for score.
 */
import { tap, death as errorHaptic } from '../lib/haptics';
import { load, save } from '../lib/storage';

export const COLORS = ['#00f5a0', '#ff4ecd', '#4e9fff', '#ffe94e', '#ff7b2e'];
const COLOR_DEEP = ['#00c47e', '#cc30a0', '#2878d4', '#cdb820', '#cc5a12'];

export const WORLD = 1400;
const SEG_SPACING = 13;
const SEG_R = 9.5;
const HEAD_R = 11.5;
const ORB_R = 7;
const ORB_COUNT = 70;
const BASE_SPEED = 130;   // px/s
const BOOST_SPEED = 215;
const TURN_RATE = 4.2;    // rad/s
const POP_DELAY = 300;    // ms pulse warning before segments pop
const COMBO_WINDOW = 2000;
const BOOST_COST_MS = 1000;
const RIVAL_COUNT = 3;
const RIVAL_RESPAWN_MS = 5000;
const STEP = 1000 / 60;

interface Orb { x: number; y: number; color: number }
interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }

interface Worm {
  /** trail of head positions, newest first; segments are placed along it */
  trail: { x: number; y: number }[];
  angle: number;
  colors: number[];      // per body segment (player) — rivals reuse a hue
  alive: boolean;
  speed: number;
  /** AI state for rivals */
  wanderT?: number;
  respawnAt?: number;
  hue?: string;
  hueDeep?: string;
}

export interface HudState {
  score: number;
  best: number;
  length: number;
  combo: number;
  phase: 'playing' | 'dead';
}

export class SnakeGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = 390;
  private viewH = 700;

  private player: Worm;
  private rivals: Worm[] = [];
  private orbs: Orb[] = [];
  private particles: Particle[] = [];
  private floats: { x: number; y: number; text: string; life: number }[] = [];

  private score = 0;
  private best: number;
  private combo = 0;
  private lastPopAt = 0;
  private popping: { index: number; count: number; at: number } | null = null;
  private boosting = false;
  private boostDebt = 0;
  private shake = 0;
  private phase: 'playing' | 'dead' = 'playing';
  private pointer: { x: number; y: number } | null = null;
  private acc = 0;
  private lastT = 0;
  private rafId = 0;
  private onHud: (h: HudState) => void;
  private reducedMotion: () => boolean;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: HudState) => void,
    reducedMotion: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.player = this.makeWorm(WORLD / 2, WORLD / 2, true);
    for (let i = 0; i < RIVAL_COUNT; i++) this.rivals.push(this.spawnRival());
    while (this.orbs.length < ORB_COUNT) this.orbs.push(this.randomOrb());
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
    canvas.width = w * this.dpr;
    canvas.height = h * this.dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  setPointer(p: { x: number; y: number } | null): void { this.pointer = p; }
  setBoost(b: boolean): void { this.boosting = b; }

  restart(): void {
    this.player = this.makeWorm(WORLD / 2, WORLD / 2, true);
    this.rivals = [];
    for (let i = 0; i < RIVAL_COUNT; i++) this.rivals.push(this.spawnRival());
    this.orbs = [];
    while (this.orbs.length < ORB_COUNT) this.orbs.push(this.randomOrb());
    this.particles = [];
    this.floats = [];
    this.score = 0;
    this.combo = 0;
    this.popping = null;
    this.boostDebt = 0;
    this.phase = 'playing';
    this.emitHud();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__snakePop'];
  }

  // ——— construction helpers ———

  private makeWorm(x: number, y: number, isPlayer: boolean): Worm {
    const colors: number[] = [];
    for (let i = 0; i < 5; i++) {
      // avoid creating a starting run of 3
      let c = Math.floor(Math.random() * COLORS.length);
      while (i >= 2 && colors[i - 1] === c && colors[i - 2] === c) {
        c = Math.floor(Math.random() * COLORS.length);
      }
      colors.push(c);
    }
    const angle = Math.random() * Math.PI * 2;
    const trail: { x: number; y: number }[] = [];
    for (let i = 0; i < 400; i++) {
      trail.push({ x: x - Math.cos(angle) * i * 2, y: y - Math.sin(angle) * i * 2 });
    }
    const hueIdx = Math.floor(Math.random() * COLORS.length);
    return {
      trail,
      angle,
      colors,
      alive: true,
      speed: BASE_SPEED,
      wanderT: 0,
      hue: isPlayer ? undefined : '#9aa3c7',
      hueDeep: isPlayer ? undefined : '#6c7494',
      ...(isPlayer ? {} : { hue: COLOR_DEEP[hueIdx], hueDeep: '#23233f' }),
    };
  }

  private spawnRival(): Worm {
    const margin = 200;
    let x = 0;
    let y = 0;
    do {
      x = margin + Math.random() * (WORLD - margin * 2);
      y = margin + Math.random() * (WORLD - margin * 2);
    } while (Math.hypot(x - this.head(this.player).x, y - this.head(this.player).y) < 320);
    const w = this.makeWorm(x, y, false);
    w.colors = new Array(6 + Math.floor(Math.random() * 5)).fill(0);
    return w;
  }

  private randomOrb(): Orb {
    return {
      x: 40 + Math.random() * (WORLD - 80),
      y: 40 + Math.random() * (WORLD - 80),
      color: Math.floor(Math.random() * COLORS.length),
    };
  }

  private head(w: Worm): { x: number; y: number } {
    return w.trail[0]!;
  }

  // ——— debug/test API ———

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__snakePop'] = {
      score: () => this.score,
      length: () => this.player.colors.length,
      die: () => this.die(),
      eatColor: (c: number) => {
        this.player.colors.push(((c % COLORS.length) + COLORS.length) % COLORS.length);
        this.checkPops(true);
        this.emitHud();
      },
    };
  }

  // ——— core loop ———

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      this.acc += Math.min(t - this.lastT, 100);
      while (this.acc >= STEP) {
        this.step(STEP / 1000);
        this.acc -= STEP;
      }
      this.render();
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    const now = Date.now();
    if (this.phase === 'playing') {
      this.movePlayer(dt, now);
      this.moveRivals(dt, now);
      this.resolvePops(now);
      this.checkCollisions(now);
    }
    // particles / floats decay even when dead
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt * 1.8;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) f.life -= dt * 1.1;
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 14);
    if (this.combo > 0 && now - this.lastPopAt > COMBO_WINDOW) {
      this.combo = 0;
      this.emitHud();
    }
  }

  private steer(w: Worm, target: number, dt: number): void {
    let diff = target - w.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const max = TURN_RATE * dt;
    w.angle += Math.max(-max, Math.min(max, diff));
  }

  private advance(w: Worm, dt: number): void {
    const h = this.head(w);
    const nx = h.x + Math.cos(w.angle) * w.speed * dt;
    const ny = h.y + Math.sin(w.angle) * w.speed * dt;
    w.trail.unshift({ x: nx, y: ny });
    const need = (w.colors.length + 3) * SEG_SPACING / 2 + 60;
    if (w.trail.length > need) w.trail.length = Math.ceil(need);
  }

  /** position of segment i (0 = first body segment behind head) */
  private segPos(w: Worm, i: number): { x: number; y: number } {
    const dist = (i + 1) * SEG_SPACING;
    // trail points are ~speed*dt apart; walk the trail accumulating distance
    let acc = 0;
    for (let k = 1; k < w.trail.length; k++) {
      const a = w.trail[k - 1]!;
      const b = w.trail[k]!;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + d >= dist) {
        const f = (dist - acc) / (d || 1);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
      acc += d;
    }
    return w.trail[w.trail.length - 1]!;
  }

  private movePlayer(dt: number, now: number): void {
    const w = this.player;
    // steering toward pointer (world coords)
    if (this.pointer) {
      const h = this.head(w);
      this.steer(w, Math.atan2(this.pointer.y - h.y, this.pointer.x - h.x), dt);
    }
    // boost costs tail
    const canBoost = this.boosting && w.colors.length > 4;
    w.speed = canBoost ? BOOST_SPEED : BASE_SPEED;
    if (canBoost) {
      this.boostDebt += dt * 1000;
      if (this.boostDebt >= BOOST_COST_MS) {
        this.boostDebt = 0;
        w.colors.pop();
        this.emitHud();
      }
    }
    this.advance(w, dt);

    // eat orbs
    const h = this.head(w);
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]!;
      if (Math.hypot(o.x - h.x, o.y - h.y) < HEAD_R + ORB_R) {
        this.orbs.splice(i, 1);
        this.orbs.push(this.randomOrb());
        w.colors.push(o.color);
        tap();
        this.checkPops(false);
        this.emitHud();
      }
    }
  }

  private moveRivals(dt: number, now: number): void {
    for (const r of this.rivals) {
      if (!r.alive) {
        if (r.respawnAt && now >= r.respawnAt) {
          Object.assign(r, this.spawnRival());
        }
        continue;
      }
      // AI: seek nearest orb, wander a bit, avoid walls hard
      const h = this.head(r);
      let target = r.angle;
      const margin = 120;
      if (h.x < margin || h.x > WORLD - margin || h.y < margin || h.y > WORLD - margin) {
        target = Math.atan2(WORLD / 2 - h.y, WORLD / 2 - h.x);
      } else {
        let bd = Infinity;
        for (const o of this.orbs) {
          const d = Math.hypot(o.x - h.x, o.y - h.y);
          if (d < bd) {
            bd = d;
            target = Math.atan2(o.y - h.y, o.x - h.x);
          }
        }
        r.wanderT = (r.wanderT ?? 0) + dt;
        target += Math.sin(r.wanderT * 1.7) * 0.5;
      }
      this.steer(r, target, dt);
      r.speed = BASE_SPEED * 0.92;
      this.advance(r, dt);

      // rivals eat orbs and grow (capped)
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i]!;
        if (Math.hypot(o.x - h.x, o.y - h.y) < HEAD_R + ORB_R) {
          this.orbs.splice(i, 1);
          this.orbs.push(this.randomOrb());
          if (r.colors.length < 18) r.colors.push(0);
        }
      }
    }
  }

  /** find runs of ≥3 consecutive same colors; arm the pop pulse */
  private checkPops(instant: boolean): void {
    if (this.popping) return;
    const c = this.player.colors;
    let runStart = 0;
    for (let i = 1; i <= c.length; i++) {
      if (i < c.length && c[i] === c[runStart]) continue;
      const len = i - runStart;
      if (len >= 3) {
        this.popping = { index: runStart, count: len, at: Date.now() + (instant ? 0 : POP_DELAY) };
        return;
      }
      runStart = i;
    }
  }

  private resolvePops(now: number): void {
    if (!this.popping || now < this.popping.at) return;
    const { index, count } = this.popping;
    const color = this.player.colors[index]!;
    // burst particles at the popped segments
    for (let i = index; i < index + count; i++) {
      const p = this.segPos(this.player, i);
      this.burst(p.x, p.y, COLORS[color]!, 8);
    }
    this.player.colors.splice(index, count);
    this.popping = null;

    const chained = now - this.lastPopAt < COMBO_WINDOW;
    this.combo = chained ? this.combo + 1 : 1;
    this.lastPopAt = now;
    const points = 10 * count * count * this.combo;
    this.score += points;
    if (this.score > this.best) {
      this.best = this.score;
      save('best', this.best);
    }
    const hp = this.segPos(this.player, Math.max(0, index - 1));
    this.floats.push({ x: hp.x, y: hp.y - 20, text: this.combo > 1 ? `+${points} ×${this.combo}` : `+${points}`, life: 1 });
    if (count >= 4 && !this.reducedMotion()) this.shake = 1;
    tap();
    // chain reaction: removing a run can join two runs of the same color
    this.checkPops(false);
    this.emitHud();
  }

  private checkCollisions(now: number): void {
    const h = this.head(this.player);
    // walls
    if (h.x < HEAD_R || h.x > WORLD - HEAD_R || h.y < HEAD_R || h.y > WORLD - HEAD_R) {
      this.die();
      return;
    }
    for (const r of this.rivals) {
      if (!r.alive) continue;
      // my head vs rival body
      for (let i = 0; i < r.colors.length; i++) {
        const p = this.segPos(r, i);
        if (Math.hypot(p.x - h.x, p.y - h.y) < HEAD_R + SEG_R - 3) {
          this.die();
          return;
        }
      }
      // rival head vs my body → rival bursts into orbs
      const rh = this.head(r);
      for (let i = 0; i < this.player.colors.length; i++) {
        const p = this.segPos(this.player, i);
        if (Math.hypot(p.x - rh.x, p.y - rh.y) < HEAD_R + SEG_R - 3) {
          r.alive = false;
          r.respawnAt = now + RIVAL_RESPAWN_MS;
          for (let k = 0; k < r.colors.length; k++) {
            const sp = this.segPos(r, k);
            this.orbs.push({
              x: Math.max(20, Math.min(WORLD - 20, sp.x + (Math.random() - 0.5) * 18)),
              y: Math.max(20, Math.min(WORLD - 20, sp.y + (Math.random() - 0.5) * 18)),
              color: Math.floor(Math.random() * COLORS.length),
            });
            if (k % 2 === 0) this.burst(sp.x, sp.y, '#9aa3c7', 5);
          }
          this.score += 50;
          this.floats.push({ x: rh.x, y: rh.y - 16, text: '+50 K.O.!', life: 1 });
          if (!this.reducedMotion()) this.shake = 1;
          tap();
          this.emitHud();
          break;
        }
      }
    }
  }

  private die(): void {
    if (this.phase === 'dead') return;
    this.phase = 'dead';
    errorHaptic();
    const h = this.head(this.player);
    for (let i = 0; i < this.player.colors.length; i++) {
      const p = this.segPos(this.player, i);
      this.burst(p.x, p.y, COLORS[this.player.colors[i]!]!, 6);
    }
    this.burst(h.x, h.y, '#ffffff', 16);
    if (!this.reducedMotion()) this.shake = 1.4;
    this.emitHud();
  }

  private burst(x: number, y: number, color: string, n: number): void {
    if (this.reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + Math.random() * 3, color, life: 1 });
    }
  }

  private emitHud(): void {
    this.onHud({
      score: this.score,
      best: this.best,
      length: this.player.colors.length,
      combo: this.combo,
      phase: this.phase,
    });
  }

  /** screen→world for pointer steering */
  toWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.camera();
    return { x: sx + cam.x, y: sy + cam.y };
  }

  private camera(): { x: number; y: number } {
    const h = this.head(this.player);
    const x = Math.max(0, Math.min(WORLD - this.viewW, h.x - this.viewW / 2));
    const y = Math.max(0, Math.min(WORLD - this.viewH, h.y - this.viewH / 2));
    return { x, y };
  }

  // ——— rendering ———

  private render(): void {
    const { ctx, dpr } = this;
    const now = Date.now();
    const cam = this.camera();
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // void background + vignette
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(-cam.x + shx, -cam.y + shy);

    // grid
    ctx.strokeStyle = 'rgba(140,150,255,0.07)';
    ctx.lineWidth = 1;
    const grid = 70;
    const x0 = Math.floor(cam.x / grid) * grid;
    const y0 = Math.floor(cam.y / grid) * grid;
    for (let x = x0; x < cam.x + this.viewW + grid; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, cam.y); ctx.lineTo(x, cam.y + this.viewH); ctx.stroke();
    }
    for (let y = y0; y < cam.y + this.viewH + grid; y += grid) {
      ctx.beginPath(); ctx.moveTo(cam.x, y); ctx.lineTo(cam.x + this.viewW, y); ctx.stroke();
    }

    // arena walls
    ctx.strokeStyle = '#ff4e4e';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff4e4e';
    ctx.shadowBlur = 16;
    ctx.strokeRect(0, 0, WORLD, WORLD);
    ctx.shadowBlur = 0;

    // orbs
    for (const o of this.orbs) {
      if (o.x < cam.x - 20 || o.x > cam.x + this.viewW + 20 || o.y < cam.y - 20 || o.y > cam.y + this.viewH + 20) continue;
      ctx.save();
      ctx.shadowColor = COLORS[o.color]!;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS[o.color]!;
      ctx.beginPath();
      ctx.arc(o.x, o.y, ORB_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(o.x - 2, o.y - 2, ORB_R * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // rivals
    for (const r of this.rivals) {
      if (!r.alive) continue;
      this.drawWorm(r, now, true);
    }
    // player
    if (this.phase === 'playing') this.drawWorm(this.player, now, false);

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // float texts
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = "800 17px 'Baloo 2 Variable', cursive";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f5a0';
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 30);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawWorm(w: Worm, now: number, isRival: boolean): void {
    const { ctx } = this;
    // tail → head so the head draws on top
    for (let i = w.colors.length - 1; i >= 0; i--) {
      const p = this.segPos(w, i);
      let r = SEG_R;
      let color = isRival ? w.hue! : COLORS[w.colors[i]!]!;
      let deep = isRival ? w.hueDeep! : COLOR_DEEP[w.colors[i]!]!;
      // pop pulse warning
      if (!isRival && this.popping && i >= this.popping.index && i < this.popping.index + this.popping.count) {
        const t = 1 - Math.max(0, this.popping.at - now) / POP_DELAY;
        r = SEG_R * (1 + 0.35 * Math.sin(t * Math.PI * 4));
        color = '#ffffff';
      }
      const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.15, p.x, p.y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, color);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // head
    const h = this.head(w);
    const hr = isRival ? HEAD_R - 1 : HEAD_R;
    const hg = ctx.createRadialGradient(h.x - 3, h.y - 3, 2, h.x, h.y, hr);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.3, isRival ? '#c2c9e8' : '#e9fff7');
    hg.addColorStop(1, isRival ? '#6c7494' : '#7ce8c2');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(h.x, h.y, hr, 0, Math.PI * 2);
    ctx.fill();
    // eyes looking toward travel
    const ex = Math.cos(w.angle);
    const ey = Math.sin(w.angle);
    const side = { x: -ey, y: ex };
    for (const s of [-1, 1]) {
      const cx = h.x + ex * 4 + side.x * 4.5 * s;
      const cy = h.y + ey * 4 + side.y * 4.5 * s;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(cx + ex * 1.4, cy + ey * 1.4, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
