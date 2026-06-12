import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SwingGame, type SwingHud } from '../game/game';
import { useSettings } from '../state/settings';
import { sfxClick, isMuted, setMuted } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SwingGame | null>(null);
  const [hud, setHud] = useState<SwingHud>({ distance: 0, best: 0, stars: 0, phase: 'ready', attached: false });
  const [muted, setMutedState] = useState(() => isMuted());
  const prevBest = useRef(-1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new SwingGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
    gameRef.current = game;
    const fit = () => {
      game.resize(window.innerWidth, window.innerHeight, canvas);
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

  function handleMuteToggle() {
    sfxClick();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.attach();
        }}
        onPointerUp={() => gameRef.current?.release()}
        onPointerCancel={() => gameRef.current?.release()}
      />

      {hud.phase === 'playing' && (
        <>
          <div className="hud">
            <span className="chip">📏 <strong data-testid="hud-distance">{hud.distance}m</strong></span>
            <span className="chip">Best <strong>{hud.best}m</strong></span>
            <span className="chip">⭐ <strong>{hud.stars}</strong></span>
            {hud.attached && <span className="chip combo">HOLD</span>}
          </div>
          <p className="hint-text">Hold to latch the rope · release at the top of the swing to fly</p>
        </>
      )}

      <button
        className="chip mute-btn"
        onClick={handleMuteToggle}
        aria-label="Mute"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {hud.phase === 'ready' && (
        <div className="overlay start-overlay" data-testid="start-overlay">
          <div className="card start-card">
            <h1 className="start-title">Swing King</h1>
            <p className="start-sub">swing far, fly farther</p>
            <div className="howto-row">
              <span className="chip">🖐 hold = rope</span>
              <span className="chip">release at the top</span>
              <span className="chip">⭐ = bonus</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={() => gameRef.current?.start()}
            >
              Play
            </button>
          </div>
        </div>
      )}

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
