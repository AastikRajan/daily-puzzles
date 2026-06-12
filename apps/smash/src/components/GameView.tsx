import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { SmashGame, type HudState } from '../game/game';
import { useSettings } from '../state/settings';
import { isMuted, setMuted, sfxClick } from '../lib/sfx';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SmashGame | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<HudState>({
    score: 0,
    best: 0,
    depth: 0,
    towerDepth: 40,
    towerNum: 1,
    phase: 'ready',
    holding: false,
    fireballing: false,
    fireMeter: 0,
  });
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new SmashGame(
      canvas,
      (h) => setHud(h),
      () => useSettings.getState().reducedMotion,
    );
    gameRef.current = game;

    const fit = () => {
      // match the .game-scene CSS box exactly so the canvas is never stretched
      const scene = sceneRef.current;
      const w = scene ? scene.clientWidth : Math.min(window.innerWidth, 480);
      const h = scene ? scene.clientHeight : window.innerHeight;
      game.resize(w, h, canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      game.destroy();
    };
  }, []);

  useEffect(() => {
    if (hud.phase === 'won') {
      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.4 },
        colors: ['#ff4e00', '#ff9020', '#ffe94e', '#00f5a0', '#4e9fff'],
      });
    }
  }, [hud.phase]);

  const startHold = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gameRef.current?.setHolding(true);
  };
  const endHold = (e: React.PointerEvent) => {
    e.preventDefault();
    gameRef.current?.setHolding(false);
  };

  return (
    <div className="game-root">
      <div className="gutter left" />

      <div className="game-scene" ref={sceneRef}>
        <canvas
          ref={canvasRef}
          className="game-canvas"
          data-testid="game-canvas"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerCancel={endHold}
        />

        {/* HUD */}
        <div className="hud">
          <span className="chip">
            Depth <strong data-testid="hud-depth">{hud.depth}/{hud.towerDepth}</strong>
          </span>
          <span className="chip">
            Score <strong data-testid="hud-score">{hud.score}</strong>
          </span>
          <span className="chip">
            Best <strong>{hud.best}</strong>
          </span>
          <span className="chip">
            T<strong>{hud.towerNum}</strong>
          </span>
        </div>

        {/* Mute toggle */}
        <button
          className="chip theme-btn"
          onClick={() => { setMutedState(!muted); setMuted(!muted); sfxClick(); }}
          data-testid="mute-toggle"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {/* Fire meter */}
        {(hud.holding || hud.fireballing) && (
          <div className="fire-meter-wrap">
            <div
              className={`fire-meter-bar ${hud.fireballing ? 'fire-meter-active' : ''}`}
              style={{ width: `${hud.fireMeter * 100}%` }}
              data-testid="fire-meter"
            />
          </div>
        )}

        {/* Hint text — hidden during ready phase */}
        {hud.phase !== 'ready' && (
          <p className="hint-text">Hold to smash · 4 in a row ignites FIREBALL 🔥</p>
        )}

        {/* Start overlay */}
        {hud.phase === 'ready' && (
          <div className="start-overlay" data-testid="start-overlay">
            <h1 className="start-title">Smash Drop</h1>
            <p className="start-sub">hold to SMASH</p>
            <div className="howto-row">
              <span>🖐 hold = smash</span>
              <span>⬛ = danger</span>
              <span>4 in a row = 🔥</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={() => gameRef.current?.start()}
            >
              PLAY
            </button>
          </div>
        )}

        {/* Death overlay */}
        {hud.phase === 'dead' && (
          <div className="overlay" role="dialog" aria-label="Game over" data-testid="game-over-overlay">
            <div className="card">
              <h2>💥 Smashed!</h2>
              <p className="sub">You hit a danger segment.</p>
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
                  <span className="stat-cap">Depth</span>
                  <span className="stat-num">{hud.depth}/{hud.towerDepth}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-cap">Tower</span>
                  <span className="stat-num">{hud.towerNum}</span>
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

        {/* Win overlay */}
        {hud.phase === 'won' && (
          <div className="overlay" role="dialog" aria-label="Tower cleared" data-testid="win-overlay">
            <div className="card">
              <h2>🏆 Cleared!</h2>
              <p className="sub">Tower {hud.towerNum} smashed to pieces!</p>
              <div className="stats-row-pair">
                <div className="stat-box">
                  <span className="stat-cap">Score</span>
                  <span className="stat-num" data-testid="win-score">{hud.score}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-cap">Best</span>
                  <span className="stat-num">{hud.best}</span>
                </div>
              </div>
              <button
                className="btn3d btn3d-fire"
                data-testid="next-tower-btn"
                onClick={() => gameRef.current?.nextTower()}
              >
                Next Tower 🔥
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="gutter right" />
    </div>
  );
}
