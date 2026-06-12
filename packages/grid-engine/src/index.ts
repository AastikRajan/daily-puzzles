export * from './queens/generator';
export * from './tango/generator';
export * from './zip/generator';

import type { Difficulty } from '@daily-logic/engine';
import { dailySeed, difficultyForDate } from '@daily-logic/engine';
import { generateQueens, type QueensPuzzle } from './queens/generator';
import { generateTango, type TangoPuzzle } from './tango/generator';
import { generateZip, type ZipPuzzle } from './zip/generator';

export type GridPuzzleType = 'queens' | 'tango' | 'zip';
export type GridPuzzle = QueensPuzzle | TangoPuzzle | ZipPuzzle;

export function generateGridPuzzle(
  type: GridPuzzleType,
  seed: string,
  difficulty: Difficulty,
): GridPuzzle {
  switch (type) {
    case 'queens': return generateQueens(seed, difficulty);
    case 'tango': return generateTango(seed, difficulty);
    case 'zip': return generateZip(seed, difficulty);
  }
}

export function generateGridDaily(date: string, type: GridPuzzleType): GridPuzzle {
  // dailySeed accepts any string - cast needed since GridPuzzleType extends beyond engine's PuzzleType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return generateGridPuzzle(type, dailySeed(date, type as any), difficultyForDate(date));
}
