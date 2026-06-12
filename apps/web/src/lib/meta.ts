import type { PuzzleType } from '@daily-logic/engine';

export interface TypeMeta {
  name: string;
  tagline: string;
  accent: string; // css var
  accentDeep: string;
  accentSoft: string;
  grad: string;
}

export const TYPE_META: Record<PuzzleType, TypeMeta> = {
  sudoku: {
    name: 'Sudoku',
    tagline: 'Nine digits, no repeats',
    accent: 'var(--c-sudoku)',
    accentDeep: 'var(--c-sudoku-deep)',
    accentSoft: 'var(--c-sudoku-soft)',
    grad: 'var(--g-sudoku)',
  },
  killer: {
    name: 'Killer Sudoku',
    tagline: 'Sudoku with cage sums',
    accent: 'var(--c-killer)',
    accentDeep: 'var(--c-killer-deep)',
    accentSoft: 'var(--c-killer-soft)',
    grad: 'var(--g-killer)',
  },
  nonogram: {
    name: 'Nonogram',
    tagline: 'Paint the hidden picture',
    accent: 'var(--c-nonogram)',
    accentDeep: 'var(--c-nonogram-deep)',
    accentSoft: 'var(--c-nonogram-soft)',
    grad: 'var(--g-nonogram)',
  },
  kakuro: {
    name: 'Kakuro',
    tagline: 'Crossword of sums',
    accent: 'var(--c-kakuro)',
    accentDeep: 'var(--c-kakuro-deep)',
    accentSoft: 'var(--c-kakuro-soft)',
    grad: 'var(--g-kakuro)',
  },
  binairo: {
    name: 'Binairo',
    tagline: 'Balance zeros and ones',
    accent: 'var(--c-binairo)',
    accentDeep: 'var(--c-binairo-deep)',
    accentSoft: 'var(--c-binairo-soft)',
    grad: 'var(--g-binairo)',
  },
};

export const TYPE_ORDER: PuzzleType[] = ['sudoku', 'killer', 'nonogram', 'kakuro', 'binairo'];

export const TYPE_EMOJI: Record<PuzzleType, string> = {
  sudoku: '🔢',
  killer: '🎯',
  nonogram: '🖼️',
  kakuro: '➕',
  binairo: '⚖️',
};
