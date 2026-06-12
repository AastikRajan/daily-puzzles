import { Rng } from '@daily-logic/engine';
import type { HoleDef, WallSegment, Bumper, SandPatch, Gate, BallState } from './types';
import { shoot as physShoot, simulate, HOLE_RADIUS } from './physics';

const CANVAS_W = 390;
const CANVAS_H = 600;
const WALL_T = 16; // wall thickness

/** Build solid border walls. */
function borders(): WallSegment[] {
  return [
    { x: 0, y: 0, w: CANVAS_W, h: WALL_T },                           // top
    { x: 0, y: CANVAS_H - WALL_T, w: CANVAS_W, h: WALL_T },           // bottom
    { x: 0, y: 0, w: WALL_T, h: CANVAS_H },                           // left
    { x: CANVAS_W - WALL_T, y: 0, w: WALL_T, h: CANVAS_H },           // right
  ];
}

type Archetype = 'straight' | 'l-bend' | 's-curve' | 'island' | 'diagonal-alley';

// ── straight ─────────────────────────────────────────────────────────────────
function makeStraight(rng: Rng, index: number): HoleDef {
  // Vertical corridor
  const cw = rng.intRange(80, 160);
  const cx = rng.intRange(WALL_T + cw / 2, CANVAS_W - WALL_T - cw / 2);
  const corridorX = cx - cw / 2;

  const teeY = CANVAS_H - WALL_T - 30;
  const holeY = WALL_T + 40;

  const walls: WallSegment[] = [
    ...borders(),
    { x: WALL_T, y: WALL_T, w: corridorX - WALL_T, h: CANVAS_H - 2 * WALL_T },
    { x: corridorX + cw, y: WALL_T, w: CANVAS_W - WALL_T - (corridorX + cw), h: CANVAS_H - 2 * WALL_T },
  ];

  const bumpers: Bumper[] = [];
  if (rng.chance(0.5)) {
    // bumper off-center inside corridor
    const bx = corridorX + rng.intRange(20, cw - 20);
    const by = CANVAS_H / 2 + rng.intRange(-60, 60);
    bumpers.push({ cx: bx, cy: by, r: 12 });
  }

  const sand: SandPatch[] = [];
  if (rng.chance(0.4)) {
    const sw = rng.intRange(30, cw - 20);
    const sx = corridorX + (cw - sw) / 2;
    const sy = CANVAS_H / 3;
    sand.push({ x: sx, y: sy, w: sw, h: 40, friction: 0.97 });
  }

  return {
    index,
    par: 2,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    tee: { x: corridorX + cw / 2, y: teeY },
    hole: { x: corridorX + cw / 2, y: holeY, r: HOLE_RADIUS },
    walls,
    bumpers,
    sand,
    gate: null,
  };
}

// ── L-bend ───────────────────────────────────────────────────────────────────
function makeLBend(rng: Rng, index: number): HoleDef {
  // Vertical segment + horizontal segment joined at a corner
  const vW = rng.intRange(70, 110);
  const hH = rng.intRange(70, 110);
  const cornerX = rng.intRange(WALL_T + vW, CANVAS_W - WALL_T - 60);
  const cornerY = rng.intRange(WALL_T + 60, CANVAS_H - WALL_T - hH);

  // vertical corridor: x=[WALL_T .. cornerX], y=[cornerY .. CANVAS_H-WALL_T]
  const vLeft = WALL_T;
  const vRight = cornerX;
  // horizontal corridor: x=[vLeft .. CANVAS_W-WALL_T], y=[cornerY-hH .. cornerY]
  const hTop = cornerY - hH;
  const hBottom = cornerY;

  const tee = { x: (vLeft + vRight) / 2, y: CANVAS_H - WALL_T - 25 };
  const hole = { x: CANVAS_W - WALL_T - 35, y: (hTop + hBottom) / 2, r: HOLE_RADIUS };

  // Build walls: fill regions outside the L-shape
  const walls: WallSegment[] = [
    ...borders(),
    // Top-left block (above horiz, left of vert)
    { x: WALL_T, y: WALL_T, w: vRight - WALL_T, h: hTop - WALL_T },
    // Top-right block (above horiz, right of vert until wall)
    // The horizontal corridor occupies x:[WALL_T .. CANVAS_W-WALL_T], y:[hTop..hBottom]
    // Vertical occupies x:[WALL_T .. cornerX], y:[hBottom..CANVAS_H-WALL_T]
    // Right of cornerX, below hBottom: blocked
    {
      x: cornerX,
      y: hBottom,
      w: CANVAS_W - WALL_T - cornerX,
      h: CANVAS_H - WALL_T - hBottom,
    },
  ];

  const bumpers: Bumper[] = [];
  if (rng.chance(0.6)) {
    bumpers.push({
      cx: vLeft + (vRight - vLeft) / 2 + rng.intRange(-10, 10),
      cy: (hBottom + CANVAS_H - WALL_T) / 2,
      r: 11,
    });
  }

  return {
    index,
    par: 3,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    tee,
    hole,
    walls,
    bumpers,
    sand: [],
    gate: null,
  };
}

