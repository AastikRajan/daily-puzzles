/**
 * Balance! — daily seesaw stacking on matter-js.
 * Same 8 shapes for everyone; place all 8 without toppling, 5 attempts.
 */
import Matter from 'matter-js';
import type { ShapeDef } from './shapes';
import { tap, pop } from '../lib/haptics';
import { sfxClick, sfxDeath, sfxStart, sfxEat } from '../lib/sfx';

const W = 390;            // logical scene width
const H = 560;            // logical scene height
const PLANK_W = 240;
const PLANK_H = 14;
const PLANK_Y = H - 150;
const FLOOR_Y = H - 36;
const TILT_FAIL = (28 * Math.PI) / 180;
const TILT_WARN = (18 * Math.PI) / 180;
const TILT_HOLD = 1000;
const SETTLE_MS = 3000;

export type Phase = 'playing' | 'settling' | 'won' | 'failed' | 'dayDone';

export interface SimHud {
  phase: Phase;
  attempt: number;       // 1-based
  placed: number;        // shapes placed in this attempt
  total: number;
  settleFrac: number;    // 0-1 progress of final settle check
  attemptResults: number[]; // per finished attempt: -1 = success, else shapes placed before topple
}

export class BalanceSim {
  private engine: Matter.Engine;
  private plank!: Matter.Body;
  private placedBodies: Matter.Body[] = [];
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = W;

  private shapes: ShapeDef[];
  private nextIdx = 0;
  private attempt = 1;
  private attemptResults: number[] = [];
  private phase: Phase = 'playing';
  private holdPos: { x: number; y: number } | null = null;
  private holdAngle = 0;
  private tiltSince: number | null = null;
  private settleStart: number | null = null;
  private slowmoUntil = 0;
  private dust: { x: number; y: number; r: number; life: number }[] = [];
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;
  private onHud: (h: SimHud) => void;
  private reducedMotion: () => boolean;

  constructor(
    canvas: HTMLCanvasElement,
    shapes: ShapeDef[],
    onHud: (h: SimHud) => void,
    reducedMotion: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.shapes = shapes;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.engine = Matter.Engine.create({ gravity: { y: 1 } });
    this.buildStatics();
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
    delete (window as unknown as Record<string, unknown>)['__balance'];
  }

  private buildStatics(): void {
    const world = this.engine.world;
    Matter.World.clear(world, false);
    // fulcrum triangle (static, visual collision base for the plank pivot)
    const fulcrum = Matter.Bodies.polygon(W / 2, PLANK_Y + 44, 3, 44, {
      isStatic: true,
      angle: -Math.PI / 2,
    });
    // plank pivoting on the fulcrum tip
    this.plank = Matter.Bodies.rectangle(W / 2, PLANK_Y, PLANK_W, PLANK_H, {
      density: 0.004,
      frictionAir: 0.02,
      friction: 0.9,
    });
    const pivot = Matter.Constraint.create({
      pointA: { x: W / 2, y: PLANK_Y },
      bodyB: this.plank,
      pointB: { x: 0, y: 0 },
      stiffness: 1,
      length: 0,
    });
    Matter.World.add(world, [fulcrum, this.plank, pivot]);
  }

  // ——— interaction ———

  setHold(pos: { x: number; y: number } | null): void {
    if (this.phase !== 'playing') return;
    this.holdPos = pos
      ? { x: Math.max(30, Math.min(W - 30, pos.x)), y: Math.max(40, Math.min(PLANK_Y - 30, pos.y)) }
      : null;
  }

  rotateHold(): void {
    sfxClick();
    this.holdAngle += Math.PI / 12;
  }

  dropHold(): void {
    if (this.phase !== 'playing' || !this.holdPos || this.nextIdx >= this.shapes.length) return;
    const def = this.shapes[this.nextIdx]!;
    const body = this.makeBody(def, this.holdPos.x, this.holdPos.y, this.holdAngle);
    Matter.World.add(this.engine.world, body);
    this.placedBodies.push(body);
    this.nextIdx++;
    sfxEat();
    this.holdPos = null;
    this.holdAngle = 0;
    tap();
    if (this.nextIdx === this.shapes.length) {
      this.phase = 'settling';
      this.settleStart = null;
      this.slowmoUntil = this.reducedMotion() ? 0 : Date.now() + 600;
    }
    this.emit();
  }

