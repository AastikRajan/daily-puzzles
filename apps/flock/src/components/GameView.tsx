import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FlockGame, type FlockHud } from '../game/game';
import { useSettings } from '../state/settings';
import { sfxClick, isMuted, setMuted } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FlockGame | null>(null);
  const [hud, setHud] = useState<FlockHud>({ count: 0, delivered: 0, need: 20, level: 1, best: 1, phase: 'ready' });
  const [muted, setMutedState] = useState(() => isMuted());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new FlockGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
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
    if (hud.phase === 'won' && !useSettings.getState().reducedMotion) {
      confetti({ particleCount: 100, spread: 75, origin: { y: 0.45 }, colors: ['#ffe066', '#7ef0c0', '#8db8ff'] });
    }
  }, [hud.phase]);

  const toScene = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Scene is scaled to fit height, centered horizontally
    const sceneH = rect.height;
    const sceneW = sceneH * (390 / 700);
    const sceneLeft = rect.left + (rect.width - sceneW) / 2;
    const scale = 390 / sceneW;
    return {
      x: (e.clientX - sceneLeft) * scale,
      y: (e.clientY - rect.top) * scale,
    };
  };

  const handleMuteToggle = () => {
    sfxClick();
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const isPlaying = hud.phase !== 'ready';

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          if (hud.phase !== 'playing') return;
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.setPointer(toScene(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 && hud.phase === 'playing') gameRef.current?.setPointer(toScene(e));
        }}
        onPointerUp={() => gameRef.current?.setPointer(null)}
        onPointerCancel={() => gameRef.current?.setPointer(null)}
      />

      {isPlaying && (
        <div className="hud">
          <span className="chip">Lv <strong data-testid="hud-level">{hud.level}</strong></span>
          <span className="chip">🪰 <strong data-testid="hud-count">{hud.count}</strong></span>
          <span className="chip">🏠 <strong data-testid="hud-delivered">{hud.delivered}/{hud.need}</strong></span>
        </div>
      )}

      <button
        className="chip mute-btn"
        onClick={handleMuteToggle}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {isPlaying && (
        <p className="hint-text">Hold to lead the swarm · gates grow it · deliver fireflies home</p>
      )}

      {hud.phase === 'ready' && (
        <div className="overlay start-overlay" data-testid="start-overlay">
          <div className="card start-card">
            <h1 className="start-title">Flock!</h1>
            <p className="start-sub">lead the swarm home</p>
            <div className="howto-row">
              <span className="howto-chip">👆 hold = lead</span>
              <span className="howto-chip">gates grow it</span>
              <span className="howto-chip">🏠 = deliver</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={() => {
                sfxClick();
                gameRef.current?.start();
              }}
            >
              Play
            </button>
          </div>
        </div>
      )}

      {(hud.phase === 'won' || hud.phase === 'lost') && (
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