// ── S-curve ───────────────────────────────────────────────────────────────────
function makeSCurve(rng: Rng, index: number): HoleDef {
  const cW = rng.intRange(80, 120);
  // Three horizontal corridors staggered
  const h1Top = WALL_T;
  const h1Bot = CANVAS_H / 3;
  const h2Top = CANVAS_H / 3;
  const h2Bot = (2 * CANVAS_H) / 3;
  const h3Top = (2 * CANVAS_H) / 3;
  const h3Bot = CANVAS_H - WALL_T;

  // corridor 1: right side
  const c1X = CANVAS_W - WALL_T - cW;
  // corridor 2: left side
  const c2X = WALL_T;
  // corridor 3: right side
  const c3X = CANVAS_W - WALL_T - cW;

  const tee = { x: c3X + cW / 2, y: h3Bot - 25 };
  const hole = { x: c1X + cW / 2, y: h1Top + 35, r: HOLE_RADIUS };

  const walls: WallSegment[] = [
    ...borders(),
    // Block left of corridor1 in band 1
    { x: WALL_T, y: h1Top, w: c1X - WALL_T, h: h1Bot - h1Top },
    // Block right of corridor2 in band 2
    { x: c2X + cW, y: h2Top, w: CANVAS_W - WALL_T - (c2X + cW), h: h2Bot - h2Top },
    // Block left of corridor3 in band 3
    { x: WALL_T, y: h3Top, w: c3X - WALL_T, h: h3Bot - h3Top },
  ];

  const bumpers: Bumper[] = [];
  const sand: SandPatch[] = rng.chance(0.5)
    ? [{ x: c2X + 10, y: h2Top + 30, w: cW - 20, h: 40, friction: 0.975 }]
    : [];

  return {
    index,
    par: 3,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    tee,
    hole,
    walls,
    bumpers,
    sand,
    gate: null,
  };
}

// ── island ────────────────────────────────────────────────────────────────────
function makeIsland(rng: Rng, index: number): HoleDef {
  // Open area with a rectangular obstacle in the middle
  const bW = rng.intRange(80, 140);
  const bH = rng.intRange(80, 140);
  const bX = (CANVAS_W - bW) / 2 + rng.intRange(-30, 30);
  const bY = (CANVAS_H - bH) / 2 + rng.intRange(-40, 40);

  // Tee: bottom-left area; Hole: top-right area
  const tee = { x: WALL_T + 35, y: CANVAS_H - WALL_T - 35 };
  const hole = { x: CANVAS_W - WALL_T - 35, y: WALL_T + 35, r: HOLE_RADIUS };

  const walls: WallSegment[] = [
    ...borders(),
    { x: bX, y: bY, w: bW, h: bH },
  ];

  const bumpers: Bumper[] = [
    { cx: bX - 20, cy: bY + bH / 2, r: 10 },
    { cx: bX + bW + 20, cy: bY + bH / 2, r: 10 },
  ];

  const sand: SandPatch[] = rng.chance(0.5)
    ? [{ x: bX + bW / 4, y: bY + bH + 10, w: bW / 2, h: 30, friction: 0.97 }]
    : [];

  return {
    index,
    par: 3,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    tee,
    hole,
    walls,
    bumpers,
    sand,
    gate: null,
  };
}

