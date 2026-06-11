import { Rng } from '../core/rng';

/**
 * Kakuro layout: width×height grid, true = wall (clue holder), false = white.
 * Row 0 and column 0 are always walls. Validity: every white cell sits in a
 * horizontal AND vertical run of length ≥ 2 (≤ 9 is automatic at our sizes),
 * and all whites are orthogonally connected.
 */

export interface KakuroRun {
  cells: number[]; // flat indices, in order
  dir: 'h' | 'v';
  /** Flat index of the wall cell holding this run's clue. */
  clueCell: number;
}

export function layoutValid(walls: boolean[], w: number, h: number): boolean {
  const whites: number[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (walls[i]) continue;
      whites.push(i);
      // horizontal run length
      let lo = c;
      while (lo > 0 && !walls[r * w + lo - 1]) lo--;
      let hi = c;
      while (hi < w - 1 && !walls[r * w + hi + 1]) hi++;
      if (hi - lo + 1 < 2 || hi - lo + 1 > 9) return false;
      // vertical run length
      let lo2 = r;
      while (lo2 > 0 && !walls[(lo2 - 1) * w + c]) lo2--;
      let hi2 = r;
      while (hi2 < h - 1 && !walls[(hi2 + 1) * w + c]) hi2++;
      if (hi2 - lo2 + 1 < 2 || hi2 - lo2 + 1 > 9) return false;
    }
  }
  if (whites.length === 0) return false;
  // connectivity
  const seen = new Set<number>([whites[0]]);
  const stack = [whites[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / w);
    const c = i % w;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc;
      if (!walls[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === whites.length;
}

/** Carve a valid layout by adding symmetric wall pairs to an all-white interior. */
export function generateLayout(
  rng: Rng,
  w: number,
  h: number,
  targetWalls: number,
): boolean[] | null {
  const walls = new Array<boolean>(w * h).fill(false);
  for (let c = 0; c < w; c++) walls[c] = true;
  for (let r = 0; r < h; r++) walls[r * w] = true;
  if (!layoutValid(walls, w, h)) return null;

  const interior: number[] = [];
  for (let r = 1; r < h; r++) for (let c = 1; c < w; c++) interior.push(r * w + c);
  rng.shuffle(interior);

  let added = 0;
  for (const i of interior) {
    if (added >= targetWalls) break;
    if (walls[i]) continue;
    const r = Math.floor(i / w);
    const c = i % w;
    // 180° partner within the interior box
    const pr = h - r;
    const pc = w - c;
    const j = (pr >= 1 && pc >= 1) ? pr * w + pc : -1;
    walls[i] = true;
    let addedNow = 1;
    if (j >= 0 && j !== i && !walls[j]) {
      walls[j] = true;
      addedNow = 2;
    }
    if (layoutValid(walls, w, h)) {
      added += addedNow;
    } else {
      walls[i] = false;
      if (addedNow === 2) walls[j] = false;
      // try the single wall without its partner
      walls[i] = true;
      if (layoutValid(walls, w, h)) {
        added += 1;
      } else {
        walls[i] = false;
      }
    }
  }
  return walls;
}

export function extractRuns(walls: boolean[], w: number, h: number): KakuroRun[] {
  const runs: KakuroRun[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (walls[i]) continue;
      if (c === 0 || walls[r * w + c - 1]) {
        const cells: number[] = [];
        let cc = c;
        while (cc < w && !walls[r * w + cc]) { cells.push(r * w + cc); cc++; }
        runs.push({ cells, dir: 'h', clueCell: r * w + c - 1 });
      }
      if (r === 0 || walls[(r - 1) * w + c]) {
        const cells: number[] = [];
        let rr = r;
        while (rr < h && !walls[rr * w + c]) { cells.push(rr * w + c); rr++; }
        runs.push({ cells, dir: 'v', clueCell: (r - 1) * w + c });
      }
    }
  }
  return runs;
}
