import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { HelixGame, HELIX_SCENE, type HelixHud } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<HelixGame | null>(null);
  const [hud, setHud] = useState<HelixHud>({ depth: 0, score: 0, best: 0, combo: 0, tower: 1, phase: 'playing' });
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new HelixGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      game.resize(w, Math.min(window.innerHeight, w * (HELIX_SCENE.H / HELIX_SCENE.W)), canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'won' && !useSettings.getState().reducedMotion) {
      confetti({ particleCount: 130, spread: 85, origin: { y: 0.5 }, colors: ['#ff6ec4', '#ffd84d', '#7df0ff'] });
    }
  }, [hud.phase]);

  const sx = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * HELIX_SCENE.W;
  };

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.dragStart(sx(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) gameRef.current?.dragMove(sx(e));
        }}
        onPointerUp={() => gameRef.current?.dragEnd()}
        onPointerCancel={() => gameRef.current?.dragEnd()}
      />

      <div className="hud">
        <span className="chip">Tower <strong>{hud.tower}</strong></span>
        <span className="chip">Depth <strong data-testid="hud-depth">{hud.depth}</strong></span>
        <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
        {hud.combo >= 3 && <span className="chip combo">🔥 FIRE</span>}
      </div>
      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Drag to spin the tower · line gaps under the ball · 3 falls in a row = 🔥 fire</p>

      {hud.phase !== 'playing' && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>{hud.phase === 'won' ? 'Tower down!' : 'Splat!'}</h2>
            <p className="sub">
              {hud.phase === 'won'
                ? `Tower ${hud.tower} cleared — onward!`
                : `You hit a danger plate at depth ${hud.depth}`}
            </p>
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
              data-testid="continue-btn"
              onClick={() => gameRef.current?.restart(hud.phase === 'won')}
            >
              {hud.phase === 'won' ? `Tower ${hud.tower + 1} →` : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