// ── diagonal-alley ────────────────────────────────────────────────────────────
function makeDiagonalAlley(rng: Rng, index: number): HoleDef {
  // Wide area, bumpers guide ball diagonally
  const tee = { x: WALL_T + 30, y: CANVAS_H - WALL_T - 30 };
  const hole = { x: CANVAS_W - WALL_T - 30, y: WALL_T + 30, r: HOLE_RADIUS };

  const walls: WallSegment[] = [...borders()];

  // Diagonal bumper guides: staggered pairs
  const bumpers: Bumper[] = [];
  const steps = rng.intRange(3, 5);
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / (steps + 1);
    const cx = WALL_T + t * (CANVAS_W - 2 * WALL_T);
    const cy = CANVAS_H - WALL_T - t * (CANVAS_H - 2 * WALL_T);
    bumpers.push({ cx, cy, r: rng.intRange(10, 16) });
  }

  const sand: SandPatch[] = rng.chance(0.5)
    ? [
        {
          x: CANVAS_W / 2 - 30,
          y: CANVAS_H / 2 - 25,
          w: 60,
          h: 50,
          friction: 0.975,
        },
      ]
    : [];

  return {
    index,
    par: 4,
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    tee,
    hole,
    walls,
    bumpers,
    sand,
    gate: null,
  };
}

// ── archetype selector ────────────────────────────────────────────────────────
const ARCHETYPES: Archetype[] = ['straight', 'l-bend', 's-curve', 'island', 'diagonal-alley'];

function buildHole(rng: Rng, index: number, archetype: Archetype): HoleDef {
  switch (archetype) {
    case 'straight': return makeStraight(rng, index);
    case 'l-bend': return makeLBend(rng, index);
    case 's-curve': return makeSCurve(rng, index);
    case 'island': return makeIsland(rng, index);
    case 'diagonal-alley': return makeDiagonalAlley(rng, index);
  }
}

/** Add gate to holes 5–8. */
function addGate(hole: HoleDef, rng: Rng): HoleDef {
  // Find a spot roughly midway between tee and hole
  const mx = (hole.tee.x + hole.hole.x) / 2;
  const my = (hole.tee.y + hole.hole.y) / 2;
  const isHoriz = Math.abs(hole.tee.x - hole.hole.x) > Math.abs(hole.tee.y - hole.hole.y);

  const gateW = isHoriz ? 20 : 60;
  const gateH = isHoriz ? 60 : 20;

  const gate: Gate = {
    x: mx - gateW / 2,
    y: my - gateH / 2,
    w: gateW,
    h: gateH,
    axis: isHoriz ? 'y' : 'x',
    period: rng.intRange(2, 4),
    amplitude: rng.intRange(25, 50),
    phase: rng.next() * Math.PI * 2,
  };

  return { ...hole, gate };
}

/** Quick completability check: sample 216 shots, simulate ≤6 strokes. */
function isCompletable(hole: HoleDef): boolean {
  const angles = 36;
  const powers = 6;
  const maxStrokes = 6;

  for (let ai = 0; ai < angles; ai++) {
    const angle = (ai / angles) * Math.PI * 2;
    for (let pi = 1; pi <= powers; pi++) {
      const power = pi / powers;
      let ball: BallState = {
        x: hole.tee.x,
        y: hole.tee.y,
        vx: 0,
        vy: 0,
        status: 'idle',
      };
      ball = physShoot(ball, angle, power);
      let strokes = 1;
      let { ball: b, sunk } = simulate(ball, hole, 0, 3600);
      if (sunk) return true;
      // greedy: aim at hole for next strokes
      while (strokes < maxStrokes) {
        const dx = hole.hole.x - b.x;
        const dy = hole.hole.y - b.y;
        const ang = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const p = Math.min(dist / 200, 1);
        b = physShoot(b, ang, p);
        const result = simulate(b, hole, 0, 3600);
        b = result.ball;
        if (result.sunk) return true;
        strokes++;
      }
    }
  }
  return false;
}

/** Generate 9 holes for a date string (YYYY-MM-DD). */
export function generateCourse(date: string): HoleDef[] {
  const holes: HoleDef[] = [];

  // Cycle through all 5 archetypes for first 5 holes, then repeat with gates
  const sequence: Archetype[] = [
    'straight',
    'l-bend',
    's-curve',
    'island',
    'diagonal-alley',
    'straight',
    'l-bend',
    's-curve',
    'island',
  ];

  for (let i = 0; i < 9; i++) {
    const rng = new Rng(`golf:${date}:${i}`);
    const archetype = sequence[i] ?? ARCHETYPES[rng.int(ARCHETYPES.length)];
    let hole = buildHole(rng, i, archetype);

    // Add gate for holes 5–8
    if (i >= 5) {
      hole = addGate(hole, rng);
    }

    // Completability safety net
    if (!isCompletable(hole)) {
      console.warn(`[golf] hole ${i} not completable, falling back to straight`);
      const rng2 = new Rng(`golf:${date}:${i}:fallback`);
      hole = makeStraight(rng2, i);
    }

    holes.push(hole);
  }

  return holes;
}
