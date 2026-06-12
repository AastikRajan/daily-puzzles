/**
 * Smash Drop — Stack-Ball style arcade game.
 * Ball bounces on plates, hold to smash through them.
 * Danger segments = death unless in fireball mode.
 */
import { tap, shatter, death as deathHaptic } from '../lib/haptics';
import { load, save } from '../lib/storage';

// ——— constants ———
const LANE_W = 320;         // visual lane width in px
const PLATE_H = 18;         // height of a plate bar
const PLATE_GAP = 54;       // vertical gap between plate tops
const BALL_R = 16;          // ball radius
const SEGMENT_COUNT = 7;    // segments per plate
const BASE_DEPTH = 40;
const GRAVITY = 1800;       // px/s²
const BOUNCE_VEL = -420;    // px/s upward bounce
const SLAM_VEL = 1100;      // px/s downward slam speed
const SQUASH_DUR = 120;     // ms squash/stretch duration
// scroll lerp: 0.94 per frame (applied in step via dt * 8 approach)

// Hue palette per tower (cycles), each level also color-shifts slightly by depth
const TOWER_HUES = [0, 30, 200, 260, 320, 160, 50];

export interface HudState {
  score: number;
  best: number;
  depth: number;
  towerDepth: number;
  towerNum: number;
  phase: 'playing' | 'dead' | 'won';
  holding: boolean;
  fireballing: boolean;
  fireMeter: number; // 0..1
}

interface Segment {
  danger: boolean;
  color: string;
  offset: number;   // horizontal rotation offset (0..1 = full plate width)
}

interface Plate {
  y: number;        // y in world space (top of plate)
  level: number;    // 0 = top, increasing downward
  segments: Segment[];
  broken: boolean;
  shatterAt: number; // timestamp when shattering started (-1 = intact)
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  life: number; // 0..1 decaying
}

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  hue: number;
}

export class SmashGame {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private viewW = 390;
  private viewH = 844;

  // ball state
  private ballX = 0;
  private ballY = 0;
  private ballVY = 0;
  private squashT = 0;         // timer for squash anim (ms, counts down)
  private squashDir: 1 | -1 = 1; // 1=squash on land, -1=stretch on launch

  // tower state
  private plates: Plate[] = [];
  private debris: Debris[] = [];
  private fireParticles: FireParticle[] = [];
  private scrollY = 0;         // world y of the top of viewport
  private targetScrollY = 0;

  // game state
  private score = 0;
  private best: number;
  private towerNum = 1;
  private towerDepth = BASE_DEPTH;
  private depth = 0;           // plates smashed this tower
  private phase: 'playing' | 'dead' | 'won' = 'playing';

  // input
  private holding = false;
  private slamming = false;    // currently in downward slam

  // fireball
  private fireCount = 0;       // plates smashed in current hold
  private fireballing = false;
  private fireDecayAt = 0;     // timestamp when fireball starts decaying

  // shake
  private shake = 0;

  // rAF loop
  private rafId = 0;
  private lastT = 0;
  private destroyed = false;

  private onHud: (h: HudState) => void;
  private reducedMotion: () => boolean;

  // programmatic hold for tests
  private progHoldMs = 0;
  private progHoldUsed = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHud: (h: HudState) => void,
    reducedMotion: () => boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.onHud = onHud;
    this.reducedMotion = reducedMotion;
    this.best = load<number>('best', 0);
    this.initTower();
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

  setHolding(h: boolean): void {
    if (this.phase !== 'playing') return;
    const wasHolding = this.holding;
    this.holding = h;
    if (!wasHolding && h) {
      // start slam
      this.slamming = true;
      this.ballVY = SLAM_VEL;
      this.fireCount = 0;
    }
    if (wasHolding && !h) {
      // release — fireball decays 1s after
      this.slamming = false;
      if (this.fireballing) {
        this.fireDecayAt = performance.now() + 1000;
      }
      this.fireCount = 0;
    }
  }

