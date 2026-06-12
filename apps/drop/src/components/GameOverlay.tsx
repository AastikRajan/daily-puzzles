import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { GameState } from '../game/engine';
import { useSettings } from '../state/settings';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverlay({ state, onRestart }: Props) {
  const reducedMotion = useSettings(s => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    confetti({
      particleCount: 60, spread: 80, origin: { y: 0.5 },
      colors: ['#ff6eb4', '#ff9a44', '#ffd84d', '#ffffff'], scalar: 0.85,
    });
  }, [reducedMotion]);

  return (
    <div
      data-testid="game-over-overlay"
      className="overlay"
      style={{ animation: 'fadeIn 300ms ease' }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
      <div className="card">
        <div style={{ fontSize: 36, marginBottom: 6 }}>🍬</div>
        <h2>Game Over</h2>
        <p className="sub">Your stack reached the top!</p>

        <div className="stats-row-pair">
          <div className="stat-box">
            <div className="stat-cap">Score</div>
            <div className="stat-num" data-testid="final-score">{state.score}</div>
          </div>
          <div className="stat-box">
            <div className="stat-cap">Best</div>
            <div className="stat-num" style={{ color: 'var(--c-brand)' }}>{state.best}</div>
          </div>
        </div>

        <button
          data-testid="play-again-btn"
          className="btn3d"
          style={{ width: '100%', '--btn': 'var(--c-brand)', '--btn-deep': 'var(--c-brand-deep)' } as React.CSSProperties}
          onClick={onRestart}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