  private makeBody(def: ShapeDef, x: number, y: number, angle: number): Matter.Body {
    const opts: Matter.IChamferableBodyDefinition = {
      density: def.density,
      friction: 0.85,
      restitution: 0.05,
      angle,
      chamfer: def.kind === 'rect' ? { radius: 6 } : undefined,
    };
    if (def.kind === 'rect') return Matter.Bodies.rectangle(x, y, def.w, def.h, opts);
    if (def.kind === 'circle') return Matter.Bodies.circle(x, y, def.r, opts);
    return Matter.Bodies.polygon(x, y, def.sides, def.r, { ...opts, chamfer: { radius: 4 } });
  }

  /** centered drop heuristic for tests: stack above current pile center */
  placeAuto(): void {
    if (this.phase !== 'playing') return;
    let top = PLANK_Y - PLANK_H / 2;
    for (const b of this.placedBodies) top = Math.min(top, b.bounds.min.y);
    this.holdPos = { x: W / 2, y: Math.max(60, top - 46) };
    this.holdAngle = 0;
    this.dropHold();
  }

  forceFail(): void {
    if (this.phase === 'playing' || this.phase === 'settling') this.fail();
  }

  retry(): void {
    if (this.phase !== 'failed') return;
    if (this.attempt >= 5) {
      this.phase = 'dayDone';
      this.emit();
      return;
    }
    this.attempt++;
    this.resetWorld();
    this.phase = 'playing';
    this.emit();
  }

  private resetWorld(): void {
    for (const b of this.placedBodies) Matter.World.remove(this.engine.world, b);
    this.placedBodies = [];
    this.nextIdx = 0;
    this.holdPos = null;
    this.holdAngle = 0;
    this.tiltSince = null;
    this.settleStart = null;
    Matter.Body.setAngle(this.plank, 0);
    Matter.Body.setAngularVelocity(this.plank, 0);
  }

  private fail(): void {
    this.attemptResults.push(this.nextIdx);
    this.phase = 'failed';
    sfxDeath();
    pop();
    this.emit();
  }

  private win(): void {
    this.attemptResults.push(-1);
    this.phase = 'won';
    sfxStart();
    pop();
    this.emit();
  }

  getHud(): SimHud {
    return {
      phase: this.phase,
      attempt: this.attempt,
      placed: this.nextIdx,
      total: this.shapes.length,
      settleFrac:
        this.settleStart !== null && this.phase === 'settling'
          ? Math.min(1, (Date.now() - this.settleStart) / SETTLE_MS)
          : 0,
      attemptResults: [...this.attemptResults],
    };
  }

