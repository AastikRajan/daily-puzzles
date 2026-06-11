export * from './core/types';
export * from './core/rng';
export * from './core/daily';

export { generateSudoku, gradeSudoku, sudokuHint, type SudokuPuzzle } from './sudoku/generator';
export { countSolutions as countSudokuSolutions, solve as solveSudoku } from './sudoku/solver';
export { techniqueTier } from './sudoku/grader';

export { generateKiller, gradeKiller, killerHint, countKillerSolutions, KILLER_PARAMS, type KillerPuzzle, type KillerCage } from './killer/generator';

export { generateNonogram, gradeNonogram, nonogramHint, NONOGRAM_PARAMS, type NonogramPuzzle } from './nonogram/generator';
export { solveNonogram, countNonogramSolutions, cluesForLine, fixLine } from './nonogram/linesolver';

export { generateKakuro, gradeKakuro, kakuroHint, KAKURO_PARAMS, type KakuroPuzzle } from './kakuro/generator';
export { countKakuroSolutions } from './kakuro/solver';
export { type KakuroRun } from './kakuro/layout';

export { generateBinairo, gradeBinairo, binairoHint, BINAIRO_SIZE, type BinairoPuzzle } from './binairo/generator';
export { solveBinairo, countBinairoSolutions } from './binairo/solver';

import type { Difficulty, PuzzleType } from './core/types';
import { dailySeed, difficultyForDate } from './core/daily';
import { generateSudoku, type SudokuPuzzle } from './sudoku/generator';
import { generateKiller, type KillerPuzzle } from './killer/generator';
import { generateNonogram, type NonogramPuzzle } from './nonogram/generator';
import { generateKakuro, type KakuroPuzzle } from './kakuro/generator';
import { generateBinairo, type BinairoPuzzle } from './binairo/generator';

export type AnyPuzzle =
  | SudokuPuzzle
  | KillerPuzzle
  | NonogramPuzzle
  | KakuroPuzzle
  | BinairoPuzzle;

export function generatePuzzle(type: PuzzleType, seed: string, difficulty: Difficulty): AnyPuzzle {
  switch (type) {
    case 'sudoku': return generateSudoku(seed, difficulty);
    case 'killer': return generateKiller(seed, difficulty);
    case 'nonogram': return generateNonogram(seed, difficulty);
    case 'kakuro': return generateKakuro(seed, difficulty);
    case 'binairo': return generateBinairo(seed, difficulty);
  }
}

/** The one true daily puzzle: identical for every player worldwide. */
export function generateDaily(date: string, type: PuzzleType): AnyPuzzle {
  return generatePuzzle(type, dailySeed(date, type), difficultyForDate(date));
}
