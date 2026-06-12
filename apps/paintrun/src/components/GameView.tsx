import { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { PaintGame, PAINTS, type PaintHud } from '../game/game';
import { useSettings } from '../state/settings';
import { isMuted, setMuted, sfxClick } from '../lib/sfx';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PaintGame | null>(null);
  const [hud, setHud] = useState<PaintHud>({ pct: 0, level: 1, best: 0, color: 0, phase: 'ready', stars: 0 });
  const [muted, setMutedState] = useState(isMuted());
  const [displayPct, setDisplayPct] = useState(0);
  const countupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keysRef = useRef({ left: false, right: false });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new PaintGame(
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

  // keyboard steering for desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = true;
        gameRef.current?.steerKey('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = true;
        gameRef.current?.steerKey('right');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysRef.current.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysRef.current.right = false;
      }
      if (!keysRef.current.left && !keysRef.current.right) {
        gameRef.current?.steerKey(null);
      } else if (keysRef.current.left) {
        gameRef.current?.steerKey('left');
      } else {
        gameRef.current?.steerKey('right');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // score countup on finished
  useEffect(() => {
    if (hud.phase === 'finished') {
      if (hud.pct > 0 && !useSettings.getState().reducedMotion) {
        confetti({ particleCount: 60 + hud.stars * 30, spread: 80, origin: { y: 0.5 }, colors: ['#ff4ecd', '#36d6ff', '#a8e34d'] });
      }
      const targetPct = hud.pct;
      const duration = 900;
      const start = performance.now();
      setDisplayPct(0);
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / duration);
        const val = Math.round(easeOutCubic(t) * targetPct);
        setDisplayPct(val);
        if (val < targetPct) gameRef.current?.sfxTick();
        if (t < 1) {
          countupRef.current = setTimeout(tick, 16);
        }
      };
      countupRef.current = setTimeout(tick, 16);
    }
    if (hud.phase === 'crashed') setDisplayPct(hud.pct);
    return () => {
      if (countupRef.current) clearTimeout(countupRef.current);
    };
  }, [hud.phase]);

  const steer = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    gameRef.current?.steerTo(sx);
  }, []);

  const paintColor = PAINTS[hud.color]!;
  const playing = hud.phase === 'playing';
  const over = hud.phase === 'crashed' || hud.phase === 'finished';

  return (
    <div className="game-root">
      <canvas
        ref={canvasRef}
        className="game-canvas fullbleed"
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

      {/* HUD */}
      {playing && (
        <div className="hud">
          <span className="chip">Lv <strong>{hud.level}</strong></span>
          <span className="chip">🎨 <strong data-testid="hud-pct">{hud.pct}%</strong></span>
          <span className="chip" style={{ borderColor: paintColor.main }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: paintColor.main, display: 'inline-block' }} />
            <strong>{paintColor.name}</strong>
          </span>
        </div>
      )}

      {/* Mute button */}
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
        <p className="hint-text">Drag left/right to steer · ArrowLeft/Right on desktop</p>
      )}

      {/* Ready / title overlay */}
      {hud.phase === 'ready' && (
        <div className="start-overlay" data-testid="start-overlay">
          <h1 className="start-title">Paint Rush</h1>
          <p className="start-sub">paint the floor!</p>
          <div className="howto-row">
            <span>👆 drag = steer</span>
            <span>gates swap color</span>
            <span>⬛ = crash</span>
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
            <h2>
              {hud.phase === 'finished'
                ? `${'⭐'.repeat(Math.max(1, hud.stars))}`
                : 'Crashed!'}
            </h2>
            <p className="sub">
              {hud.phase === 'finished'
                ? `Level ${hud.level} — ${hud.pct}% painted`
                : `Hit a barrier — ${hud.pct}% painted`}
            </p>
            <div className="stats-row-pair">
              <div className="stat-box">
                <span className="stat-cap">Painted</span>
                <span className="stat-num" data-testid="final-pct">
                  {hud.phase === 'finished' ? displayPct : hud.pct}%
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-cap">Best</span>
                <span className="stat-num">{hud.best}%</span>
              </div>
            </div>
            <button
              className="btn3d"
              data-testid="continue-btn"
              onClick={() => {
                sfxClick();
                gameRef.current?.restart(hud.phase === 'finished');
              }}
            >
              {hud.phase === 'finished' ? `Level ${hud.level + 1} →` : 'Try again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
