import { useUi } from '../state/ui';
import { useSettings, applyTheme } from '../state/settings';
import type { ThemeChoice } from '../state/settings';
import './settings.css';

const THEMES: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsView() {
  const go = useUi((s) => s.go);
  const { theme, reducedMotion, set } = useSettings();

  const setTheme = (t: ThemeChoice) => {
    set({ theme: t });
    applyTheme(t, reducedMotion);
  };

  const toggleMotion = () => {
    const next = !reducedMotion;
    set({ reducedMotion: next });
    applyTheme(theme, next);
  };

  return (
    <div className="view settings-view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Settings</span>
        </div>
      </header>

      <section className="settings-section">
        <p className="settings-label">Theme</p>
        <div className="theme-options">
          {THEMES.map((t) => (
            <button
              key={t.value}
              className={`theme-btn${theme === t.value ? ' active' : ''}`}
              onClick={() => setTheme(t.value)}
              data-testid={`theme-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-row">
          <span>Reduce motion</span>
          <button
            className={`toggle${reducedMotion ? ' on' : ''}`}
            onClick={toggleMotion}
            data-testid="toggle-motion"
            aria-pressed={reducedMotion}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </section>
    </div>
  );
}
