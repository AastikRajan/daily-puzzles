import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { HelixGame, HELIX_SCENE, type HelixHud } from '../game/game';
import { useSettings } from '../state/settings';
import { isMuted, setMuted, sfxClick } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<HelixGame | null>(null);
  const [hud, setHud] = useState<HelixHud>({ depth: 0, score: 0, best: 0, combo: 0, tower: 1, phase: 'ready' });
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new HelixGame(canvas, (h) => setHud(h), () => useSettings.getState().reducedMotion);
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

  // Desktop keyboard: ArrowLeft/Right rotate tower
  useEffect(() => {
    const ROTATE_STEP = 0.18; // radians per key event
    const held = { left: false, right: false };
    let raf = 0;
    const rotate = () => {
      if (held.left) gameRef.current?.rotateKey(-ROTATE_STEP * 0.4);
      if (held.right) gameRef.current?.rotateKey(ROTATE_STEP * 0.4);
      if (held.left || held.right) raf = requestAnimationFrame(rotate);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        held.left = true;
        if (!held.right) { cancelAnimationFrame(raf); raf = requestAnimationFrame(rotate); }
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        held.right = true;
        if (!held.left) { cancelAnimationFrame(raf); raf = requestAnimationFrame(rotate); }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') held.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') held.right = false;
      if (!held.left && !held.right) cancelAnimationFrame(raf);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'won' && !useSettings.getState().reducedMotion) {
      confetti({ particleCount: 130, spread: 85, origin: { y: 0.5 }, colors: ['#ff6ec4', '#ffd84d', '#7df0ff'] });
    }
  }, [hud.phase]);

  const toSceneX = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * HELIX_SCENE.W;
  };

  const playing = hud.phase === 'playing';
  const over = hud.phase === 'dead' || hud.phase === 'won';

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.dragStart(toSceneX(e));
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0) gameRef.current?.dragMove(toSceneX(e));
        }}
        onPointerUp={() => gameRef.current?.dragEnd()}
        onPointerCancel={() => gameRef.current?.dragEnd()}
      />

      {/* HUD */}
      {playing && (
        <div className="hud">
          <span className="chip">Tower <strong>{hud.tower}</strong></span>
          <span className="chip">Depth <strong data-testid="hud-depth">{hud.depth}</strong></span>
          <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
          {hud.combo >= 3 && <span className="chip combo">🔥 FIRE</span>}
        </div>
      )}

      {/* Mute */}
      <button
        className="chip theme-btn"
        data-testid="mute-toggle"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          setMutedState(next);
          sfxClick();
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Hint */}
      {playing && (
        <p className="hint-text">Drag to spin · ArrowLeft/Right on desktop · 3 falls in a row = 🔥</p>
      )}

      {/* Ready / title overlay */}
      {hud.phase === 'ready' && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1 className="start-title">Helix Twist</h1>
          <p className="start-sub">YOU spin the tower</p>
          <div className="howto-row">
            <span>🖐 drag = spin</span>
            <span>fall the gaps</span>
            <span>3 chain = 🔥</span>
          </div>
          <button
            className="btn3d start-btn"
            data-testid="start-btn"
            onClick={() => {
              sfxClick();
              gameRef.current?.start();
            }}
          >
            ▶&nbsp;&nbsp;PLAY
          </button>
        </div>
      )}

      {/* Result overlay */}
      {over && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>{hud.phase === 'won' ? 'Tower down!' : 'Splat!'}</h2>
            <p className="sub">
              {hud.phase === 'won'
                ? `Tower ${hud.tower} cleared — onward!`
                : `Hit a danger plate at depth ${hud.depth}`}
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
              onClick={() => {
                sfxClick();
                gameRef.current?.restart(hud.phase === 'won');
              }}
            >
              {hud.phase === 'won' ? `Tower ${hud.tower + 1} →` : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
