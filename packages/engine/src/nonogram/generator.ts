import { Rng } from '../core/rng';
import type { Difficulty, PuzzleBase, Hint } from '../core/types';
import { solveNonogram, cluesForLine } from './linesolver';

export interface NonogramPuzzle extends PuzzleBase {
  type: 'nonogram';
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  /** width*height cells, 0 empty / 1 filled — the unique solution. */
  solution: number[];
  /** Line-solver sweeps needed (difficulty signal). */
  sweeps: number;
}

interface Params { size: number; density: number; minRatio: number; maxRatio: number }

export const NONOGRAM_PARAMS: Record<Difficulty, Params> = {
  easy: { size: 10, density: 0.58, minRatio: 0.5, maxRatio: 0.7 },
  medium: { size: 15, density: 0.55, minRatio: 0.5, maxRatio: 0.68 },
  hard: { size: 15, density: 0.44, minRatio: 0.3, maxRatio: 0.495 },
};

export function gradeNonogram(p: { width: number; solution: number[] }): Difficulty {
  if (p.width <= 10) return 'easy';
  const ratio = p.solution.reduce((s, v) => s + v, 0) / p.solution.length;
  return ratio >= 0.5 ? 'medium' : 'hard';
}

/**
 * Random pattern at target density with one smoothing pass (majority vote)
 * for easy/medium — blobs produce longer blocks, which read better and solve
 * more smoothly. Accept only patterns the pure line solver completes: that
 * single check guarantees a unique, logic-only-solvable puzzle.
 */
export function generateNonogram(seed: string, difficulty: Difficulty): NonogramPuzzle {
  const rng = new Rng(`nonogram:${seed}:${difficulty}`);
  const { size, density, minRatio, maxRatio } = NONOGRAM_PARAMS[difficulty];
  const n = size * size;

  for (let attempt = 0; attempt < 400; attempt++) {
    let cells = new Array<number>(n);
    for (let i = 0; i < n; i++) cells[i] = rng.chance(density) ? 1 : 0;

    if (difficulty !== 'hard') {
      // single majority-smoothing pass
      const smoothed = cells.slice();
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          let filled = 0;
          let total = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const rr = r + dr;
              const cc = c + dc;
              if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
              total++;
              filled += cells[rr * size + cc];
            }
          }
          smoothed[r * size + c] = filled * 2 > total ? 1 : filled * 2 < total ? 0 : cells[r * size + c];
        }
      }
      cells = smoothed;
    }

    const ratio = cells.reduce((s, v) => s + v, 0) / n;
    if (ratio < minRatio || ratio > maxRatio) continue;

    const rowClues: number[][] = [];
    const colClues: number[][] = [];
    let degenerate = false;
    for (let r = 0; r < size; r++) {
      const line = cells.slice(r * size, r * size + size);
      const clue = cluesForLine(line);
      if (clue.length === 0) degenerate = true; // empty lines feel broken
      rowClues.push(clue);
    }
    for (let c = 0; c < size; c++) {
      const line: number[] = [];
      for (let r = 0; r < size; r++) line.push(cells[r * size + c]);
      const clue = cluesForLine(line);
      if (clue.length === 0) degenerate = true;
      colClues.push(clue);
    }
    if (degenerate) continue;

    const { grid, sweeps } = solveNonogram(rowClues, colClues, size, size);
    if (!grid) continue;
    // line solver completed ⇒ unique; must equal the pattern
    return {
      type: 'nonogram',
      seed,
      difficulty,
      width: size,
      height: size,
      rowClues,
      colClues,
      solution: grid,
      sweeps,
    };
  }
  throw new Error(`nonogram generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function nonogramHint(puzzle: NonogramPuzzle, state: number[]): Hint | null {
  // state: -1 unknown, 0 marked-empty, 1 filled
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== -1 && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  for (let i = 0; i < state.length; i++) {
    if (state[i] === -1 && puzzle.solution[i] === 1) return { cell: i, value: 1 };
  }
  for (let i = 0; i < state.length; i++) {
    if (state[i] === -1) return { cell: i, value: puzzle.solution[i] };
  }
  return null;
}