  private emit(): void {
    this.onHud(this.getHud());
  }

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__balance'] = {
      state: () => (this.phase === 'won' ? 'won' : this.phase === 'failed' || this.phase === 'dayDone' ? 'failed' : 'playing'),
      placeAuto: () => this.placeAuto(),
      attempt: () => this.attempt,
      forceFail: () => this.forceFail(),
      placed: () => this.nextIdx,
      retry: () => this.retry(),
    };
  }

  // ——— loop ———

  private loop = (t: number): void => {
    if (this.destroyed) return;
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      const slow = now < this.slowmoUntil ? 0.3 : 1;
      const dt = Math.min(t - this.lastT, 50) * slow;
      if (this.phase === 'playing' || this.phase === 'settling') {
        Matter.Engine.update(this.engine, dt);
        this.checkState(now);
      }
      this.render(now);
    }
    this.lastT = t;
    this.rafId = requestAnimationFrame(this.loop);
  };

  private checkState(now: number): void {
    // anything fallen off?
    for (const b of this.placedBodies) {
      if (b.position.y > FLOOR_Y + 30) {
        this.fail();
        return;
      }
    }
    // plank overtilt sustained?
    if (Math.abs(this.plank.angle) > TILT_FAIL) {
      if (this.tiltSince === null) this.tiltSince = now;
      else if (now - this.tiltSince > TILT_HOLD) {
        this.fail();
        return;
      }
    } else {
      this.tiltSince = null;
    }
    // settle check for the win
    if (this.phase === 'settling') {
      const calm = this.placedBodies.every(
        (b) => Math.hypot(b.velocity.x, b.velocity.y) < 0.35 && Math.abs(b.angularVelocity) < 0.05,
      );
      if (calm) {
        if (this.settleStart === null) this.settleStart = now;
        else if (now - this.settleStart >= SETTLE_MS) {
          this.win();
          return;
        }
      } else {
        this.settleStart = null;
      }
      this.emit(); // keep the settle ring animating
    }
  }

  // ——— rendering ———

  private render(now: number): void {
    const { ctx, dpr } = this;
    const s = this.viewW / W;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.clearRect(0, 0, W, H / s + 100);

    // floor line
    ctx.strokeStyle = 'rgba(120, 90, 60, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    // fulcrum
    ctx.fillStyle = '#b07a4a';
    ctx.beginPath();
    ctx.moveTo(W / 2, PLANK_Y + 2);
    ctx.lineTo(W / 2 - 38, PLANK_Y + 86);
    ctx.lineTo(W / 2 + 38, PLANK_Y + 86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(W / 2, PLANK_Y + 2);
    ctx.lineTo(W / 2 + 38, PLANK_Y + 86);
    ctx.lineTo(W / 2 + 14, PLANK_Y + 86);
    ctx.closePath();
    ctx.fill();

    // plank (warn glow when tilting)
    const warn = Math.abs(this.plank.angle) > TILT_WARN;
    ctx.save();
    ctx.translate(this.plank.position.x, this.plank.position.y);
    ctx.rotate(this.plank.angle);
    if (warn) {
      ctx.shadowColor = '#ff5e62';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = '#c98a52';
    this.rr(ctx, -PLANK_W / 2, -PLANK_H / 2, PLANK_W, PLANK_H, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    this.rr(ctx, -PLANK_W / 2, -PLANK_H / 2, PLANK_W, 4, 3);
    ctx.fill();
    ctx.restore();

    // placed bodies
    for (let i = 0; i < this.placedBodies.length; i++) {
      this.drawShape(this.placedBodies[i]!, this.shapes[i]!);
    }

    // held ghost + drop guide
    if (this.phase === 'playing' && this.nextIdx < this.shapes.length && this.holdPos) {
      const def = this.shapes[this.nextIdx]!;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(120,90,60,0.4)';
      ctx.beginPath();
      ctx.moveTo(this.holdPos.x, this.holdPos.y);
      ctx.lineTo(this.holdPos.x, PLANK_Y - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.75;
      this.drawShapeAt(def, this.holdPos.x, this.holdPos.y, this.holdAngle);
      ctx.restore();
    }

    // settle progress ring
    if (this.phase === 'settling' && this.settleStart !== null) {
      const frac = Math.min(1, (now - this.settleStart) / SETTLE_MS);
      ctx.save();
      ctx.strokeStyle = '#3fae74';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(W / 2, 70, 22, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // dust
    for (const d of this.dust) {
      ctx.globalAlpha = Math.max(0, d.life);
      ctx.fillStyle = '#c9a87a';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      d.life -= 0.03;
      d.y -= 0.4;
    }
    this.dust = this.dust.filter((d) => d.life > 0);
    ctx.globalAlpha = 1;
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawShape(body: Matter.Body, def: ShapeDef): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    this.paintDef(def, true);
    ctx.restore();
  }

  private drawShapeAt(def: ShapeDef, x: number, y: number, angle: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    this.paintDef(def, false);
    ctx.restore();
  }

  /** friendly shape with dot eyes; assumes ctx is translated/rotated */
  private paintDef(def: ShapeDef, face: boolean): void {
    const { ctx } = this;
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.deep;
    ctx.lineWidth = 2.5;
    if (def.kind === 'rect') {
      this.rr(ctx, -def.w / 2, -def.h / 2, def.w, def.h, 7);
      ctx.fill();
      ctx.stroke();
    } else if (def.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, def.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < def.sides; i++) {
        const a = (i / def.sides) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * def.r;
        const py = Math.sin(a) * def.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (face) {
      const ey = def.kind === 'rect' ? -2 : -3;
      ctx.fillStyle = 'rgba(40,25,12,0.7)';
      ctx.beginPath();
      ctx.arc(-6, ey, 2.4, 0, Math.PI * 2);
      ctx.arc(6, ey, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,25,12,0.6)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, ey + 3, 4.5, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
  }
}

export const SCENE = { W, H, PLANK_Y };
