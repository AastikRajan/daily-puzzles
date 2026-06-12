import { useEffect, useRef, useState } from 'react';
import { BankshotGame, type HudState, type AimState } from '../game/game';
import { useSettings } from '../state/settings';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BankshotGame | null>(null);
  const [hud, setHud] = useState<HudState>({
    level: 1,
    shots: 0,
    stars: 0,
    totalStars: 0,
    phase: 'aiming',
    targetsLeft: 0,
  });
  const [aim, setAim] = useState<AimState>({ active: false, angle: -Math.PI / 2, preview: [] });
  const setSettings = useSettings((s) => s.set);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new BankshotGame(
      canvas,
      (h) => setHud(h),
      (a) => setAim(a),
      () => useSettings.getState().reducedMotion,
    );
    gameRef.current = game;

    const fit = () => {
      const w = Math.min(window.innerWidth, 480);
      const h = window.innerHeight;
      game.resize(w, h, canvas);
    };
    fit();
    window.addEventListener('resize', fit);

    const onVisibility = () => {
      // game loop checks visibility itself; nothing extra needed
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onVisibility);
      game.destroy();
    };
  }, []);

  const getCanvasPoint = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const starsForShots = (shots: number) => {
    if (shots === 1) return 3;
    if (shots <= 2) return 2;
    return 1;
  };

  const renderStars = (n: number) =>
    Array.from({ length: 3 }, (_, i) => (i < n ? '★' : '☆')).join('');

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          const { sx, sy } = getCanvasPoint(e);
          gameRef.current?.startAim(sx, sy);
        }}
        onPointerMove={(e) => {
          const { sx, sy } = getCanvasPoint(e);
          gameRef.current?.updateAim(sx, sy);
        }}
        onPointerUp={() => gameRef.current?.releaseAim()}
        onPointerCancel={() => gameRef.current?.cancelAim()}
      />

      <div className="hud">
        <span className="chip" data-testid="hud-level">
          Level <strong>{hud.level}</strong>
        </span>
        <span className="chip" data-testid="hud-shots">
          Shots <strong>{hud.shots}</strong>
        </span>
        <span className="chip star" data-testid="hud-stars">
          <strong>{hud.stars}</strong> ★
        </span>
      </div>

      <button
        className="chip theme-btn"
        onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
        aria-label="Toggle theme"
        data-testid="theme-toggle"
      >
        {theme === 'light' ? '☾' : '☀'}
      </button>

      <p className="hint-text">
        {hud.phase === 'aiming' ? 'Drag to aim · release to fire' : ''}
      </p>

      {/* Level cleared overlay */}
      {hud.phase === 'cleared' && (
        <div className="overlay" data-testid="level-clear-overlay">
          <div className="card">
            <h2>Level {hud.level} Clear!</h2>
            <p className="sub">
              {hud.shots === 1 ? 'One shot — PERFECT!' : `${hud.shots} shots`}
            </p>
            <div className="stars-row" data-testid="level-stars">
              {renderStars(starsForShots(hud.shots))}
            </div>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Level</span>
                <span className="stat-num" data-testid="clear-level">{hud.level}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Shots</span>
                <span className="stat-num">{hud.shots}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Stars</span>
                <span className="stat-num">{hud.stars}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All levels done overlay */}
      {hud.phase === 'done' && (
        <div className="overlay" data-testid="done-overlay">
          <div className="card">
            <h2>You Win!</h2>
            <p className="sub">All 12 levels cleared!</p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Stars</span>
                <span className="stat-num" data-testid="final-stars">{hud.stars}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Max</span>
                <span className="stat-num">36</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Rating</span>
                <span className="stat-num">{Math.round((hud.stars / 36) * 100)}%</span>
              </div>
            </div>
            <button
              className="btn3d"
              data-testid="play-again-btn"
              onClick={() => {
                // reset via debug API
                (window as unknown as { __bankshot: { skipLevel: () => void } }).__bankshot.skipLevel();
              }}
            >
              Play again
            </button>
          </div>
        </div>
      )}

      {/* Aim preview debug indicator (hidden but helps test confirm aim is active) */}
      {aim.active && (
        <div
          data-testid="aim-active"
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}
