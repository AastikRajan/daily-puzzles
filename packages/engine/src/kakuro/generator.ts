import { Rng } from '../core/rng';
import type { Difficulty, PuzzleBase, Hint } from '../core/types';
import { generateLayout, extractRuns, type KakuroRun } from './layout';
import { countKakuroSolutions } from './solver';

export interface KakuroPuzzle extends PuzzleBase {
  type: 'kakuro';
  width: number;
  height: number;
  /** true = wall/clue cell. */
  walls: boolean[];
  runs: KakuroRun[];
  /** Sum for each run (parallel to runs). */
  sums: number[];
  /** Flat indices of playable cells. */
  whiteCells: number[];
  /** Pre-revealed digits (cell → digit) that pin the solution to uniqueness. */
  givens: Record<number, number>;
  /** cell index → digit, the unique solution. */
  solution: Record<number, number>;
}

interface Params { w: number; h: number; walls: number }

export const KAKURO_PARAMS: Record<Difficulty, Params> = {
  easy: { w: 6, h: 6, walls: 7 },
  medium: { w: 8, h: 8, walls: 14 },
  hard: { w: 9, h: 9, walls: 16 },
};

export function gradeKakuro(p: { whiteCells: number[] }): Difficulty {
  const n = p.whiteCells.length;
  return n <= 20 ? 'easy' : n <= 36 ? 'medium' : 'hard';
}

/**
 * Fill whites with digits (1-9, distinct within each run) by backtracking.
 * Each run gets a random low/high "personality"; cells prefer digits matching
 * both their runs' personalities. Homogeneous-extreme runs produce magic-block
 * sums (3, 4, 16, 17, …) that sharply constrain solutions, minimizing the
 * number of revealed givens needed for uniqueness.
 */
function fillDigits(rng: Rng, runs: KakuroRun[], whiteCells: number[]): Map<number, number> | null {
  const cellRunIdx = new Map<number, number[]>();
  for (const i of whiteCells) cellRunIdx.set(i, []);
  runs.forEach((run, ri) => {
    for (const c of run.cells) cellRunIdx.get(c)!.push(ri);
  });
  const low = runs.map(() => rng.chance(0.5));
  const usedMask = new Array<number>(runs.length).fill(0);
  const value = new Map<number, number>();
  const order = rng.shuffle(whiteCells.slice());
  let nodes = 0;
  const BUDGET = 100_000; // biased fills can conflict pathologically on some layouts

  function digitOrder(rs: number[]): number[] {
    // score: affinity to personalities, plus jitter so seeds diverge
    const scored = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
      let s = 0;
      for (const ri of rs) s += low[ri] ? 10 - d : d;
      return { d, s: s + rng.next() * 2 };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.d);
  }

  function rec(idx: number): boolean {
    if (idx === order.length) return true;
    if (++nodes > BUDGET) return false; // give up; caller re-rolls the layout
    const cell = order[idx];
    const rs = cellRunIdx.get(cell)!;
    for (const d of digitOrder(rs)) {
      const bit = 1 << (d - 1);
      if (rs.some((ri) => usedMask[ri] & bit)) continue;
      value.set(cell, d);
      for (const ri of rs) usedMask[ri] |= bit;
      if (rec(idx + 1)) return true;
      value.delete(cell);
      for (const ri of rs) usedMask[ri] &= ~bit;
      if (nodes > BUDGET) return false;
    }
    return false;
  }

  return rec(0) && nodes <= BUDGET ? value : null;
}

export function generateKakuro(seed: string, difficulty: Difficulty): KakuroPuzzle {
  const rng = new Rng(`kakuro:${seed}:${difficulty}`);
  const { w, h, walls: targetWalls } = KAKURO_PARAMS[difficulty];

  for (let attempt = 0; attempt < 100; attempt++) {
    const walls = generateLayout(rng, w, h, targetWalls);
    if (!walls) continue;
    const runs = extractRuns(walls, w, h);
    const whiteCells: number[] = [];
    for (let i = 0; i < w * h; i++) if (!walls[i]) whiteCells.push(i);
    if (gradeKakuro({ whiteCells }) !== difficulty) continue;

    const fill = fillDigits(rng, runs, whiteCells);
    if (!fill) continue;
    const sums = runs.map((run) => run.cells.reduce((s, c) => s + fill.get(c)!, 0));

    // reveal-repair: while several solutions exist, reveal the fill digit of
    // a cell where two solutions disagree; strictly shrinks the solution set.
    // A blown node budget (underconstrained instance) also triggers a reveal —
    // far cheaper than re-rolling the whole layout.
    const givens = new Map<number, number>();
    const maxGivens = Math.max(2, Math.floor(whiteCells.length / 5));
    let ok = false;
    for (let round = 0; round <= whiteCells.length; round++) {
      const sols: Map<number, number>[] = [];
      const n = countKakuroSolutions(runs, sums, whiteCells, 4, undefined, givens, sols, 60_000);
      if (n === 1) { ok = true; break; }
      if (n === 0) break; // contradictory (shouldn't happen — fill satisfies)
      if (givens.size >= maxGivens) break; // this instance needs too many reveals
      let bestCell = -1;
      if (n > 1) {
        // pick the disagreeing cell that splits the found solutions most evenly
        let bestSpread = -1;
        for (const cell of whiteCells) {
          if (givens.has(cell)) continue;
          const seen = new Set<number>();
          for (const s of sols) seen.add(s.get(cell)!);
          if (seen.size > 1 && seen.size > bestSpread) {
            bestSpread = seen.size;
            bestCell = cell;
          }
        }
      } else {
        // budget exceeded — reveal a deterministic random unrevealed cell
        const open = whiteCells.filter((c) => !givens.has(c));
        if (open.length > 0) bestCell = open[rng.int(open.length)];
      }
      if (bestCell === -1) break;
      givens.set(bestCell, fill.get(bestCell)!);
    }
    if (!ok) continue;

    const solution: Record<number, number> = {};
    for (const [k, v] of fill) solution[k] = v;
    const givensObj: Record<number, number> = {};
    for (const [k, v] of givens) givensObj[k] = v;
    return {
      type: 'kakuro',
      seed,
      difficulty,
      width: w,
      height: h,
      walls,
      runs,
      sums,
      whiteCells,
      givens: givensObj,
      solution,
    };
  }
  throw new Error(`kakuro generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function kakuroHint(puzzle: KakuroPuzzle, state: Record<number, number>): Hint | null {
  for (const i of puzzle.whiteCells) {
    if (state[i] && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  for (const i of puzzle.whiteCells) {
    if (!state[i]) return { cell: i, value: puzzle.solution[i] };
  }
  return null;
}
