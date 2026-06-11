/**
 * Technique-limited solver used purely for grading.
 *
 * Tier 1 (easy):   solvable with naked + hidden singles only.
 * Tier 2 (medium): additionally needs locked candidates (pointing/claiming)
 *                  and/or naked pairs.
 * Tier 3 (hard):   the above techniques don't finish the puzzle (player needs
 *                  deeper logic or trial).
 */
import { ROW, COL, BOX, ALL, popcount } from './solver';

const UNITS: number[][] = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const cells: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br + r) * 9 + bc + c);
  UNITS.push(cells);
}

function computeCandidates(g: number[]): number[] {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (g[i]) {
      const bit = 1 << (g[i] - 1);
      rows[ROW[i]] |= bit;
      cols[COL[i]] |= bit;
      boxes[BOX[i]] |= bit;
    }
  }
  const cand = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    cand[i] = g[i] ? 0 : ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
  }
  return cand;
}

function applySingles(g: number[], cand: number[]): boolean {
  let progress = false;
  // naked singles
  for (let i = 0; i < 81; i++) {
    if (!g[i] && popcount(cand[i]) === 1) {
      g[i] = 31 - Math.clz32(cand[i]) + 1;
      progress = true;
    }
  }
  if (progress) return true;
  // hidden singles
  for (const unit of UNITS) {
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d;
      let where = -1;
      let n = 0;
      let placed = false;
      for (const i of unit) {
        if (g[i] === d + 1) { placed = true; break; }
        if (!g[i] && cand[i] & bit) { n++; where = i; }
      }
      if (!placed && n === 1) {
        g[where] = d + 1;
        return true;
      }
    }
  }
  return false;
}

/** Locked candidates + naked pairs; mutates cand, returns true on progress. */
function applyTier2(g: number[], cand: number[]): boolean {
  // locked candidates (pointing): digit in a box confined to one row/col →
  // eliminate from rest of that row/col
  for (let b = 0; b < 9; b++) {
    const cells = UNITS[18 + b];
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d;
      const spots = cells.filter((i) => !g[i] && cand[i] & bit);
      if (spots.length < 2 || spots.length > 3) continue;
      const sameRow = spots.every((i) => ROW[i] === ROW[spots[0]]);
      const sameCol = spots.every((i) => COL[i] === COL[spots[0]]);
      if (sameRow) {
        let changed = false;
        for (let c = 0; c < 9; c++) {
          const i = ROW[spots[0]] * 9 + c;
          if (BOX[i] !== b && !g[i] && cand[i] & bit) { cand[i] &= ~bit; changed = true; }
        }
        if (changed) return true;
      }
      if (sameCol) {
        let changed = false;
        for (let r = 0; r < 9; r++) {
          const i = r * 9 + COL[spots[0]];
          if (BOX[i] !== b && !g[i] && cand[i] & bit) { cand[i] &= ~bit; changed = true; }
        }
        if (changed) return true;
      }
    }
  }
  // claiming: digit in a row/col confined to one box → eliminate from rest of box
  for (let u = 0; u < 18; u++) {
    const cells = UNITS[u];
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d;
      const spots = cells.filter((i) => !g[i] && cand[i] & bit);
      if (spots.length < 2 || spots.length > 3) continue;
      const box = BOX[spots[0]];
      if (!spots.every((i) => BOX[i] === box)) continue;
      let changed = false;
      for (const i of UNITS[18 + box]) {
        if (!cells.includes(i) && !g[i] && cand[i] & bit) { cand[i] &= ~bit; changed = true; }
      }
      if (changed) return true;
    }
  }
  // naked pairs
  for (const unit of UNITS) {
    const empty = unit.filter((i) => !g[i]);
    for (let a = 0; a < empty.length; a++) {
      if (popcount(cand[empty[a]]) !== 2) continue;
      for (let b2 = a + 1; b2 < empty.length; b2++) {
        if (cand[empty[b2]] !== cand[empty[a]]) continue;
        let changed = false;
        for (const i of empty) {
          if (i !== empty[a] && i !== empty[b2] && cand[i] & cand[empty[a]]) {
            cand[i] &= ~cand[empty[a]];
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return false;
}

export type Tier = 1 | 2 | 3;

/** Highest technique tier needed to finish the puzzle with human logic. */
export function techniqueTier(puzzle: number[]): Tier {
  const g = puzzle.slice();
  let tier: Tier = 1;
  for (;;) {
    if (g.every((v) => v !== 0)) return tier;
    const cand = computeCandidates(g);
    if (applySingles(g, cand)) continue;
    // singles stalled — try tier 2 eliminations against fresh candidates,
    // looping eliminations until a single appears or tier 2 also stalls
    let cand2 = computeCandidates(g);
    let advanced = false;
    while (applyTier2(g, cand2)) {
      tier = tier < 2 ? 2 : tier;
      if (applySingles(g, cand2)) { advanced = true; break; }
    }
    if (!advanced) return 3;
  }
}
