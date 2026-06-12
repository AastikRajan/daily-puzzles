import { create } from 'zustand';
import { load, save } from '../lib/storage';

export type ThemeChoice = 'auto' | 'light' | 'dark';

interface SettingsState {
  theme: ThemeChoice;
  reducedMotion: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const stored = load<Partial<SettingsState>>('settings', {});

export const useSettings = create<SettingsState>((set, get) => ({
  theme: stored.theme ?? 'auto',
  reducedMotion: stored.reducedMotion ?? false,
  set: (patch) => {
    set(patch);
    const { theme, reducedMotion } = get();
    save('settings', { theme, reducedMotion });
  },
}));

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
    || (resolved === 'dark' ? '#12102a' : '#fdf4ff');
  (meta as HTMLMetaElement).content = bg;
}
