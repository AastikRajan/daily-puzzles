import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { NomHoleGame, type HudState } from '../game/game';
import { useSettings } from '../state/settings';
import { isMuted, setMuted, sfxClick } from '../lib/sfx';

const ROUND_SEC = 75;

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<NomHoleGame | null>(null);
  const [hud, setHud] = useState<HudState>({
    score: 0, best: 0, timeLeft: ROUND_SEC, combo: 0,
    phase: 'ready', eaten: 0, total: 80,
  });
  const [muted, setMutedState] = useState(isMuted());
  const prevBest = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new NomHoleGame(
      canvas,
      (h) => setHud(h),
      () => useSettings.getState().reducedMotion,
    );
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

  // confetti on new best (only when over, and only when score is a new best)
  useEffect(() => {
    if (hud.phase === 'over') {
      if (hud.score > 0 && hud.score >= hud.best && hud.best !== prevBest.current) {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
          colors: ['#c77dff', '#ff9ef5', '#7b2fff', '#ffbe0b', '#ff6b6b'],
        });
      }
      prevBest.current = hud.best;
    }
  }, [hud.phase, hud.score, hud.best]);

  const pointerToWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return gameRef.current!.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const pct = Math.round((hud.eaten / hud.total) * 100);

  // timer color — yellow below 15s, red below 8s
  const timerClass = hud.timeLeft <= 8
    ? 'chip timer-chip danger'
    : hud.timeLeft <= 15
      ? 'chip timer-chip warn'
      : 'chip timer-chip';

  const handleStart = () => {
    gameRef.current?.start();
    sfxClick();
  };

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
        onPointerMove={(e) => {
          if (e.buttons > 0) gameRef.current?.setPointer(pointerToWorld(e));
        }}
        onPointerUp={() => gameRef.current?.setPointer(null)}
        onPointerCancel={() => gameRef.current?.setPointer(null)}
      />

      {hud.phase !== 'ready' && (
        <>
          <div className="hud">
            <span className="chip">Score <strong data-testid="hud-score">{hud.score}</strong></span>
            <span className={timerClass}>
              <strong data-testid="hud-timer">{hud.timeLeft}s</strong>
            </span>
            <span className="chip">Best <strong>{hud.best}</strong></span>
            {hud.combo > 1 && (
              <span className="chip combo" data-testid="hud-combo">×{hud.combo}</span>
            )}
          </div>

          <p className="hint-text">Drag to steer · eat smaller objects · grow your hole!</p>
        </>
      )}

      <button
        className="chip theme-btn"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          setMutedState(next);
          sfxClick();
        }}
        data-testid="mute-toggle"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {hud.phase === 'ready' && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1 className="start-title">Nom Hole</h1>
          <p className="start-sub">swallow the whole city</p>
          <div className="howto-row">
            <span>👆 drag = move</span>
            <span>eat smaller things</span>
            <span>grow HUGE</span>
          </div>
          <button
            className="btn3d start-btn"
            data-testid="start-btn"
            onClick={handleStart}
          >
            PLAY
          </button>
        </div>
      )}

      {hud.phase === 'over' && (
        <div className="overlay" role="dialog" aria-label="Round over" data-testid="game-over-overlay">
          <div className="card">
            <h2>Nom!</h2>
            <p className="sub">Time&apos;s up — you ate {pct}% of the city.</p>
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
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Eaten</span>
                <span className="stat-num">{hud.eaten}</span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">City %</span>
                <span className="stat-num">{pct}%</span>
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
