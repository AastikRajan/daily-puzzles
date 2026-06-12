import type { KakuroRun } from './layout';

/**
 * Kakuro solving support. Digits 1-9 as bitmask bits 0-8.
 * SUBSETS[count][sum] = all digit-set masks with that cardinality and sum —
 * the "magic block" tables that drive candidate pruning.
 */
const SUBSETS: number[][][] = [];
for (let cnt = 0; cnt <= 9; cnt++) {
  SUBSETS.push(Array.from({ length: 46 }, () => [] as number[]));
}
for (let mask = 1; mask < 512; mask++) {
  let cnt = 0;
  let sum = 0;
  for (let d = 0; d < 9; d++) {
    if (mask & (1 << d)) { cnt++; sum += d + 1; }
  }
  SUBSETS[cnt][sum].push(mask);
}

/**
 * Digits allowed in the empty cells of a run: union over completions Q of
 * the remaining digits such that |Q| = empty count and sum(Q) = remaining sum,
 * where Q avoids digits already placed in the run.
 */
export function allowedDigits(placedMask: number, placedSum: number, emptyCount: number, runSum: number): number {
  const need = runSum - placedSum;
  if (need < 0 || emptyCount === 0) return 0;
  if (need > 45) return 0;
  let union = 0;
  for (const m of SUBSETS[emptyCount][need] ?? []) {
    if ((m & placedMask) === 0) union |= m;
  }
  return union;
}

export interface KakuroCellRuns {
  h: number; // run index
  v: number;
}

/**
 * Count solutions (cap default 2). `values` maps flat grid index → digit for
 * pre-filled cells (0 = empty); only white cells appear in `cellIds`.
 */
export function countKakuroSolutions(
  runs: KakuroRun[],
  sums: number[],
  whiteCells: number[],
  cap = 2,
  firstSolution?: Map<number, number>,
  givens?: Map<number, number>,
  /** When provided, every found solution is pushed here (up to cap). */
  allSolutions?: Map<number, number>[],
  /** Node budget; exceeded ⇒ returns -1 (undetermined). */
  budget = 300_000,
): number {
  // per-run state
  const placedMask = new Array<number>(runs.length).fill(0);
  const placedSum = new Array<number>(runs.length).fill(0);
  const emptyCount = runs.map((r) => r.cells.length);
  // cell → its two runs
  const cellRuns = new Map<number, KakuroCellRuns>();
  for (const i of whiteCells) cellRuns.set(i, { h: -1, v: -1 });
  runs.forEach((run, ri) => {
    for (const cell of run.cells) {
      const cr = cellRuns.get(cell)!;
      if (run.dir === 'h') cr.h = ri;
      else cr.v = ri;
    }
  });
  const value = new Map<number, number>();
  for (const i of whiteCells) value.set(i, 0);

  // apply givens
  if (givens) {
    for (const [cell, d] of givens) {
      const cr = cellRuns.get(cell)!;
      const bit = 1 << (d - 1);
      for (const ri of [cr.h, cr.v]) {
        if (placedMask[ri] & bit) return 0; // contradictory givens
        placedMask[ri] |= bit;
        placedSum[ri] += d;
        emptyCount[ri]--;
      }
      value.set(cell, d);
    }
  }

  let count = 0;
  let nodes = 0;

  function candidates(cell: number): number {
    const cr = cellRuns.get(cell)!;
    const ah = allowedDigits(placedMask[cr.h], placedSum[cr.h], emptyCount[cr.h], sums[cr.h]);
    const av = allowedDigits(placedMask[cr.v], placedSum[cr.v], emptyCount[cr.v], sums[cr.v]);
    return ah & av;
  }

  function rec(): boolean {
    if (++nodes > budget) return true; // abort search
    // MRV
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (const i of whiteCells) {
      if (value.get(i) !== 0) continue;
      const cand = candidates(i);
      let n = 0;
      let m = cand;
      while (m) { n++; m &= m - 1; }
      if (n === 0) return false;
      if (n < bestCount) { bestCount = n; best = i; bestMask = cand; if (n === 1) break; }
    }
    if (best === -1) {
      count++;
      if (count === 1 && firstSolution) {
        for (const [k, v] of value) firstSolution.set(k, v);
      }
      if (allSolutions) allSolutions.push(new Map(value));
      return count >= cap;
    }
    const cr = cellRuns.get(best)!;
    let m = bestMask;
    while (m) {
      const bit = m & -m;
      m ^= bit;
      const d = 31 - Math.clz32(bit) + 1;
      value.set(best, d);
      for (const ri of [cr.h, cr.v]) {
        placedMask[ri] |= bit;
        placedSum[ri] += d;
        emptyCount[ri]--;
      }
      const abort = rec();
      value.set(best, 0);
      for (const ri of [cr.h, cr.v]) {
        placedMask[ri] &= ~bit;
        placedSum[ri] -= d;
        emptyCount[ri]++;
      }
      if (abort) return true;
    }
    return false;
  }

  rec();
  if (nodes > budget) return -1;
  return count;
}
