import type { PuzzleType } from '@daily-logic/engine';
import { utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress } from '../state/progress';
import { typeStreak } from '../lib/streaks';
import { TYPE_META } from '../lib/meta';
import { formatTime } from '../lib/time';

export default function WinOverlay({
  type,
  elapsedMs,
  mistakes,
  hintsUsed,
}: {
  type: PuzzleType;
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
}) {
  const go = useUi((s) => s.go);
  const completions = useProgress((s) => s.completions);
  const streak = typeStreak(completions, type, utcDateString());
  const meta = TYPE_META[type];

  return (
    <div className="win-overlay" role="dialog" aria-label="Puzzle solved" data-testid="win-overlay">
      <div className="win-card">
        <span className="win-burst" aria-hidden>
          <svg width="54" height="54" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="26" fill="var(--accent-soft)" />
            <path d="M17 28l7 7 13-15" stroke="var(--accent)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="win-title">Solved</h2>
        <p className="win-sub">{meta.name}</p>
        <dl className="win-stats">
          <div>
            <dt>Time</dt>
            <dd data-testid="win-time">{formatTime(elapsedMs)}</dd>
          </div>
          <div>
            <dt>Mistakes</dt>
            <dd>{mistakes}</dd>
          </div>
          <div>
            <dt>Hints</dt>
            <dd>{hintsUsed}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>{streak}</dd>
          </div>
        </dl>
        <div className="win-actions">
          <button className="btn-primary" onClick={() => go('home')} data-testid="win-home">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
