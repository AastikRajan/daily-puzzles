import { utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress, modeStreak } from '../state/progress';
import type { WordMode } from '../state/progress';
import './stats.css';

const MODES: Array<{ mode: WordMode; label: string; color: string }> = [
  { mode: 'guess', label: 'Guess', color: 'var(--c-guess)' },
  { mode: 'anagrams', label: 'Anagrams', color: 'var(--c-anagrams)' },
  { mode: 'hunt', label: 'Word Hunt', color: 'var(--c-hunt)' },
];

export default function StatsView() {
  const go = useUi((s) => s.go);
  const completions = useProgress((s) => s.completions);
  const today = utcDateString();

  return (
    <div className="view stats-view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Statistics</span>
        </div>
      </header>

      {MODES.map(({ mode, label, color }) => {
        let played = 0;
        for (const key of Object.keys(completions)) {
          if (key.endsWith(`.${mode}`)) played++;
        }
        const streak = modeStreak(completions, mode, today);
        return (
          <div key={mode} className="stat-card" style={{ '--accent': color } as React.CSSProperties}>
            <p className="stat-mode">{label}</p>
            <div className="stat-row">
              <div className="stat-cell">
                <span className="stat-val">{played}</span>
                <span className="stat-label">Played</span>
              </div>
              <div className="stat-cell">
                <span className="stat-val">{streak}</span>
                <span className="stat-label">Streak 🔥</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
