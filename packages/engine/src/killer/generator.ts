import { Rng } from '../core/rng';
import type { Difficulty, PuzzleBase, Hint } from '../core/types';
import { fillGrid } from '../sudoku/generator';
import { ROW, COL, BOX, ALL } from '../sudoku/solver';
import { allowedDigits } from '../kakuro/solver';

export interface KillerCage {
  cells: number[];
  sum: number;
}

export interface KillerPuzzle extends PuzzleBase {
  type: 'killer';
  cages: KillerCage[];
  /** 81 cells, 0 = empty; pre-revealed digits per difficulty. */
  givens: number[];
  /** 81 cells, the unique solution. */
  solution: number[];
}

interface Params { maxCage: number; baseGivens: number; maxGivens: number }

/**
 * Difficulty is driven by revealed digits (and cage size). Random cage
 * partitions are rarely unique on their own (domino-swap ambiguities), so
 * generation seeds a few givens and then reveal-repairs to uniqueness —
 * the count of revealed digits is the grading signal.
 */
export const KILLER_PARAMS: Record<Difficulty, Params> = {
  easy: { maxCage: 3, baseGivens: 10, maxGivens: 14 },
  medium: { maxCage: 4, baseGivens: 5, maxGivens: 7 },
  hard: { maxCage: 4, baseGivens: 2, maxGivens: 4 },
};

export function gradeKiller(p: { givens: number[]; cages: KillerCage[] }): Difficulty {
  const g = p.givens.filter((v) => v !== 0).length;
  return g >= 8 ? 'easy' : g >= 5 ? 'medium' : 'hard';
}

/** Partition the 81 cells into orthogonally-connected cages (no digit repeats). */
function buildCages(rng: Rng, solution: number[], maxCage: number): KillerCage[] {
  const cageOf = new Array<number>(81).fill(-1);
  const cages: number[][] = [];
  const order = rng.shuffle(Array.from({ length: 81 }, (_, i) => i));

  const neighbors = (i: number): number[] => {
    const out: number[] = [];
    const r = ROW[i];
    const c = COL[i];
    if (r > 0) out.push(i - 9);
    if (r < 8) out.push(i + 9);
    if (c > 0) out.push(i - 1);
    if (c < 8) out.push(i + 1);
    return out;
  };

  for (const start of order) {
    if (cageOf[start] !== -1) continue;
    const id = cages.length;
    const cells = [start];
    cageOf[start] = id;
    const target = rng.intRange(2, maxCage);
    while (cells.length < target) {
      const frontier: number[] = [];
      for (const cell of cells) {
        for (const nb of neighbors(cell)) {
          if (cageOf[nb] !== -1) continue;
          if (cells.some((c2) => solution[c2] === solution[nb])) continue;
          if (!frontier.includes(nb)) frontier.push(nb);
        }
      }
      if (frontier.length === 0) break;
      const next = rng.pick(frontier);
      cageOf[next] = id;
      cells.push(next);
    }
    cages.push(cells);
  }

  // merge singleton cages into a digit-compatible neighbor cage when possible
  for (let id = 0; id < cages.length; id++) {
    if (cages[id].length !== 1) continue;
    const cell = cages[id][0];
    for (const nb of neighbors(cell)) {
      const nid = cageOf[nb];
      if (nid === id) continue;
      const target = cages[nid];
      if (target.length >= maxCage + 1) continue;
      if (target.some((c2) => solution[c2] === solution[cell])) continue;
      target.push(cell);
      cageOf[cell] = nid;
      cages[id] = [];
      break;
    }
  }

  return cages
    .filter((cells) => cells.length > 0)
    .map((cells) => ({
      cells: cells.sort((a, b) => a - b),
      sum: cells.reduce((s, c) => s + solution[c], 0),
    }));
}

/**
 * Count killer solutions up to cap. Candidates = sudoku row/col/box mask ∧
 * cage feasibility via the kakuro magic-block tables. `budget` bounds search
 * nodes so a pathological cage layout fails fast and gets regenerated.
 */
