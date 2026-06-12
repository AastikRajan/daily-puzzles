import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { utcDateString, msUntilNextPuzzle } from '@daily-logic/engine';
import { BalanceSim, type SimHud } from '../game/sim';
import { dailyShapes } from '../game/shapes';
import { buildBalanceShare, shareText } from '../lib/share';
import { load, save } from '../lib/storage';
import { useSettings } from '../state/settings';
import { sfxStart } from '../lib/sfx';

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function GameView() {
  const date = utcDateString();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<BalanceSim | null>(null);
  const [hud, setHud] = useState<SimHud>({
    phase: 'playing',
    attempt: 1,
    placed: 0,
    total: 8,
    settleFrac: 0,
    attemptResults: [],
  });
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [countdown, setCountdown] = useState(msUntilNextPuzzle());
  const [started, setStarted] = useState(false);
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);
  const shapes = useRef(dailyShapes(date));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const sim = new BalanceSim(
      canvas,
      shapes.current,
      (h: SimHud) => setHud(h),
      () => useSettings.getState().reducedMotion,
    );
    simRef.current = sim;
    const fit = () => {
      const w = Math.min(window.innerWidth - 16, (window.innerHeight - 150) / 1.436, 760);
      sim.resize(w, Math.round(w * 1.436), canvas);
    };
    fit();
    window.addEventListener('resize', fit);
    const id = setInterval(() => setCountdown(msUntilNextPuzzle()), 1000);
    return () => {
      window.removeEventListener('resize', fit);
      clearInterval(id);
      sim.destroy();
    };
  }, []);

  // streak + win persistence + confetti
  useEffect(() => {
    if (hud.phase === 'won') {
      const lastWin = load<string>('streak.last', '');
      if (lastWin !== date) {
        const yesterday = new Date(`${date}T00:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yd = yesterday.toISOString().slice(0, 10);
        const n = lastWin === yd ? load<number>('streak.n', 0) + 1 : 1;
        save('streak.n', n);
        save('streak.last', date);
      }
      if (!useSettings.getState().reducedMotion) {
        confetti({ particleCount: 130, spread: 85, origin: { y: 0.55 }, colors: ['#7ed9a7', '#ffc46b', '#ff8fa3', '#8db8ff'] });
      }
    }
  }, [hud.phase, date]);

  const toScene = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = 390 / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  };

  const remaining = shapes.current.slice(hud.placed);
  const solved = hud.phase === 'won';
  const overlayOpen = hud.phase === 'won' || hud.phase === 'failed' || hud.phase === 'dayDone';

  const onShare = async () => {
    const text = buildBalanceShare(date, hud.attemptResults, solved, load<number>('streak.n', 0));
    const r = await shareText(text);
    if (r !== 'failed') setShareState(r);
  };

  return (
    <div className="game-root">
      <header className="app-head">
        <span className="brand">Balance!</span>
        <div className="head-side">
          <span className="chip" data-testid="attempt-chip">Try <strong>{hud.attempt}/5</strong></span>
          <button
            className="chip"
            onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      <div className="tray" data-testid="tray">
        {remaining.map((s, i) => (
          <span
            key={hud.placed + i}
            className={`tray-shape ${i === 0 ? 'next' : ''}`}
            style={{ background: s.color, borderColor: s.deep }}
            data-kind={s.kind}
          />
        ))}
        {remaining.length === 0 && <span className="tray-empty">All placed — hold steady…</span>}
      </div>

      <div className="stage">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          data-testid="game-canvas"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            simRef.current?.setHold(toScene(e));
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0) simRef.current?.setHold(toScene(e));
          }}
          onPointerUp={() => simRef.current?.dropHold()}
          onPointerCancel={() => simRef.current?.setHold(null)}
        />
        {!started && (
          <div className="start-overlay" data-testid="start-overlay">
            <h1 className="start-title">Balance!</h1>
            <p className="start-sub">today's 8 shapes — same for everyone</p>
            <div className="howto-row">
              <span>👆 drag = place</span>
              <span>⟳ rotate</span>
              <span>5 tries · don't topple</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={() => {
                sfxStart();
                setStarted(true);
              }}
            >
              ▶ &nbsp;PLAY
            </button>
          </div>
        )}
        <button className="chip rotate-btn" onClick={() => simRef.current?.rotateHold()} aria-label="Rotate shape">
          ⟳ Rotate
        </button>
      </div>

      <p className="hint-text">
        Drag above the plank, release to drop · place all {hud.total} without toppling
      </p>

      {overlayOpen && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>{solved ? 'Balanced!' : hud.phase === 'dayDone' ? 'Out of tries' : 'Toppled!'}</h2>
            <p className="sub">
              {solved
                ? `Solved in ${hud.attemptResults.length}/5 attempts`
                : hud.phase === 'dayDone'
                  ? 'Come back for tomorrow’s shapes'
                  : `${hud.placed}/${hud.total} placed — attempt ${hud.attempt} of 5`}
            </p>
            <div className="rows" data-testid="attempt-rows">
              {hud.attemptResults.map((r, i) => (
                <div key={i} className="row-emoji">
                  {r === -1 ? '🟩' : '🟦'.repeat(Math.min(r, 7)) + '🟥'}
                </div>
              ))}
            </div>
            <div className="actions">
              {solved || hud.phase === 'dayDone' ? (
                <button className="btn3d" onClick={onShare} data-testid="share">
                  {shareState === 'idle' ? 'Share result' : shareState === 'copied' ? 'Copied!' : 'Shared!'}
                </button>
              ) : (
                <button className="btn3d" onClick={() => simRef.current?.retry()} data-testid="retry">
                  Try again ({5 - hud.attempt} left)
                </button>
              )}
            </div>
            <p className="countdown-note">
              Next shapes in <strong>{fmtCountdown(countdown)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