  restart(): void {
    this.score = 0;
    this.towerNum = 1;
    this.towerDepth = BASE_DEPTH;
    this.depth = 0;
    this.phase = 'playing';
    this.holding = false;
    this.slamming = false;
    this.fireballing = false;
    this.fireCount = 0;
    this.shake = 0;
    this.debris = [];
    this.fireParticles = [];
    this.progHoldMs = 0;
    this.progHoldUsed = 0;
    this.initTower();
    this.emitHud();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    delete (window as unknown as Record<string, unknown>)['__smash'];
  }

  // ——— tower init ———

  private initTower(): void {
    this.plates = [];
    this.scrollY = 0;
    this.targetScrollY = 0;
    this.depth = 0;

    const hueBase = TOWER_HUES[(this.towerNum - 1) % TOWER_HUES.length]!;
    const dangerRise = Math.min(0.35, 0.05 + (this.towerNum - 1) * 0.03);

    for (let i = 0; i < this.towerDepth + 2; i++) {
      this.plates.push(this.makePlate(i, hueBase, dangerRise));
    }

    // ball starts just above plate 0
    const p0 = this.plates[0]!;
    this.ballX = this.viewW / 2;
    this.ballY = p0.y - BALL_R - 2;
    this.ballVY = 0;
    this.squashT = 0;
  }

  private makePlate(level: number, hueBase: number, dangerRise: number): Plate {
    const y = 80 + level * PLATE_GAP;
    const segments: Segment[] = [];
    const hue = (hueBase + level * 4) % 360;
    const safeColor = `hsl(${hue}, 80%, 55%)`;

    const numDanger = level === 0 ? 0 : Math.floor(1 + Math.random() * 2);
    const dangerPositions = new Set<number>();
    while (dangerPositions.size < Math.min(numDanger, SEGMENT_COUNT - 1)) {
      const p = Math.floor(Math.random() * SEGMENT_COUNT);
      if (p !== 3) dangerPositions.add(p); // keep center safe to start
    }

    for (let s = 0; s < SEGMENT_COUNT; s++) {
      const isDanger = dangerPositions.has(s) && Math.random() < dangerRise + 0.15;
      segments.push({
        danger: isDanger,
        color: isDanger ? '#1a1a1a' : safeColor,
        offset: 0,
      });
    }

    return { y, level, segments, broken: false, shatterAt: -1 };
  }

  // ——— debug API ———

  private setupDebug(): void {
    (window as unknown as Record<string, unknown>)['__smash'] = {
      score: () => this.score,
      depth: () => this.depth,
      phase: () => this.phase,
      restart: () => this.restart(),
      die: () => this.die(),
      hold: (ms: number) => {
        if (this.phase !== 'playing') return;
        this.progHoldMs = ms;
        this.progHoldUsed = 0;
        this.setHolding(true);
      },
    };
  }

  // ——— core loop ———

