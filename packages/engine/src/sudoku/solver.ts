/**
 * Bitmask backtracking sudoku solver with MRV (minimum remaining values).
 * Grid: number[81], 0 = empty, 1-9 = digit. Candidate masks: bit (d-1) set
 * means digit d is available.
 */

export const ROW = new Array<number>(81);
export const COL = new Array<number>(81);
export const BOX = new Array<number>(81);
for (let i = 0; i < 81; i++) {
  ROW[i] = Math.floor(i / 9);
  COL[i] = i % 9;
  BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
}

export const ALL = 0x1ff; // 9 bits

export function popcount(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

interface Masks {
  rows: number[];
  cols: number[];
  boxes: number[];
}

function buildMasks(grid: number[]): Masks | null {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    if (rows[ROW[i]] & bit || cols[COL[i]] & bit || boxes[BOX[i]] & bit) {
      return null; // contradiction in givens
    }
    rows[ROW[i]] |= bit;
    cols[COL[i]] |= bit;
    boxes[BOX[i]] |= bit;
  }
  return { rows, cols, boxes };
}

export function candidatesAt(grid: number[], m: Masks, i: number): number {
  return ALL & ~(m.rows[ROW[i]] | m.cols[COL[i]] | m.boxes[BOX[i]]);
}

/**
 * Count solutions up to `cap` (default 2 — enough to test uniqueness).
 * Optionally writes the first solution found into `firstSolution`.
 */
export function countSolutions(
  grid: number[],
  cap = 2,
  firstSolution?: number[],
): number {
  const m = buildMasks(grid);
  if (!m) return 0;
  const g = grid.slice();
  let count = 0;

  function rec(): boolean {
    // returns true when cap reached (abort)
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const cand = ALL & ~(m!.rows[ROW[i]] | m!.cols[COL[i]] | m!.boxes[BOX[i]]);
      const pc = popcount(cand);
      if (pc === 0) return false;
      if (pc < bestCount) {
        bestCount = pc;
        best = i;
        bestMask = cand;
        if (pc === 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (count === 1 && firstSolution) {
        for (let i = 0; i < 81; i++) firstSolution[i] = g[i];
      }
      return count >= cap;
    }
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      const d = 31 - Math.clz32(bit) + 1;
      g[best] = d;
      m!.rows[ROW[best]] |= bit;
      m!.cols[COL[best]] |= bit;
      m!.boxes[BOX[best]] |= bit;
      const abort = rec();
      g[best] = 0;
      m!.rows[ROW[best]] &= ~bit;
      m!.cols[COL[best]] &= ~bit;
      m!.boxes[BOX[best]] &= ~bit;
      if (abort) return true;
    }
    return false;
  }

  rec();
  return count;
}

/** Solve and return the (first) solution, or null if unsolvable. */
export function solve(grid: number[]): number[] | null {
  const sol = new Array<number>(81).fill(0);
  const n = countSolutions(grid, 1, sol);
  return n >= 1 ? sol : null;
}
