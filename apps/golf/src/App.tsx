import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { msUntilNextPuzzle } from '@daily-logic/engine';
import { useGame } from './state/game';
import { useSettings, applyTheme } from './state/settings';
import { GameCanvas } from './components/GameCanvas';
import { HoleBanner } from './components/HoleBanner';
import { buildGolfShare, shareText, holeEmoji } from './lib/share';
import { formatCountdown, shortDate } from './lib/time';
import { sfxStart } from './lib/sfx';

declare global {
  interface Window {
    __golf: {
      hole: () => number;
      strokes: () => number[];
      shoot: (angleRad: number, power01: number) => void;
      ballAt: () => { x: number; y: number };
      holeAt: () => { x: number; y: number };
      skipHole: () => void;
      phase: () => string;
      ballStatus: () => string;
    };
  }
}

function Scorecard() {
  const { holes, strokes, date, stats } = useGame();
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const pars = holes.map((h) => h.par);
  const total = strokes.reduce((a, b) => a + b, 0);
  const totalPar = pars.reduce((a, b) => a + b, 0);
  const diff = total - totalPar;
  const diffStr = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const [countdown, setCountdown] = useState(msUntilNextPuzzle());

  useEffect(() => {
    confetti({
      particleCount: diff <= 0 ? 120 : 60,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#00ffcc', '#00b8ff', '#ffffff', '#ff3366'],
    });
    const id = setInterval(() => setCountdown(msUntilNextPuzzle()), 1000);
    return () => clearInterval(id);
  }, [diff]);

  const onShare = async () => {
    const text = buildGolfShare(date, strokes, pars, stats.streak, stats.bestVsPar);
    const result = await shareText(text);
    if (result !== 'failed') setShareState(result);
  };

  return (
    <div className="overlay" role="dialog" aria-label="Scorecard" data-testid="scorecard">
      <div className="card">
        <h2>Round complete</h2>
        <p className="sub">{shortDate(date)} · {stats.streak > 1 ? `🔥 ${stats.streak}-day streak` : 'Daily course'}</p>
        <div className="score-rows" data-testid="score-rows">
          {strokes.map((s, i) => (
            <span className="score-cell" key={i}>
              <span className="em">{holeEmoji(s, pars[i] ?? 3)}</span>
              {s}
            </span>
          ))}
        </div>
        <div className="total-line" data-testid="total-line">
          {total} strokes · <span style={{ color: diff <= 0 ? 'var(--good)' : 'var(--bad)' }}>{diffStr}</span> ⛳
        </div>
        <div className="actions">
          <button className="btn3d" onClick={onShare} data-testid="share">
            {shareState === 'idle' ? 'Share scorecard' : shareState === 'copied' ? 'Copied!' : 'Shared!'}
          </button>
        </div>
        <p className="foot-note" style={{ paddingBottom: 0 }}>
          Next course in <strong>{formatCountdown(countdown)}</strong>
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { holes, holeIndex, strokes, phase, ballState } = useGame();
  const theme = useSettings((s) => s.theme);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const setSettings = useSettings((s) => s.set);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(390);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    applyTheme(theme, reducedMotion);
  }, [theme, reducedMotion]);

  // size the course by available HEIGHT so desktop fills the screen
  useEffect(() => {
    const fit = () => {
      const hole0 = useGame.getState().holes[useGame.getState().holeIndex];
      const aspect = hole0 ? hole0.canvasH / hole0.canvasW : 1.54;
      const availH = window.innerHeight - 132; // header + hud + footnote
      const wByH = Math.floor(availH / aspect);
      setStageW(Math.max(300, Math.min(wByH, window.innerWidth - 24, 760)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // debug/test API — always exposed (harmless)
  useEffect(() => {
    window.__golf = {
      hole: () => useGame.getState().holeIndex,
      strokes: () => useGame.getState().strokes,
      shoot: (a, p) => useGame.getState().shoot(a, p),
      ballAt: () => {
        const b = useGame.getState().ballState;
        return { x: b.x, y: b.y };
      },
      holeAt: () => {
        const g = useGame.getState();
        const h = g.holes[g.holeIndex]!.hole;
        return { x: h.x, y: h.y };
      },
      skipHole: () => useGame.getState().skipHole(),
      phase: () => useGame.getState().phase,
      ballStatus: () => useGame.getState().ballState.status,
    };
  }, []);

  const hole = holes[holeIndex];
  const aspect = hole ? hole.canvasH / hole.canvasW : 1.4;
  const canvasH = Math.round(stageW * aspect);
  const curStrokes = strokes[holeIndex] ?? 0;

  return (
    <>
      <header className="app-head">
        <span className="brand">Glow Golf</span>
        <div className="head-side">
          <button
            className="chip"
            onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })}
            aria-label="Toggle theme"
            data-testid="theme-toggle"
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      <div className="hud">
        <span className="chip">Hole <strong>{Math.min(holeIndex + 1, 9)}/9</strong></span>
        <span className="chip">Par <strong>{hole?.par ?? '-'}</strong></span>
        <span className="chip" data-testid="strokes-chip">Strokes <strong>{curStrokes}</strong></span>
      </div>

      <div className="canvas-stage" ref={stageRef} style={{ height: canvasH, width: stageW, margin: '0 auto' }}>
        <GameCanvas width={stageW} height={canvasH} />
        {started && <HoleBanner />}
        {!started && (
          <div className="start-overlay" data-testid="start-overlay">
            <h1 className="start-title">Glow Golf</h1>
            <p className="start-sub">nine neon holes · same course for everyone today</p>
            <div className="howto-row">
              <span>🖐 drag back = aim</span>
              <span>✋ release = shoot</span>
              <span>⛳ beat par</span>
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
      </div>

      <p className="foot-note">
        Drag back from anywhere to aim · release to shoot
        {ballState.status === 'rolling' ? ' · rolling…' : ''}
      </p>

      {phase === 'scorecard' && <Scorecard />}
    </>
  );
}