  private loop = (t: number): void => {
    if (this.destroyed) return;
    const raw = t - this.lastT;
    const dt = Math.min(raw, 100) / 1000; // seconds, capped
    this.lastT = t;

    if (document.visibilityState === 'visible') {
      this.step(dt, t);
      this.render(t);
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(dt: number, now: number): void {
    // programmatic hold
    if (this.progHoldMs > 0) {
      this.progHoldUsed += dt * 1000;
      if (this.progHoldUsed >= this.progHoldMs) {
        this.progHoldMs = 0;
        this.setHolding(false);
      }
    }

    if (this.phase !== 'playing') {
      // decay debris/particles even when dead
      this.stepDebris(dt);
      this.stepFireParticles(dt);
      return;
    }

    // fireball decay
    if (this.fireballing && !this.holding && now >= this.fireDecayAt) {
      this.fireballing = false;
    }

    // rotate plates
    const rotSpeed = this.towerNum * 0.4 + 0.6; // rad-ish per second
    for (const plate of this.plates) {
      if (plate.broken) continue;
      for (const seg of plate.segments) {
        seg.offset = (seg.offset + rotSpeed * dt * 0.28) % 1;
      }
    }

    // ball physics
    if (this.slamming) {
      this.ballVY = SLAM_VEL;
      // emit fire trail
      if (this.fireballing && !this.reducedMotion()) {
        for (let i = 0; i < 3; i++) {
          this.fireParticles.push({
            x: this.ballX + (Math.random() - 0.5) * 12,
            y: this.ballY + BALL_R,
            vx: (Math.random() - 0.5) * 80,
            vy: -120 - Math.random() * 80,
            r: 5 + Math.random() * 8,
            life: 1,
            hue: 20 + Math.random() * 40,
          });
        }
      }
    } else {
      this.ballVY += GRAVITY * dt;
    }

    this.ballY += this.ballVY * dt;
    this.squashT = Math.max(0, this.squashT - dt * 1000);

    // collision with plates
    this.checkPlateCollisions(now);

    // smooth scroll: keep ball ~30% from top
    const targetScrollBallFrac = 0.3;
    this.targetScrollY = this.ballY - this.viewH * targetScrollBallFrac;
    this.targetScrollY = Math.max(0, this.targetScrollY);
    this.scrollY += (this.targetScrollY - this.scrollY) * Math.min(1, dt * 8);

    // shake decay
    this.shake = Math.max(0, this.shake - dt * 14);

    this.stepDebris(dt);
    this.stepFireParticles(dt);
    this.emitHud();
  }

  private checkPlateCollisions(now: number): void {
    for (let i = 0; i < this.plates.length; i++) {
      const plate = this.plates[i]!;
      if (plate.broken) continue;

      const plateTop = plate.y;
      const plateBot = plate.y + PLATE_H;

      // ball bottom crosses plate top while moving downward
      const ballBottom = this.ballY + BALL_R;
      if (ballBottom >= plateTop && ballBottom <= plateBot + 30 && this.ballVY > 0) {
        if (this.slamming) {
          // smashing through — check danger
          const danger = this.isDangerAligned(plate);
          if (danger && !this.fireballing) {
            this.die();
            return;
          }
          // shatter plate
          this.smashPlate(plate, now);
          this.depth = Math.max(this.depth, plate.level);
          this.fireCount++;
          // fireball trigger: 4+ in one hold
          if (this.fireCount >= 4 && !this.fireballing) {
            this.fireballing = true;
          }
          // score: base 10 * depth multiplier
          const mult = 1 + Math.floor(plate.level / 5);
          this.score += 10 * mult;
          if (this.score > this.best) {
            this.best = this.score;
            save('best', this.best);
          }
          shatter();
          tap();
          if (!this.reducedMotion()) this.shake = 0.6;
        } else {
          // bounce
          this.ballY = plateTop - BALL_R;
          this.ballVY = BOUNCE_VEL;
          this.squashT = SQUASH_DUR;
          this.squashDir = 1;
          tap();
        }
        break; // only one plate collision per frame
      }
    }

    // check win: reached bottom of tower
    if (this.depth >= this.towerDepth - 1 && !this.slamming) {
      // find lowest unbroken plate
      const anyUnbroken = this.plates.some(p => !p.broken && p.level < this.towerDepth);
      if (!anyUnbroken) {
        this.win();
      }
    }
  }

  private isDangerAligned(plate: Plate): boolean {
    const segW = LANE_W / SEGMENT_COUNT;
    const ballWorldX = this.ballX - (this.viewW - LANE_W) / 2;
    // which segment is under ball center
    const segIdx = Math.floor(((ballWorldX / LANE_W) % 1 + 1) % 1 * SEGMENT_COUNT);
    const seg = plate.segments[Math.max(0, Math.min(SEGMENT_COUNT - 1, segIdx))];
    // also check rotational offset — find which visual segment aligns
    const offsetSegIdx = Math.floor(((ballWorldX / LANE_W + 0.5) % 1 + 1) % 1 * SEGMENT_COUNT);
    void segW;
    const seg2 = plate.segments[Math.max(0, Math.min(SEGMENT_COUNT - 1, offsetSegIdx))];
    return !!(seg?.danger || seg2?.danger);
  }

  private smashPlate(plate: Plate, now: number): void {
    plate.broken = true;
    plate.shatterAt = now;

    // spawn debris from each segment
    const laneLeft = (this.viewW - LANE_W) / 2;
    const segW = LANE_W / SEGMENT_COUNT;
    if (!this.reducedMotion()) {
      for (let s = 0; s < SEGMENT_COUNT; s++) {
        const seg = plate.segments[s]!;
        const cx = laneLeft + (s + 0.5) * segW;
        const cy = plate.y + PLATE_H / 2;
        const spread = 1 + Math.random();
        this.debris.push({
          x: cx + (Math.random() - 0.5) * segW * 0.5,
          y: cy,
          vx: (Math.random() - 0.5) * 200 * spread,
          vy: -180 - Math.random() * 240,
          rot: Math.random() * Math.PI * 2,
          rotV: (Math.random() - 0.5) * 8,
          w: segW - 4,
          h: PLATE_H - 2,
          color: seg.color,
          alpha: 1,
          life: 1,
        });
      }
    }
  }

  private die(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'dead';
    deathHaptic();
    if (!this.reducedMotion()) this.shake = 1.4;
    this.emitHud();
  }

  private win(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'won';
    this.emitHud();
  }

  nextTower(): void {
    this.towerNum++;
    this.towerDepth = BASE_DEPTH + (this.towerNum - 1) * 10;
    this.phase = 'playing';
    this.holding = false;
    this.slamming = false;
    this.fireballing = false;
    this.fireCount = 0;
    this.shake = 0;
    this.debris = [];
    this.fireParticles = [];
    this.initTower();
    this.emitHud();
  }

  private stepDebris(dt: number): void {
    for (const d of this.debris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += GRAVITY * 0.6 * dt;
      d.vx *= 0.98;
      d.rot += d.rotV * dt;
      d.life -= dt * 1.4;
      d.alpha = Math.max(0, d.life);
    }
    this.debris = this.debris.filter(d => d.life > 0);
  }

  private stepFireParticles(dt: number): void {
    for (const p of this.fireParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 30 * dt;
      p.life -= dt * 2.5;
    }
    this.fireParticles = this.fireParticles.filter(p => p.life > 0);
  }

  private emitHud(): void {
    const fireMeter = this.fireballing
      ? 1
      : this.holding
        ? Math.min(1, this.fireCount / 4)
        : 0;
    this.onHud({
      score: this.score,
      best: this.best,
      depth: this.depth,
      towerDepth: this.towerDepth,
      towerNum: this.towerNum,
      phase: this.phase,
      holding: this.holding,
      fireballing: this.fireballing,
      fireMeter,
    });
  }

  // ——— rendering ———

  private render(now: number): void {
    const { ctx, dpr } = this;
    const shx = this.shake > 0 && !this.reducedMotion() ? (Math.random() - 0.5) * 8 * this.shake : 0;
    const shy = this.shake > 0 && !this.reducedMotion() ? (Math.random() - 0.5) * 8 * this.shake : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background gradient (hue shifts with tower)
    const hue = TOWER_HUES[(this.towerNum - 1) % TOWER_HUES.length]!;
    const bg = ctx.createLinearGradient(0, 0, 0, this.viewH);
    bg.addColorStop(0, `hsl(${hue + 220}, 30%, 8%)`);
    bg.addColorStop(1, `hsl(${hue + 200}, 25%, 5%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(shx, shy);

    const sy = this.scrollY;
    const laneLeft = (this.viewW - LANE_W) / 2;

    // lane guide lines
    ctx.strokeStyle = `hsla(${hue + 220}, 60%, 60%, 0.08)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(laneLeft, 0);
    ctx.lineTo(laneLeft, this.viewH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(laneLeft + LANE_W, 0);
    ctx.lineTo(laneLeft + LANE_W, this.viewH);
    ctx.stroke();

    // plates
    for (const plate of this.plates) {
      if (plate.broken) continue;
      const screenY = plate.y - sy;
      if (screenY > this.viewH + 60 || screenY < -60) continue;
      this.drawPlate(plate, screenY, laneLeft, now);
    }

    // debris
    ctx.save();
    for (const d of this.debris) {
      const sx = d.x;
      const dsy = d.y - sy;
      if (dsy < -100 || dsy > this.viewH + 100) continue;
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(sx, dsy);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      // shine strip
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h * 0.35);
      ctx.restore();
    }
    ctx.restore();

    // fire particles (screen-space ball trail)
    for (const p of this.fireParticles) {
      const psy = p.y - sy;
      const g = ctx.createRadialGradient(p.x, psy, 0, p.x, psy, p.r);
      g.addColorStop(0, `hsla(${p.hue}, 100%, 80%, ${p.life})`);
      g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, psy, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ball
    this.drawBall(now, sy);

    ctx.restore();
  }

  private drawPlate(plate: Plate, screenY: number, laneLeft: number, _now: number): void {
    const { ctx } = this;
    const segW = LANE_W / SEGMENT_COUNT;
    const totalW = LANE_W + segW; // extra for wraparound

    ctx.save();
    ctx.beginPath();
    ctx.rect(laneLeft, screenY, LANE_W, PLATE_H);
    ctx.clip();

    for (let s = 0; s < SEGMENT_COUNT + 1; s++) {
      const seg = plate.segments[s % SEGMENT_COUNT]!;
      const baseX = laneLeft - segW + s * segW;
      const ox = (seg.offset * LANE_W) % totalW;
      const x = baseX + ox - segW;
      // draw segment with wrapped copy
      this.drawSegment(seg, x, screenY, segW);
      this.drawSegment(seg, x + totalW, screenY, segW);
    }

    ctx.restore();

    // plate outer border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(laneLeft, screenY, LANE_W, PLATE_H);
  }

  private drawSegment(seg: Segment, x: number, y: number, w: number): void {
    const { ctx } = this;

    if (seg.danger) {
      // danger: near-black with vivid warning stripes
      ctx.fillStyle = '#111118';
      ctx.fillRect(x, y, w, PLATE_H);
      // diagonal warning stripes (yellow/orange)
      const stripeW = 6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, PLATE_H);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 80, 0, 0.85)';
      ctx.lineWidth = stripeW;
      for (let ix = x - PLATE_H; ix < x + w + PLATE_H; ix += stripeW * 2.5) {
        ctx.beginPath();
        ctx.moveTo(ix, y);
        ctx.lineTo(ix + PLATE_H, y + PLATE_H);
        ctx.stroke();
      }
      ctx.restore();
      // red glow border
      ctx.strokeStyle = 'rgba(255,40,40,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, PLATE_H - 2);
    } else {
      // safe segment with shine
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, y, w, PLATE_H);
      // top shine
      const shine = ctx.createLinearGradient(0, y, 0, y + PLATE_H);
      shine.addColorStop(0, 'rgba(255,255,255,0.35)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      shine.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = shine;
      ctx.fillRect(x, y, w, PLATE_H);
    }

    // segment divider
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + PLATE_H);
    ctx.stroke();
  }

  private drawBall(now: number, sy: number): void {
    const { ctx } = this;
    const bsx = this.ballX;
    const bsy = this.ballY - sy;

    // squash/stretch
    let scaleX = 1;
    let scaleY = 1;
    if (this.squashT > 0 && !this.reducedMotion()) {
      const t = this.squashT / SQUASH_DUR;
      const mag = 0.28 * t;
      if (this.squashDir === 1) {
        scaleX = 1 + mag;
        scaleY = 1 - mag * 0.7;
      } else {
        scaleX = 1 - mag * 0.5;
        scaleY = 1 + mag;
      }
    }

    ctx.save();
    ctx.translate(bsx, bsy);
    ctx.scale(scaleX, scaleY);

    if (this.fireballing) {
      // fireball glow
      const glow = ctx.createRadialGradient(0, 0, BALL_R * 0.3, 0, 0, BALL_R * 2.2);
      glow.addColorStop(0, 'rgba(255,160,40,0.7)');
      glow.addColorStop(0.5, 'rgba(255,80,0,0.3)');
      glow.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ball body gradient
    const ballHue = this.fireballing ? 30 : 210;
    const bg = ctx.createRadialGradient(-BALL_R * 0.3, -BALL_R * 0.35, BALL_R * 0.1, 0, 0, BALL_R);
    if (this.fireballing) {
      bg.addColorStop(0, '#fff8e0');
      bg.addColorStop(0.4, '#ff9020');
      bg.addColorStop(1, '#cc2000');
    } else {
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.3, `hsl(${ballHue}, 80%, 75%)`);
      bg.addColorStop(1, `hsl(${ballHue}, 70%, 45%)`);
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(-BALL_R * 0.28, -BALL_R * 0.3, BALL_R * 0.32, 0, Math.PI * 2);
    ctx.fill();

    void ballHue;
    void now;
    ctx.restore();
  }
}
