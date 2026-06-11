import type { PuzzleType } from '@daily-logic/engine';

export interface TypeMeta {
  name: string;
  tagline: string;
  accent: string; // css var
  accentSoft: string;
}

export const TYPE_META: Record<PuzzleType, TypeMeta> = {
  sudoku: {
    name: 'Sudoku',
    tagline: 'Nine digits, no repeats',
    accent: 'var(--c-sudoku)',
    accentSoft: 'var(--c-sudoku-soft)',
  },
  killer: {
    name: 'Killer Sudoku',
    tagline: 'Sudoku with cage sums',
    accent: 'var(--c-killer)',
    accentSoft: 'var(--c-killer-soft)',
  },
  nonogram: {
    name: 'Nonogram',
    tagline: 'Paint the hidden picture',
    accent: 'var(--c-nonogram)',
    accentSoft: 'var(--c-nonogram-soft)',
  },
  kakuro: {
    name: 'Kakuro',
    tagline: 'Crossword of sums',
    accent: 'var(--c-kakuro)',
    accentSoft: 'var(--c-kakuro-soft)',
  },
  binairo: {
    name: 'Binairo',
    tagline: 'Balance zeros and ones',
    accent: 'var(--c-binairo)',
    accentSoft: 'var(--c-binairo-soft)',
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
