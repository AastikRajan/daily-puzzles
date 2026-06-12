import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { PaintGame, PAINT_SCENE, PAINTS, type PaintHud } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PaintGame | null>(null);
  const [hud, setHud] = useState<PaintHud>({ pct: 0, level: 1, best: 0, color: 0, phase: 'playing', stars: 0 });
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new PaintGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      const w = Math.min(window.innerWidth, 560);
      game.resize(w, Math.min(window.innerHeight, w * (PAINT_SCENE.H / PAINT_SCENE.W)), canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'finished' && hud.stars >= 2 && !useSettings.getState().reducedMotion) {
      confetti({ particleCount: 60 + hud.stars * 30, spread: 80, origin: { y: 0.5 }, colors: ['#ff4ecd', '#36d6ff', '#a8e34d'] });
    }
  }, [hud.phase, hud.stars]);

  const steer = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = PAINT_SCENE.W / rect.width;
    gameRef.current?.steerTo((e.clientX - rect.left) * scale);
  };

  const paintColor = PAINTS[hud.color]!;

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          steer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) steer(e);
        }}
        onPointerUp={() => gameRef.current?.steerTo(null)}
        onPointerCancel={() => gameRef.current?.steerTo(null)}
      />

      <div className="hud">
        <span className="chip">Lv <strong>{hud.level}</strong></span>
        <span className="chip">🎨 <strong data-testid="hud-pct">{hud.pct}%</strong></span>
        <span className="chip" style={{ borderColor: paintColor.main }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: paintColor.main, display: 'inline-block' }} />
          <strong>{paintColor.name}</strong>
        </span>
      </div>
      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">Drag to steer · gates swap your paint · cover the floor, dodge the barriers</p>

      {hud.phase !== 'playing' && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>{hud.phase === 'finished' ? `${'⭐'.repeat(Math.max(1, hud.stars))}` : 'Crashed!'}</h2>
            <p className="sub">
              {hud.phase === 'finished'
                ? `Level ${hud.level} painted ${hud.pct}%`
                : `You hit a barrier — ${hud.pct}% painted`}
            </p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Painted</span>
                <span className="stat-num" data-testid="final-pct">{hud.pct}%</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Best</span>
                <span className="stat-num">{hud.best}%</span>
              </div>
            </div>
            <button
              className="btn3d"
              data-testid="continue-btn"
              onClick={() => gameRef.current?.restart(hud.phase === 'finished')}
            >
              {hud.phase === 'finished' ? `Level ${hud.level + 1} →` : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
