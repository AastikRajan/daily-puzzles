import { useState, type ReactNode } from 'react';
import type { PuzzleType } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useSettings } from '../state/settings';
import { useProgress } from '../state/progress';
import { TYPE_META } from '../lib/meta';
import { formatTime } from '../lib/time';

/**
 * Shared chrome around every board: back button, title, hideable timer,
 * hint counter. Boards render their own grid + controls as children.
 */
export function PuzzleHeader({
  type,
  elapsedMs,
  difficulty,
}: {
  type: PuzzleType;
  elapsedMs: number;
  difficulty: string;
}) {
  const go = useUi((s) => s.go);
  const showTimer = useSettings((s) => s.showTimer);
  const setSettings = useSettings((s) => s.set);
  const meta = TYPE_META[type];

  return (
    <header className="pz-header">
      <button className="pz-back" onClick={() => go('home')} aria-label="Back to home" data-testid="back-home">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 5l-6 6 6 6" />
        </svg>
      </button>
      <div className="pz-title">
        <span className="pz-name">{meta.name}</span>
        <span className="pz-diff">{difficulty}</span>
      </div>
      <button
        className="pz-timer"
        onClick={() => setSettings({ showTimer: !showTimer })}
        aria-label={showTimer ? 'Hide timer' : 'Show timer'}
        data-testid="timer"
      >
        {showTimer ? formatTime(elapsedMs) : '••:••'}
      </button>
    </header>
  );
}

export function HintButton({ onHint, disabled }: { onHint: () => void; disabled?: boolean }) {
  const hintsLeft = useProgress((s) => s.hintsLeft);
  const [, force] = useState(0);
  const left = hintsLeft();

  return (
    <button
      className="tool"
      data-testid="hint"
      disabled={disabled || left === 0}
      onClick={() => {
        onHint();
        force((x) => x + 1);
      }}
      aria-label={`Hint, ${left} left today`}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M11 3a5.5 5.5 0 0 1 3 10.1c-.6.4-1 .9-1 1.4v.5h-4v-.5c0-.5-.4-1-1-1.4A5.5 5.5 0 0 1 11 3z" />
        <path d="M9 18h4" />
      </svg>
      <span className="tool-label">{left}</span>
    </button>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="pz-toolbar">{children}</div>;
}
