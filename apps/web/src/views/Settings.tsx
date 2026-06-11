import { useUi } from '../state/ui';
import { useSettings, type ThemeChoice } from '../state/settings';
import './settings.css';

const THEMES: { id: ThemeChoice; label: string; premium?: boolean }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Paper' },
  { id: 'dark', label: 'Ink' },
  { id: 'sepia', label: 'Sepia', premium: true },
  { id: 'midnight', label: 'Midnight', premium: true },
];

export default function Settings() {
  const go = useUi((s) => s.go);
  const settings = useSettings();

  return (
    <div className="view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-home">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 5l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Settings</span>
        </div>
      </header>

      <section className="set-section">
        <h2 className="set-heading">Theme</h2>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-chip theme-${t.id} ${settings.theme === t.id ? 'selected' : ''}`}
              onClick={() => settings.set({ theme: t.id })}
              data-testid={`theme-${t.id}`}
            >
              {t.label}
              {t.premium && <span className="premium-tag">Soon</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="set-section">
        <h2 className="set-heading">Play</h2>
        <label className="set-row">
          <span>Show timer</span>
          <input
            type="checkbox"
            checked={settings.showTimer}
            onChange={(e) => settings.set({ showTimer: e.target.checked })}
          />
        </label>
        <label className="set-row">
          <span>Check errors as I play</span>
          <input
            type="checkbox"
            checked={settings.errorCheck}
            onChange={(e) => settings.set({ errorCheck: e.target.checked })}
          />
        </label>
        <label className="set-row">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => settings.set({ sound: e.target.checked })}
          />
        </label>
        <label className="set-row">
          <span>Reduce motion</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => settings.set({ reducedMotion: e.target.checked })}
          />
        </label>
      </section>

      <p className="set-footnote">
        Daily Logic · five fresh puzzles every day, the same for everyone.
      </p>
    </div>
  );
}
