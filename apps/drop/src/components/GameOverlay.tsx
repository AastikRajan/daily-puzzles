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
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(20,5,24,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
        animation: 'fadeIn 300ms ease',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
      <div className="panel" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 280, width: '100%' }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🍬</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 28, color: 'var(--ink)', marginBottom: 8,
        }}>Game Over</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: 15, margin: '0 0 20px' }}>
          Your stack reached the top!
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
          <div className="panel" style={{ padding: '10px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Score</div>
            <div data-testid="final-score" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{state.score}</div>
          </div>
          <div className="panel" style={{ padding: '10px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Best</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--c-brand)' }}>{state.best}</div>
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
