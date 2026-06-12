import type { BallState, HoleDef, Gate } from './types';

export const FRICTION = 0.985;           // per frame at 60fps
export const RESTITUTION = 0.8;          // wall bounce energy retention
export const STOP_SPEED = 0.5;           // px/frame below this → stop
export const CAPTURE_SPEED = 6;          // px/frame — must slow to sink
export const CAPTURE_RADIUS_MULT = 1.2;
export const MAX_POWER_PX = 120;
export const MAX_SHOT_SPEED = 18;        // px/frame at 60fps
export const BALL_RADIUS = 10;
export const HOLE_RADIUS = 14;

/** Shoot from current position at angle (radians), power in [0,1]. */
export function shoot(ball: BallState, angleRad: number, power01: number): BallState {
  const spd = power01 * MAX_SHOT_SPEED;
  return {
    ...ball,
    vx: Math.cos(angleRad) * spd,
    vy: Math.sin(angleRad) * spd,
    status: 'rolling',
  };
}

/** Advance physics by dt seconds. Returns new BallState + whether ball sunk. */
export function step(
  ball: BallState,
  hole: HoleDef,
  dt: number,
  gateT: number,
): { ball: BallState; sunk: boolean } {
  if (ball.status === 'sunk' || ball.status === 'idle') {
    return { ball, sunk: false };
  }
  if (ball.status === 'stopped') {
    return { ball, sunk: false };
  }

  let { x, y, vx, vy } = ball;

  // friction factor adjusted for dt
  const f = Math.pow(FRICTION, dt * 60);
  vx *= f;
  vy *= f;

  // sand friction
  for (const sand of hole.sand) {
    if (x >= sand.x && x <= sand.x + sand.w && y >= sand.y && y <= sand.y + sand.h) {
      vx *= sand.friction;
      vy *= sand.friction;
    }
  }

  // apply velocity
  x += vx * dt * 60;
  y += vy * dt * 60;

  const r = BALL_RADIUS;

  // --- bumper collisions (circle vs circle) ---
  for (const bumper of hole.bumpers) {
    const dx = x - bumper.cx;
    const dy = y - bumper.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = r + bumper.r;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      // push out
      x = bumper.cx + nx * minDist;
      y = bumper.cy + ny * minDist;
      // reflect velocity
      const dot = vx * nx + vy * ny;
      vx -= (1 + RESTITUTION) * dot * nx;
      vy -= (1 + RESTITUTION) * dot * ny;
    }
  }

  // --- wall collisions (AABB) ---
  const allWalls = [...hole.walls];
  if (hole.gate) {
    allWalls.push(resolvedGate(hole.gate, gateT));
  }

  for (const w of allWalls) {
    const left = w.x;
    const right = w.x + w.w;
    const top = w.y;
    const bottom = w.y + w.h;

    // overlap test
    if (x + r > left && x - r < right && y + r > top && y - r < bottom) {
      // find shallowest penetration axis
      const overlapLeft = x + r - left;
      const overlapRight = right - (x - r);
      const overlapTop = y + r - top;
      const overlapBottom = bottom - (y - r);

      const minH = Math.min(overlapLeft, overlapRight);
      const minV = Math.min(overlapTop, overlapBottom);

      if (minH < minV) {
        if (overlapLeft < overlapRight) {
          x = left - r;
        } else {
          x = right + r;
        }
        vx = -vx * RESTITUTION;
      } else {
        if (overlapTop < overlapBottom) {
          y = top - r;
        } else {
          y = bottom + r;
        }
        vy = -vy * RESTITUTION;
      }
    }
  }

  // --- hole capture ---
  const hdx = x - hole.hole.x;
  const hdy = y - hole.hole.y;
  const hDist = Math.sqrt(hdx * hdx + hdy * hdy);
  const speed = Math.sqrt(vx * vx + vy * vy);
  const captureR = hole.hole.r * CAPTURE_RADIUS_MULT;

  if (hDist < captureR && speed < CAPTURE_SPEED) {
    return {
      ball: { x: hole.hole.x, y: hole.hole.y, vx: 0, vy: 0, status: 'sunk' },
      sunk: true,
    };
  }

  // --- stop check ---
  const newStatus = speed < STOP_SPEED ? 'stopped' : 'rolling';

  return {
    ball: { x, y, vx, vy, status: newStatus },
    sunk: false,
  };
}

export function resolvedGate(gate: Gate, t: number): { x: number; y: number; w: number; h: number } {
  const offset = gate.amplitude * Math.sin((2 * Math.PI * t) / gate.period + gate.phase);
  return {
    x: gate.x + (gate.axis === 'x' ? offset : 0),
    y: gate.y + (gate.axis === 'y' ? offset : 0),
    w: gate.w,
    h: gate.h,
  };
}

/** Run physics until stopped or sunk (max maxFrames). Returns final state + sunk flag. */
export function simulate(
  ball: BallState,
  hole: HoleDef,
  gateT: number = 0,
  maxFrames = 3600,
): { ball: BallState; sunk: boolean; frames: number } {
  const dt = 1 / 60;
  let b = { ...ball };
  let t = gateT;
  for (let i = 0; i < maxFrames; i++) {
    const { ball: nb, sunk } = step(b, hole, dt, t);
    t += dt;
    b = nb;
    if (sunk) return { ball: b, sunk: true, frames: i + 1 };
    if (b.status === 'stopped') return { ball: b, sunk: false, frames: i + 1 };
  }
  return { ball: b, sunk: false, frames: maxFrames };
}
