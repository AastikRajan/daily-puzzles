import { Rng } from '../core/rng';
import type { Difficulty, PuzzleBase, Hint } from '../core/types';
import { countSolutions, ROW, COL, BOX, ALL } from './solver';
import { techniqueTier, type Tier } from './grader';

export interface SudokuPuzzle extends PuzzleBase {
  type: 'sudoku';
  /** 81 cells, 0 = empty. */
  givens: number[];
  /** 81 cells, the unique solution. */
  solution: number[];
}

/** Fill an empty grid with a complete random solution via backtracking. */
export function fillGrid(rng: Rng): number[] {
  const g = new Array<number>(81).fill(0);
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function rec(i: number): boolean {
    if (i === 81) return true;
    const order = rng.shuffle(digits.slice());
    for (const d of order) {
      const bit = 1 << (d - 1);
      if (rows[ROW[i]] & bit || cols[COL[i]] & bit || boxes[BOX[i]] & bit) continue;
      g[i] = d;
      rows[ROW[i]] |= bit;
      cols[COL[i]] |= bit;
      boxes[BOX[i]] |= bit;
      if (rec(i + 1)) return true;
      g[i] = 0;
      rows[ROW[i]] &= ~bit;
      cols[COL[i]] &= ~bit;
      boxes[BOX[i]] &= ~bit;
    }
    return false;
  }

  rec(0);
  return g;
}

const TARGET_TIER: Record<Difficulty, Tier> = { easy: 1, medium: 2, hard: 3 };

/** Map technique tier back to a difficulty label. */
export function gradeSudoku(givens: number[]): Difficulty {
  const t = techniqueTier(givens);
  return t === 1 ? 'easy' : t === 2 ? 'medium' : 'hard';
}

/**
 * Generate by digging clues out of a full grid (180°-symmetric pairs first,
 * then singles) while uniqueness holds, then accept iff the technique grade
 * matches the requested difficulty; otherwise retry with the same rng stream
 * (deterministic for a given seed).
 */
export function generateSudoku(seed: string, difficulty: Difficulty): SudokuPuzzle {
  const rng = new Rng(`sudoku:${seed}:${difficulty}`);
  const target = TARGET_TIER[difficulty];
  // easy keeps more clues; hard digs as deep as uniqueness allows
  const minClues: Record<Difficulty, number> = { easy: 38, medium: 30, hard: 17 };

  for (let attempt = 0; attempt < 60; attempt++) {
    const solution = fillGrid(rng);
    const g = solution.slice();
    const order = rng.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let clues = 81;

    for (const i of order) {
      if (clues <= minClues[difficulty]) break;
      const j = 80 - i; // 180° rotational partner
      if (g[i] === 0) continue;
      const saveI = g[i];
      const saveJ = g[j];
      g[i] = 0;
      let removed = 1;
      if (j !== i && g[j] !== 0 && clues - 2 >= minClues[difficulty]) {
        g[j] = 0;
        removed = 2;
      }
      if (countSolutions(g, 2) !== 1) {
        g[i] = saveI;
        if (removed === 2) g[j] = saveJ;
        continue;
      }
      // for easy/medium, don't dig past the target tier
      if (target < 3 && techniqueTier(g) > target) {
        g[i] = saveI;
        if (removed === 2) g[j] = saveJ;
        continue;
      }
      clues -= removed;
    }

    const tier = techniqueTier(g);
    if (tier === target) {
      return { type: 'sudoku', seed, difficulty, givens: g, solution };
    }
  }
  throw new Error(`sudoku generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function sudokuHint(puzzle: SudokuPuzzle, state: number[]): Hint | null {
  // prefer correcting a wrong cell, else fill the most constrained empty cell
  for (let i = 0; i < 81; i++) {
    if (state[i] !== 0 && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  let best = -1;
  let bestCands = 10;
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    if (state[i]) {
      const bit = 1 << (state[i] - 1);
      rows[ROW[i]] |= bit;
      cols[COL[i]] |= bit;
      boxes[BOX[i]] |= bit;
    }
  }
  for (let i = 0; i < 81; i++) {
    if (state[i] !== 0) continue;
    const cand = ALL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
    let n = 0;
    let m = cand;
    while (m) { n++; m &= m - 1; }
    if (n < bestCands) { bestCands = n; best = i; }
  }
  return best === -1 ? null : { cell: best, value: puzzle.solution[best] };
}
