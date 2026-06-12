import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SnakeGame, type HudState } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const [hud, setHud] = useState<HudState>({ score: 0, best: 0, length: 5, combo: 0, phase: 'playing' });
  const prevBest = useRef(0);
  const setSettings = useSettings((s) => s.set);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new SnakeGame(
      canvas,
      (h) => setHud(h),
      () => useSettings.getState().reducedMotion,
    );
    gameRef.current = game;

    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      const h = window.innerHeight;
      game.resize(w, h, canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  // celebrate new best on death (once)
  useEffect(() => {
    if (hud.phase === 'dead') {
      if (hud.score > 0 && hud.score >= hud.best && hud.best !== prevBest.current) {
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 }, colors: ['#00f5a0', '#ff4ecd', '#4e9fff', '#ffe94e'] });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.score, hud.best]);

  const pointerToWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return gameRef.current!.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.setPointer(pointerToWorld(e));
          gameRef.current?.setBoost(true);
        }}
        onPointerMove={(e) => gameRef.current?.setPointer(pointerToWorld(e))}
        onPointerUp={() => gameRef.current?.setBoost(false)}
        onPointerCancel={() => gameRef.current?.setBoost(false)}
      />

      <div className="hud">
        <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
        <span className="chip">Best <strong>{hud.best}</strong></span>
        <span className="chip">Length <strong data-testid="hud-length">{hud.length}</strong></span>
        {hud.combo > 1 && <span className="chip combo" data-testid="hud-combo">×{hud.combo}</span>}
      </div>

      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
        data-testid="theme-toggle"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Steer with your finger · hold to boost (costs tail) · line up 3 colors to POP</p>

      {hud.phase === 'dead' && (
        <div className="overlay" role="dialog" aria-label="Game over" data-testid="game-over-overlay">
          <div className="card">
            <h2>Popped!</h2>
            <p className="sub">Your run is over.</p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Score</span>
                <span className="stat-num" data-testid="final-score">{hud.score}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Best</span>
                <span className="stat-num">{hud.best}</span>
              </div>
            </div>
            <button
              className="btn3d"
              data-testid="play-again-btn"
              onClick={() => gameRef.current?.restart()}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
