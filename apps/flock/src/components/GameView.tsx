import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FlockGame, FLOCK_SCENE, type FlockHud } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FlockGame | null>(null);
  const [hud, setHud] = useState<FlockHud>({ count: 0, delivered: 0, need: 20, level: 1, best: 1, phase: 'playing' });
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new FlockGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      game.resize(w, Math.min(window.innerHeight, w * (FLOCK_SCENE.H / FLOCK_SCENE.W)), canvas);
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
      confetti({ particleCount: 100, spread: 75, origin: { y: 0.45 }, colors: ['#ffe066', '#7ef0c0', '#8db8ff'] });
    }
  }, [hud.phase]);

  const toScene = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = FLOCK_SCENE.W / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.setPointer(toScene(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) gameRef.current?.setPointer(toScene(e));
        }}
        onPointerUp={() => gameRef.current?.setPointer(null)}
        onPointerCancel={() => gameRef.current?.setPointer(null)}
      />

      <div className="hud">
        <span className="chip">Lv <strong data-testid="hud-level">{hud.level}</strong></span>
        <span className="chip">🪰 <strong data-testid="hud-count">{hud.count}</strong></span>
        <span className="chip">🏠 <strong data-testid="hud-delivered">{hud.delivered}/{hud.need}</strong></span>
      </div>
      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Hold to lead the swarm · gates grow it · deliver fireflies home</p>

      {hud.phase !== 'playing' && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>{hud.phase === 'won' ? 'Delivered!' : 'Swarm lost…'}</h2>
            <p className="sub">
              {hud.phase === 'won'
                ? `Level ${hud.level} cleared — ${hud.delivered} fireflies home`
                : `The predators got everyone on level ${hud.level}`}
            </p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Level</span>
                <span className="stat-num">{hud.level}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Best</span>
                <span className="stat-num">{hud.best}</span>
              </div>
            </div>
            <button
              className="btn3d"
              data-testid="continue-btn"
              onClick={() => (hud.phase === 'won' ? gameRef.current?.nextLevel() : gameRef.current?.retry())}
            >
              {hud.phase === 'won' ? `Level ${hud.level + 1} →` : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
