import { useUi } from '../state/ui';
import { useSettings, type ThemeChoice } from '../state/settings';
import { useInstall, promptInstall, isStandalone, isIOS } from '../lib/install';
import './settings.css';

function InstallSection() {
  const deferred = useInstall((s) => s.deferred);
  const installed = useInstall((s) => s.installed);

  if (installed || isStandalone()) {
    return <p className="install-note">Installed — you're playing the app.</p>;
  }
  if (deferred) {
    return (
      <button className="btn3d" onClick={() => promptInstall()} data-testid="install-button">
        Install Daily Grid
      </button>
    );
  }
  if (isIOS()) {
    return (
      <p className="install-note">
        On iPhone: tap <strong>Share</strong> in Safari, then{' '}
        <strong>Add to Home Screen</strong>.
      </p>
    );
  }
  return (
    <p className="install-note">
      Open this site in Chrome or Safari to install as an app.
    </p>
  );
}

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
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
          <span>Error feedback</span>
          <input
            type="checkbox"
            checked={settings.errorCheck}
            onChange={(e) => settings.set({ errorCheck: e.target.checked })}
          />
        </label>
        <label className="set-row">
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => settings.set({ reducedMotion: e.target.checked })}
          />
        </label>
      </section>

      <section className="set-section">
        <h2 className="set-heading">App</h2>
        <InstallSection />
      </section>

      <p className="set-footnote">Daily Grid · Puzzles reset at midnight UTC</p>
    </div>
  );
}
