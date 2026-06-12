import type { OrbTier } from './orbs';
import { getTier } from './orbs';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  color: string;
  life: number;   // 0-1, decreasing
}

export interface FloatText {
  x: number; y: number;
  text: string;
  color: string;
  vy: number;
  life: number;  // 0-1
}

export interface OrbVisual {
  id: number;
  x: number;
  y: number;
  r: number;         // actual radius
  tier: number;
  scaleAnim: number; // 1 = normal, >1 = pop-in, <1 = squash
  angle: number;     // for subtle rotation
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
  }

  resize(cssW: number, cssH: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = cssW * dpr;
    this.canvas.height = cssH * dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  /** CSS pixels → canvas pixels */
  private s(n: number): number { return n * this.dpr; }

  clear(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  drawOrb(orb: OrbVisual): void {
    const { ctx } = this;
    const tierData: OrbTier = getTier(orb.tier);
    const cx = this.s(orb.x);
    const cy = this.s(orb.y);
    const r = this.s(orb.r * orb.scaleAnim);

    ctx.save();
    ctx.translate(cx, cy);

    // Main radial gradient (shaded orb)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
    grad.addColorStop(0, tierData.colorLight);
    grad.addColorStop(0.45, tierData.color);
    grad.addColorStop(1, tierData.colorDark);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glossy highlight (upper-left crescent)
    const highlight = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.02, -r * 0.18, -r * 0.22, r * 0.55);
    highlight.addColorStop(0, 'rgba(255,255,255,0.72)');
    highlight.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    // Face: two dot eyes + smile arc (only if radius > 12px logical)
    if (r >= this.s(12)) {
      const eyeR = Math.max(this.s(1.5), r * 0.1);
      const eyeOff = r * 0.28;
      const eyeY = -r * 0.18;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(-eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(this.s(1), r * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.32, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawDangerLine(y: number, containerLeft: number, containerRight: number, pulse: boolean): void {
    const { ctx } = this;
    const cy = this.s(y);
    const cl = this.s(containerLeft);
    const cr = this.s(containerRight);

    ctx.save();
    ctx.strokeStyle = pulse ? '#ff5e62' : 'rgba(255,94,98,0.45)';
    ctx.lineWidth = this.s(pulse ? 2.5 : 1.5);
    ctx.setLineDash([this.s(8), this.s(6)]);
    if (pulse) {
      ctx.shadowColor = '#ff5e62';
      ctx.shadowBlur = this.s(6);
    }
    ctx.beginPath();
    ctx.moveTo(cl, cy);
    ctx.lineTo(cr, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawGhostOrb(x: number, y: number, r: number, tier: number): void {
    const { ctx } = this;
    const tierData: OrbTier = getTier(tier);
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.arc(this.s(x), this.s(y), this.s(r), 0, Math.PI * 2);
    ctx.fillStyle = tierData.color;
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = tierData.colorLight;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();
    ctx.restore();
  }

  drawDropLine(x: number, fromY: number, toY: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = this.s(1);
    ctx.setLineDash([this.s(4), this.s(4)]);
    ctx.beginPath();
    ctx.moveTo(this.s(x), this.s(fromY));
    ctx.lineTo(this.s(x), this.s(toY));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawParticles(particles: Particle[]): void {
    const { ctx } = this;
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(this.s(p.x), this.s(p.y), this.s(p.r), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  drawFloatTexts(texts: FloatText[]): void {
    const { ctx } = this;
    for (const ft of texts) {
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.font = `bold ${this.s(16)}px 'Baloo 2 Variable', cursive`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, this.s(ft.x), this.s(ft.y));
      ctx.restore();
    }
  }

  /** Draw the glassy container walls/floor (cosmetic — physics walls are matter bodies) */
  drawContainer(left: number, right: number, top: number, bottom: number, wallW: number): void {
    const { ctx } = this;
    const l = this.s(left);
    const r = this.s(right);
    const t = this.s(top);
    const b = this.s(bottom);
    const w = this.s(wallW);

    // Glassy wall overlay — left
    const lgLeft = ctx.createLinearGradient(l - w, 0, l, 0);
    lgLeft.addColorStop(0, 'rgba(255,200,240,0.18)');
    lgLeft.addColorStop(1, 'rgba(255,200,240,0.05)');
    ctx.fillStyle = lgLeft;
    ctx.fillRect(l - w, t, w, b - t);

    // Right wall
    const lgRight = ctx.createLinearGradient(r, 0, r + w, 0);
    lgRight.addColorStop(0, 'rgba(255,200,240,0.05)');
    lgRight.addColorStop(1, 'rgba(255,200,240,0.18)');
    ctx.fillStyle = lgRight;
    ctx.fillRect(r, t, w, b - t);

    // Floor
    const lgFloor = ctx.createLinearGradient(0, b, 0, b + w);
    lgFloor.addColorStop(0, 'rgba(255,200,240,0.22)');
    lgFloor.addColorStop(1, 'rgba(255,200,240,0.05)');
    ctx.fillStyle = lgFloor;
    ctx.fillRect(l - w, b, (r - l) + w * 2, w);

    // Bright inner edge lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = this.s(1.5);
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l, b);
    ctx.lineTo(r, b);
    ctx.lineTo(r, t);
    ctx.stroke();
    ctx.restore();
  }
}
