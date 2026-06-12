import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { OrbitGame, ORBIT_SCENE, type OrbitHud } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<OrbitGame | null>(null);
  const [hud, setHud] = useState<OrbitHud>({ score: 0, best: 0, phase: 'playing', charging: false });
  const prevBest = useRef(0);
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new OrbitGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      game.resize(w, Math.min(window.innerHeight, w * (ORBIT_SCENE.H / ORBIT_SCENE.W)), canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'dead' && hud.score > 0 && hud.score >= hud.best && hud.best !== prevBest.current) {
      if (!useSettings.getState().reducedMotion) {
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.5 }, colors: ['#7df0ff', '#ffe066', '#ffffff'] });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.score, hud.best]);

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.pointerDown();
        }}
        onPointerUp={() => gameRef.current?.pointerUp()}
        onPointerCancel={() => gameRef.current?.pointerUp()}
      />

      <div className="hud">
        <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
        <span className="chip">Best <strong>{hud.best}</strong></span>
        {hud.charging && <span className="chip combo">SLINGSHOT!</span>}
      </div>
      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Tap to hop rings · hold then release to slingshot two rings · catch ⭐ dodge debris</p>

      {hud.phase === 'dead' && (
        <div className="overlay" role="dialog" data-testid="game-over-overlay">
          <div className="card">
            <h2>Lost in space</h2>
            <p className="sub">The debris got you.</p>
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
            <button className="btn3d" data-testid="play-again-btn" onClick={() => gameRef.current?.restart()}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
