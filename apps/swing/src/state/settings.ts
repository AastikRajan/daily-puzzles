import { create } from 'zustand';
import { load, save } from '../lib/storage';

export type ThemeChoice = 'auto' | 'light' | 'dark';

interface SettingsState {
  theme: ThemeChoice;
  reducedMotion: boolean;
  sound: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const stored = load<Partial<SettingsState>>('settings', {});

export const useSettings = create<SettingsState>((set, get) => ({
  theme: stored.theme ?? 'dark', // dark-first arcade
  reducedMotion: stored.reducedMotion ?? false,
  sound: stored.sound ?? false,
  set: (patch) => {
    set(patch);
    const { theme, reducedMotion, sound } = { ...get(), ...patch };
    save('settings', { theme, reducedMotion, sound });
  },
}));

export function applyTheme(theme: ThemeChoice, reducedMotion: boolean): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.motion = reducedMotion ? 'off' : 'on';
}
