import { create } from 'zustand';
import { utcDateString } from '@daily-logic/engine';
import type { WordMode } from './progress';

export type Screen = 'home' | 'guess' | 'anagrams' | 'hunt' | 'stats' | 'settings';

interface UiState {
  screen: Screen;
  date: string;
  openMode: (mode: WordMode) => void;
  go: (screen: Screen) => void;
  setDate: (date: string) => void;
}

export const useUi = create<UiState>((set) => ({
  screen: 'home',
  date: utcDateString(),
  openMode: (mode) => set({ screen: mode as Screen }),
  go: (screen) => set({ screen }),
  setDate: (date) => set({ date }),
}));
