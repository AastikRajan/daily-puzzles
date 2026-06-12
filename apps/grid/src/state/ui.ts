import { create } from 'zustand';
import type { GridPuzzleType } from '@daily-logic/grid-engine';
import { utcDateString } from '@daily-logic/engine';

export type Screen = 'home' | 'puzzle' | 'stats' | 'settings';

interface UiState {
  screen: Screen;
  puzzleType: GridPuzzleType | null;
  date: string;
  openPuzzle: (type: GridPuzzleType, date?: string) => void;
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
