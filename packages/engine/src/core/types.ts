export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export type PuzzleType = 'sudoku' | 'killer' | 'nonogram' | 'kakuro' | 'binairo';

export const PUZZLE_TYPES: readonly PuzzleType[] = [
  'sudoku',
  'killer',
  'nonogram',
  'kakuro',
  'binairo',
] as const;

export interface PuzzleBase {
  type: PuzzleType;
  seed: string;
  difficulty: Difficulty;
}

/** A hint reveals/sets the correct value of one cell, identified per-type. */
export interface Hint {
  /** Flat cell index, meaning depends on puzzle type. */
  cell: number;
  /** Correct value for that cell (digit, or 0/1 fill state). */
  value: number;
}
