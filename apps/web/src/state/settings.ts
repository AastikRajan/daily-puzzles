import { create } from 'zustand';
import { load, save } from '../lib/storage';

export type ThemeChoice = 'auto' | 'light' | 'dark' | 'sepia' | 'midnight';

interface SettingsState {
  theme: ThemeChoice;
  reducedMotion: boolean;
  sound: boolean;
  showTimer: boolean;
  errorCheck: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const stored = load<Partial<SettingsState>>('settings', {});

export const useSettings = create<SettingsState>((set, get) => ({
  theme: stored.theme ?? 'auto',
  reducedMotion: stored.reducedMotion ?? false,
  sound: stored.sound ?? true,
  showTimer: stored.showTimer ?? true,
  errorCheck: stored.errorCheck ?? true,
  set: (patch) => {
    set(patch);
    const { theme, reducedMotion, sound, showTimer, errorCheck } = get();
    save('settings', { theme, reducedMotion, sound, showTimer, errorCheck });
  },
}));

/** Resolve 'auto' against the system preference and apply to <html>. */
export function applyTheme(theme: ThemeChoice, reducedMotion: boolean): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.motion = reducedMotion ? 'off' : 'on';
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    ?? (() => {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
      return m;
    })();
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-a').trim()
    || (resolved === 'dark' || resolved === 'midnight' ? '#131331' : '#eef2ff');
  (meta as HTMLMetaElement).content = bg;
}
