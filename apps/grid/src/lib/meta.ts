import type { GridPuzzleType } from '@daily-logic/grid-engine';

export interface TypeMeta {
  name: string;
  tagline: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  grad: string;
}

export const TYPE_META: Record<GridPuzzleType, TypeMeta> = {
  queens: {
    name: 'Queens',
    tagline: 'One queen per row, column & region',
    accent: 'var(--c-queens)',
    accentDeep: 'var(--c-queens-deep)',
    accentSoft: 'var(--c-queens-soft)',
    grad: 'var(--g-queens)',
  },
  tango: {
    name: 'Tango',
    tagline: 'Balance the sun and moon',
    accent: 'var(--c-tango)',
    accentDeep: 'var(--c-tango-deep)',
    accentSoft: 'var(--c-tango-soft)',
    grad: 'var(--g-tango)',
  },
  zip: {
    name: 'Zip',
    tagline: 'Connect every cell in order',
    accent: 'var(--c-zip)',
    accentDeep: 'var(--c-zip-deep)',
    accentSoft: 'var(--c-zip-soft)',
    grad: 'var(--g-zip)',
  },
};

export const TYPE_ORDER: GridPuzzleType[] = ['queens', 'tango', 'zip'];

export const TYPE_EMOJI: Record<GridPuzzleType, string> = {
  queens: '👑',
  tango: '☀️',
  zip: '⚡',
};

export const TYPE_SQUARE: Record<GridPuzzleType, string> = {
  queens: '🟪',
  tango: '🟧',
  zip: '🟩',
};