export function countKillerSolutions(
  cages: KillerCage[],
  givens: number[],
  cap = 2,
  budget = 400_000,
  /** When provided, every found solution is pushed here (up to cap). */
  allSolutions?: number[][],
): number {
  const g = givens.slice();
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  const cageIdx = new Array<number>(81).fill(-1);
  const cageMask = new Array<number>(cages.length).fill(0);
  const cageSum = new Array<number>(cages.length).fill(0);
  const cageEmpty = cages.map((c) => c.cells.length);
  cages.forEach((cage, ci) => {
    for (const cell of cage.cells) cageIdx[cell] = ci;
  });
  for (let i = 0; i < 81; i++) {
    if (g[i] === 0) continue;
    const bit = 1 << (g[i] - 1);
    if (rows[ROW[i]] & bit || cols[COL[i]] & bit || boxes[BOX[i]] & bit) return 0;
    rows[ROW[i]] |= bit;
    cols[COL[i]] |= bit;
    boxes[BOX[i]] |= bit;
    const ci = cageIdx[i];
    if (cageMask[ci] & bit) return 0;
    cageMask[ci] |= bit;
    cageSum[ci] += g[i];
    cageEmpty[ci]--;
  }

  let count = 0;
  let nodes = 0;

  function candidates(i: number): number {
    const ci = cageIdx[i];
    const sudoku = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
    const cage = allowedDigits(cageMask[ci], cageSum[ci], cageEmpty[ci], cages[ci].sum);
    return sudoku & cage;
  }

  function rec(): boolean {
    if (++nodes > budget) return true; // abort: treated as failure by caller
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const cand = candidates(i);
      let n = 0;
      let m = cand;
      while (m) { n++; m &= m - 1; }
      if (n === 0) return false;
      if (n < bestCount) { bestCount = n; best = i; bestMask = cand; if (n === 1) break; }
    }
    if (best === -1) {
      count++;
      if (allSolutions) allSolutions.push(g.slice());
      return count >= cap;
    }
    const ci = cageIdx[best];
    let m = bestMask;
    while (m) {
      const bit = m & -m;
      m ^= bit;
      const d = 31 - Math.clz32(bit) + 1;
      g[best] = d;
      rows[ROW[best]] |= bit;
      cols[COL[best]] |= bit;
      boxes[BOX[best]] |= bit;
      cageMask[ci] |= bit;
      cageSum[ci] += d;
      cageEmpty[ci]--;
      const abort = rec();
      g[best] = 0;
      rows[ROW[best]] &= ~bit;
      cols[COL[best]] &= ~bit;
      boxes[BOX[best]] &= ~bit;
      cageMask[ci] &= ~bit;
      cageSum[ci] -= d;
      cageEmpty[ci]++;
      if (abort) return true;
    }
    return false;
  }

  rec();
  if (nodes > budget) return -1; // budget exceeded: undetermined
  return count;
}

export function generateKiller(seed: string, difficulty: Difficulty): KillerPuzzle {
  const rng = new Rng(`killer:${seed}:${difficulty}`);
  const { maxCage, baseGivens, maxGivens } = KILLER_PARAMS[difficulty];

  for (let attempt = 0; attempt < 80; attempt++) {
    const solution = fillGrid(rng);
    const cages = buildCages(rng, solution, maxCage);
    const givens = new Array<number>(81).fill(0);
    const order = rng.shuffle(Array.from({ length: 81 }, (_, i) => i));
    for (let k = 0; k < baseGivens; k++) givens[order[k]] = solution[order[k]];

    // reveal-repair to uniqueness, bounded by the tier's given budget.
    // On a blown node budget (underconstrained search), revealing any cell
    // is far cheaper than re-rolling the whole grid.
    let ok = false;
    for (;;) {
      const sols: number[][] = [];
      const n = countKillerSolutions(cages, givens, 2, 40_000, sols);
      if (n === 1) { ok = true; break; }
      if (n === 0) break; // contradiction — re-roll
      if (givens.filter((v) => v !== 0).length >= maxGivens) break;
      let reveal = -1;
      if (n === 2) {
        let bestSpread = -1;
        for (let i = 0; i < 81; i++) {
          if (givens[i] !== 0) continue;
          const seen = new Set<number>();
          for (const s of sols) seen.add(s[i]);
          if (seen.size > bestSpread) { bestSpread = seen.size; reveal = i; }
        }
        if (bestSpread < 2) reveal = -1;
      } else {
        // budget exceeded — reveal a deterministic random unrevealed cell
        const open = order.filter((i) => givens[i] === 0);
        if (open.length > 0) reveal = open[rng.int(open.length)];
      }
      if (reveal === -1) break;
      givens[reveal] = solution[reveal];
    }
    if (!ok) continue;
    if (gradeKiller({ givens, cages }) !== difficulty) continue;
    return { type: 'killer', seed, difficulty, cages, givens, solution };
  }
  throw new Error(`killer generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function killerHint(puzzle: KillerPuzzle, state: number[]): Hint | null {
  for (let i = 0; i < 81; i++) {
    if (state[i] !== 0 && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  // reveal a cell from the smallest unfinished cage (most actionable)
  let bestCage: KillerCage | null = null;
  for (const cage of puzzle.cages) {
    if (cage.cells.every((c) => state[c] !== 0)) continue;
    if (!bestCage || cage.cells.length < bestCage.cells.length) bestCage = cage;
  }
  if (!bestCage) return null;
  const cell = bestCage.cells.find((c) => state[c] === 0)!;
  return { cell, value: puzzle.solution[cell] };
}
