import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { OrbitGame, type OrbitHud } from '../game/game';
import { useSettings } from '../state/settings';
import { sfxClick, isMuted, setMuted } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<OrbitGame | null>(null);
  const [hud, setHud] = useState<OrbitHud>({ score: 0, best: 0, phase: 'ready', charging: false });
  const [muted, setMutedState] = useState(isMuted());
  const prevBest = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new OrbitGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
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
    if (hud.phase === 'dead' && hud.score > 0 && hud.score >= hud.best && hud.best !== prevBest.current) {
      if (!useSettings.getState().reducedMotion) {
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.5 }, colors: ['#7df0ff', '#ffe066', '#ffffff'] });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.score, hud.best]);

  const handleMute = () => {
    sfxClick();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.pointerDown();
        }}
        onPointerUp={() => gameRef.current?.pointerUp()}
        onPointerCancel={() => gameRef.current?.pointerUp()}
      />

      {hud.phase === 'playing' && (
        <div className="hud">
          <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
          <span className="chip">Best <strong>{hud.best}</strong></span>
          {hud.charging && <span className="chip combo">SLINGSHOT!</span>}
        </div>
      )}

      <button
        className="chip mute-btn"
        onClick={handleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {hud.phase === 'playing' && (
        <p className="hint-text">Tap to hop rings · hold then release to slingshot two rings · catch ⭐ dodge debris</p>
      )}

      {hud.phase === 'ready' && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1 className="start-title">Orbit Hop</h1>
          <p className="start-sub">hop rings, dodge debris</p>
          <div className="howto-row">
            <span>👆 tap = hop</span>
            <span>✊ hold = slingshot</span>
            <span>⭐ = points</span>
          </div>
          <button
            className="btn3d start-btn"
            data-testid="start-btn"
            onClick={() => gameRef.current?.start()}
          >
            Play
          </button>
        </div>
      )}

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
