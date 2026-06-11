import { Rng } from '../core/rng';
import type { Difficulty, PuzzleBase, Hint } from '../core/types';
import { solveBinairo } from './solver';

export interface BinairoPuzzle extends PuzzleBase {
  type: 'binairo';
  size: number;
  /** size*size cells: -1 empty, 0/1 given. */
  givens: number[];
  /** size*size cells, the unique solution. */
  solution: number[];
}

export const BINAIRO_SIZE: Record<Difficulty, number> = {
  easy: 6,
  medium: 8,
  hard: 10,
};

/** Full valid grid via randomized backtracking. */
function fillBinairo(rng: Rng, size: number): number[] | null {
  const g = new Array<number>(size * size).fill(-1);

  function ok(i: number): boolean {
    const r = Math.floor(i / size);
    const c = i % size;
    const v = g[i];
    if (c >= 2 && g[i - 1] === v && g[i - 2] === v) return false;
    if (r >= 2 && g[i - size] === v && g[i - 2 * size] === v) return false;
    let zr = 0; let or = 0;
    for (let cc = 0; cc <= c; cc++) (g[r * size + cc] === 0 ? zr++ : or++);
    if (zr > size / 2 || or > size / 2) return false;
    let zc = 0; let oc = 0;
    for (let rr = 0; rr <= r; rr++) (g[rr * size + c] === 0 ? zc++ : oc++);
    if (zc > size / 2 || oc > size / 2) return false;
    if (c === size - 1) {
      for (let rr = 0; rr < r; rr++) {
        let same = true;
        for (let cc = 0; cc < size; cc++) {
          if (g[rr * size + cc] !== g[r * size + cc]) { same = false; break; }
        }
        if (same) return false;
      }
    }
    if (r === size - 1) {
      for (let cc = 0; cc < c; cc++) {
        let same = true;
        for (let rr = 0; rr < size; rr++) {
          if (g[rr * size + cc] !== g[rr * size + c]) { same = false; break; }
        }
        if (same) return false;
      }
    }
    return true;
  }

  function rec(i: number): boolean {
    if (i === size * size) return true;
    const first = rng.int(2);
    for (const v of [first, 1 - first]) {
      g[i] = v;
      if (ok(i) && rec(i + 1)) return true;
    }
    g[i] = -1;
    return false;
  }

  return rec(0) ? g : null;
}

export function gradeBinairo(p: { size: number }): Difficulty {
  return p.size <= 6 ? 'easy' : p.size <= 8 ? 'medium' : 'hard';
}

export function generateBinairo(seed: string, difficulty: Difficulty): BinairoPuzzle {
  const rng = new Rng(`binairo:${seed}:${difficulty}`);
  const size = BINAIRO_SIZE[difficulty];

  for (let attempt = 0; attempt < 30; attempt++) {
    const solution = fillBinairo(rng, size);
    if (!solution) continue;
    const givens = solution.slice();
    const order = rng.shuffle(Array.from({ length: size * size }, (_, i) => i));
    for (const i of order) {
      const save = givens[i];
      givens[i] = -1;
      const solved = solveBinairo(givens, size);
      if (!solved) givens[i] = save;
    }
    // sanity: rule solver must reproduce the original solution
    const solved = solveBinairo(givens, size);
    if (solved && solved.every((v, i) => v === solution[i])) {
      return { type: 'binairo', seed, difficulty, size, givens, solution };
    }
  }
  throw new Error(`binairo generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function binairoHint(puzzle: BinairoPuzzle, state: number[]): Hint | null {
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== -1 && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  for (let i = 0; i < state.length; i++) {
    if (state[i] === -1) return { cell: i, value: puzzle.solution[i] };
  }
  return null;
}
