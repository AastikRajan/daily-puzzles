import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SnakeGame, type HudState } from '../game/game';
import { useSettings } from '../state/settings';
import { isMuted, setMuted, sfxClick } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const [hud, setHud] = useState<HudState>({ score: 0, best: 0, length: 5, combo: 0, phase: 'ready' });
  const [muted, setMutedState] = useState(isMuted());
  const prevBest = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new SnakeGame(
      canvas,
      (h) => setHud(h),
      () => useSettings.getState().reducedMotion,
    );
    gameRef.current = game;

    const fit = () => game.resize(window.innerWidth, window.innerHeight, canvas);
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'dead') {
      if (hud.score > 0 && hud.score >= hud.best && hud.best !== prevBest.current) {
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 }, colors: ['#00f5a0', '#ff4ecd', '#4e9fff', '#ffe94e'] });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.score, hud.best]);

  const pointerToWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return gameRef.current!.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const playing = hud.phase === 'playing';

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
        data-testid="game-canvas"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          gameRef.current?.setPointer(pointerToWorld(e));
        }}
        onPointerMove={(e) => gameRef.current?.setPointer(pointerToWorld(e))}
      />

      <div className="hud">
        <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
        <span className="chip">Best <strong>{hud.best}</strong></span>
        <span className="chip">Length <strong data-testid="hud-length">{hud.length}</strong></span>
        {hud.combo > 1 && <span className="chip combo" data-testid="hud-combo">×{hud.combo}</span>}
      </div>

      <button
        className="chip theme-btn"
        onClick={() => {
          setMuted(!muted);
          setMutedState(!muted);
          sfxClick();
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
        data-testid="mute-toggle"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {playing && (
        <button
          className="boost-btn"
          data-testid="boost-btn"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
            gameRef.current?.setBoost(true);
          }}
          onPointerUp={() => gameRef.current?.setBoost(false)}
          onPointerCancel={() => gameRef.current?.setBoost(false)}
          aria-label="Boost"
        >
          🚀
        </button>
      )}

      {hud.phase === 'ready' && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1 className="start-title">Snake Pop</h1>
          <p className="start-sub">your body is the match-3 board</p>
          <div className="howto-row">
            <span>👆 move = steer</span>
            <span>🚀 hold = boost</span>
            <span>🟢🟢🟢 = POP!</span>
          </div>
          <button
            className="btn3d start-btn"
            data-testid="start-btn"
            onClick={() => gameRef.current?.start()}
          >
            ▶ &nbsp;PLAY
          </button>
        </div>
      )}

      {playing && <p className="hint-text">3 same-color segments in a row POP for points</p>}

      {hud.phase === 'dead' && (
        <div className="overlay" role="dialog" aria-label="Game over" data-testid="game-over-overlay">
          <div className="card">
            <h2>Popped!</h2>
            <p className="sub">Your run is over.</p>
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
              data-testid="play-again-btn"
              onClick={() => gameRef.current?.restart()}
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
