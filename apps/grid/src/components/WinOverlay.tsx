import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import type { GridPuzzleType } from '@daily-logic/grid-engine';
import { utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress } from '../state/progress';
import { useSettings } from '../state/settings';
import { typeStreak } from '../lib/streaks';
import { TYPE_META } from '../lib/meta';
import { formatTime } from '../lib/time';
import { buildPuzzleShare, shareText } from '../lib/share';

const CONFETTI_COLORS: Record<GridPuzzleType, string[]> = {
  queens: ['#8b5cf6', '#facc15', '#ffffff', '#a78bfa'],
  tango: ['#f59e0b', '#38bdf8', '#ffffff', '#fde68a'],
  zip: ['#22c55e', '#86efac', '#ffffff', '#a3e635'],
};

export default function WinOverlay({
  type,
  elapsedMs,
  mistakes,
  hintsUsed,
}: {
  type: GridPuzzleType;
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
}) {
  const go = useUi((s) => s.go);
  const date = useUi((s) => s.date);
  const completions = useProgress((s) => s.completions);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const streak = typeStreak(completions, type, utcDateString());
  const meta = TYPE_META[type];
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');

  const onShare = async () => {
    const text = buildPuzzleShare(
      type,
      date,
      { timeMs: elapsedMs, mistakes, hintsUsed, completedAt: Date.now() },
      streak,
    );
    const result = await shareText(text);
    if (result !== 'failed') setShareState(result);
  };

  useEffect(() => {
    if (reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = CONFETTI_COLORS[type];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.62 }, colors, scalar: 1.05 });
    const t = setTimeout(
      () => confetti({ particleCount: 50, spread: 110, origin: { y: 0.5 }, colors, scalar: 0.8 }),
      220,
    );
    return () => clearTimeout(t);
  }, [type, reducedMotion]);

  return (
    <div className="win-overlay" role="dialog" aria-label="Puzzle solved" data-testid="win-overlay">
      <div className="win-card" style={{ '--accent-grad': meta.grad } as React.CSSProperties}>
        <span className="win-burst" aria-hidden>
          {type === 'queens' ? '👑' : type === 'tango' ? '☀️' : '⚡'}
        </span>
        <h2 className="win-title">Solved!</h2>
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
            <dt>Streak</dt>
            <dd>{streak}</dd>
          </div>
        </dl>
        <div className="win-actions">
          <button
            className="btn3d"
            style={{ '--btn': meta.accent, '--btn-deep': meta.accentDeep } as React.CSSProperties}
            onClick={onShare}
            data-testid="win-share"
          >
            {shareState === 'idle' ? 'Share' : shareState === 'copied' ? 'Copied!' : 'Shared!'}
          </button>
          <button className="btn3d ghost" onClick={() => go('home')} data-testid="win-home">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
