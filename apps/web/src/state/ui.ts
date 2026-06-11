import { create } from 'zustand';
import type { PuzzleType } from '@daily-logic/engine';
import { utcDateString } from '@daily-logic/engine';

export type Screen = 'home' | 'puzzle' | 'stats' | 'settings' | 'archive';

interface UiState {
  screen: Screen;
  puzzleType: PuzzleType | null;
  /** The puzzle day being viewed/played (UTC date string). */
  date: string;
  openPuzzle: (type: PuzzleType, date?: string) => void;
  go: (screen: Screen) => void;
  setDate: (date: string) => void;
}

export const useUi = create<UiState>((set) => ({
  screen: 'home',
  puzzleType: null,
  date: utcDateString(),
  openPuzzle: (type, date) =>
    set((s) => ({ screen: 'puzzle', puzzleType: type, date: date ?? s.date })),
  go: (screen) => set({ screen }),
  setDate: (date) => set({ date }),
}));
