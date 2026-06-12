/**
 * Bank Shot — level definitions.
 * All coordinates are in the LOGICAL 390×780 scene.
 * Levels are seeded by index via a tiny LCG so retries are fair.
 */

export interface Target {
  x: number;
  y: number;
  r: number;
  /** sinusoidal motion: amplitude + axis */
  motion?: { axis: 'x' | 'y'; amplitude: number; period: number; phase: number };
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelDef {
  targets: Target[];
  walls: Wall[];
}

/** tiny LCG — returns deterministic pseudo-random sequence for a given seed */
function makeLCG(seed: number): () => number {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function rng(seed: number) {
  const r = makeLCG(seed);
  return {
    next: r,
    range: (lo: number, hi: number) => lo + r() * (hi - lo),
    pick: <T>(arr: T[]): T => arr[Math.floor(r() * arr.length)]!,
  };
}

/** The turret sits at (195, 730) in logical coords. */
export const TURRET = { x: 195, y: 730 };

/** Scene logical size */
export const SCENE_W = 390;
export const SCENE_H = 780;

export function generateLevel(levelIndex: number): LevelDef {
  const r = rng(levelIndex + 7919); // prime offset so level 0 isn't degenerate

  const difficulty = Math.min(levelIndex, 11); // 0..11

  // ——— walls ———
  const walls: Wall[] = [];

  // Level 0-1: no walls. Level 2+: add 1-4 walls
  const wallCount = difficulty < 2 ? 0 : Math.min(1 + Math.floor((difficulty - 2) * 0.6), 4);

  const wallTemplates: Wall[][] = [
    // horizontal shelf left
    [{ x: 20, y: 260, w: 120, h: 18 }],
    // horizontal shelf right
    [{ x: 250, y: 260, w: 120, h: 18 }],
    // center pillar
    [{ x: 170, y: 220, w: 50, h: 80 }],
    // two short walls
    [{ x: 50, y: 320, w: 80, h: 16 }, { x: 260, y: 200, w: 80, h: 16 }],
    // cross walls
    [{ x: 140, y: 180, w: 16, h: 80 }, { x: 234, y: 280, w: 16, h: 80 }],
    // big L
    [{ x: 60, y: 230, w: 130, h: 18 }, { x: 60, y: 230, w: 18, h: 90 }],
    // zigzag
    [{ x: 30, y: 190, w: 100, h: 16 }, { x: 260, y: 270, w: 100, h: 16 }],
    // box island
    [{ x: 155, y: 210, w: 80, h: 16 }, { x: 155, y: 360, w: 80, h: 16 }],
  ];

  for (let i = 0; i < wallCount && i < wallTemplates.length; i++) {
    const idx = Math.floor(r.range(0, wallTemplates.length));
    const tmpl = wallTemplates[idx % wallTemplates.length]!;
    for (const w of tmpl) walls.push({ ...w });
    // avoid pushing the same template twice in a row
  }

  // ——— targets ———
  const targetCount = 2 + Math.min(Math.floor(difficulty * 0.4), 4); // 2..6
  const targets: Target[] = [];

  // Grid of safe zones (avoid walls, avoid each other, avoid turret)
  const safeZones = [
    { x: 80, y: 130 }, { x: 195, y: 120 }, { x: 310, y: 130 },
    { x: 70, y: 220 }, { x: 195, y: 220 }, { x: 320, y: 220 },
    { x: 80, y: 320 }, { x: 195, y: 310 }, { x: 310, y: 320 },
    { x: 110, y: 180 }, { x: 280, y: 180 }, { x: 110, y: 380 },
    { x: 280, y: 380 }, { x: 195, y: 400 }, { x: 60, y: 160 },
    { x: 330, y: 160 }, { x: 60, y: 380 }, { x: 330, y: 380 },
  ];

  // GUARANTEE: first target always in near-direct line of sight from turret
  // Place one target directly above the turret (no walls blocking at level 0-2)
  const directTargets = [
    { x: 195, y: 160 },
    { x: 195, y: 200 },
    { x: 195, y: 180 },
  ];
  const directTarget = directTargets[levelIndex % directTargets.length] ?? directTargets[0]!;
  targets.push({ x: directTarget.x, y: directTarget.y, r: 18 });

  // Shuffle safe zones and pick remaining targets
  const shuffled = [...safeZones].sort(() => r.next() - 0.5);
  for (const zone of shuffled) {
    if (targets.length >= targetCount) break;
    // Check distance from existing targets
    const farEnough = targets.every(t => Math.hypot(t.x - zone.x, t.y - zone.y) > 60);
    // Check not on top of wall
    const notOnWall = walls.every(w =>
      zone.x < w.x - 30 || zone.x > w.x + w.w + 30 ||
      zone.y < w.y - 30 || zone.y > w.y + w.h + 30
    );
    if (farEnough && notOnWall) {
      const t: Target = { x: zone.x, y: zone.y, r: 18 };
      // Add motion for level 6+
      if (difficulty >= 6 && targets.length >= 1 && r.next() > 0.55) {
        t.motion = {
          axis: r.next() > 0.5 ? 'x' : 'y',
          amplitude: 30 + r.range(0, 30),
          period: 2 + r.range(0, 2),
          phase: r.range(0, Math.PI * 2),
        };
      }
      targets.push(t);
    }
  }

  // Fill remaining with fallback positions if needed
  const fallbacks = [
    { x: 100, y: 150 }, { x: 290, y: 150 }, { x: 195, y: 250 },
    { x: 80, y: 350 }, { x: 310, y: 350 },
  ];
  let fi = 0;
  while (targets.length < targetCount && fi < fallbacks.length) {
    const fb = fallbacks[fi++]!;
    if (targets.every(t => Math.hypot(t.x - fb.x, t.y - fb.y) > 50)) {
      targets.push({ x: fb.x, y: fb.y, r: 18 });
    }
  }

  return { targets, walls };
}
