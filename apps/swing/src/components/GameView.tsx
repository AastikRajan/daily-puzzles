import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SwingGame, SWING_SCENE, type SwingHud } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SwingGame | null>(null);
  const [hud, setHud] = useState<SwingHud>({ distance: 0, best: 0, stars: 0, phase: 'playing', attached: false });
  const prevBest = useRef(-1);
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new SwingGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      game.resize(w, Math.min(window.innerHeight, w * (SWING_SCENE.H / SWING_SCENE.W)), canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'dead' && hud.distance > 0 && hud.distance >= hud.best && hud.best !== prevBest.current) {
      if (!useSettings.getState().reducedMotion) {
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.5 }, colors: ['#ff9ec7', '#ffe066', '#7df0ff'] });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.distance, hud.best]);

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.attach();
        }}
        onPointerUp={() => gameRef.current?.release()}
        onPointerCancel={() => gameRef.current?.release()}
      />

      <div className="hud">
        <span className="chip">📏 <strong data-testid="hud-distance">{hud.distance}m</strong></span>
        <span className="chip">Best <strong>{hud.best}m</strong></span>
        <span className="chip">⭐ <strong>{hud.stars}</strong></span>
        {hud.attached && <span className="chip combo">HOLD</span>}
      </div>
      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Hold to latch the rope · release at the top of the swing to fly</p>

      {hud.phase === 'dead' && (
        <div className="overlay" role="dialog" data-testid="game-over-overlay">
          <div className="card">
            <h2>Splash!</h2>
            <p className="sub">The glow got you.</p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Distance</span>
                <span className="stat-num" data-testid="final-distance">{hud.distance}m</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Best</span>
                <span className="stat-num">{hud.best}m</span>
              </div>
            </div>
            <button className="btn3d" data-testid="play-again-btn" onClick={() => gameRef.current?.restart()}>
              Swing again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
