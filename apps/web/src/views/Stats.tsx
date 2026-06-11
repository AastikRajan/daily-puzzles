import { utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress } from '../state/progress';
import { typeStats, anyStreak, allStreak } from '../lib/streaks';
import { TYPE_META, TYPE_ORDER } from '../lib/meta';
import { formatTime } from '../lib/time';
import './stats.css';

export default function Stats() {
  const go = useUi((s) => s.go);
  const completions = useProgress((s) => s.completions);
  const today = utcDateString();

  return (
    <div className="view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-home">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 5l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Statistics</span>
        </div>
      </header>

      <div className="stats-hero">
        <div>
          <span className="stats-big">{anyStreak(completions, today)}</span>
          <span className="stats-cap">day streak</span>
        </div>
        <div>
          <span className="stats-big">{allStreak(completions, today)}</span>
          <span className="stats-cap">perfect days</span>
        </div>
        <div>
          <span className="stats-big">{Object.keys(completions).length}</span>
          <span className="stats-cap">puzzles solved</span>
        </div>
      </div>

      <div className="stats-types">
        {TYPE_ORDER.map((t) => {
          const s = typeStats(completions, t, today);
          const meta = TYPE_META[t];
          return (
            <div className="stats-row" key={t} style={{ '--accent': meta.accent } as React.CSSProperties}>
              <span className="stats-row-name">{meta.name}</span>
              <span className="stats-cell"><em>{s.streak}</em>streak</span>
              <span className="stats-cell"><em>{s.played}</em>played</span>
              <span className="stats-cell"><em>{s.bestMs ? formatTime(s.bestMs) : '—'}</em>best</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
