import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { utcDateString, msUntilNextPuzzle } from '@daily-logic/engine';
import { dailyMaze, canMove, step, DIRS, type Maze } from '../engine/maze';
import { tap, pop, death } from '../lib/haptics';
import { load, save } from '../lib/storage';
import { useSettings } from '../state/settings';

type Phase = 'reveal' | 'dark' | 'won';

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function GameView() {
  const date = utcDateString();
  const mazeRef = useRef<Maze>(dailyMaze(date));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('reveal');
  const [pos, setPos] = useState(mazeRef.current.start);
  const [bumps, setBumps] = useState(0);
  const [echoesLeft, setEchoesLeft] = useState(mazeRef.current.echoes);
  const [echoUntil, setEchoUntil] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [countdown, setCountdown] = useState(msUntilNextPuzzle());
  const bumpFlash = useRef<{ cell: number; dir: number; t: number } | null>(null);
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);

  // reveal → dark transition
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase((p) => (p === 'reveal' ? 'dark' : p));
      setStartedAt(Date.now());
    }, mazeRef.current.revealMs);
    const id = setInterval(() => setCountdown(msUntilNextPuzzle()), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  // timer
  useEffect(() => {
    if (phase !== 'dark') return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  const move = useCallback(
    (dirIdx: number) => {
      if (phase !== 'dark') return;
      const m = mazeRef.current;
      setPos((cur) => {
        if (!canMove(m, cur, dirIdx)) {
          setBumps((b) => b + 1);
          bumpFlash.current = { cell: cur, dir: dirIdx, t: Date.now() };
          death();
          return cur;
        }
        tap();
        const nxt = step(m, cur, dirIdx);
        if (nxt === m.exit) {
          setPhase('won');
          pop();
          const lastWin = load<string>('streak.last', '');
          if (lastWin !== date) {
            const y = new Date(`${date}T00:00:00Z`);
            y.setUTCDate(y.getUTCDate() - 1);
            const n = lastWin === y.toISOString().slice(0, 10) ? load<number>('streak.n', 0) + 1 : 1;
            save('streak.n', n);
            save('streak.last', date);
          }
          if (!useSettings.getState().reducedMotion) {
            confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 }, colors: ['#7df0ff', '#ffe066', '#ffffff'] });
          }
        }
        return nxt;
      });
    },
    [phase, date],
  );

  const echo = useCallback(() => {
    if (phase !== 'dark' || echoesLeft <= 0) return;
    setEchoesLeft((e) => e - 1);
    setEchoUntil(Date.now() + 900);
    tap();
  }, [phase, echoesLeft]);

  // debug/test API
  useEffect(() => {
    (window as unknown as Record<string, unknown>)['__maze'] = {
      pos: () => pos,
      phase: () => phase,
      bumps: () => bumps,
      move: (d: number) => move(d),
      echo: () => echo(),
      skipReveal: () => {
        setPhase((p) => (p === 'reveal' ? 'dark' : p));
        setStartedAt((s) => s || Date.now());
      },
    };
  }, [pos, phase, bumps, move, echo]);

  // render
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const draw = () => {
      const m = mazeRef.current;
      const w = Math.min(window.innerWidth - 24, 470);
      const cell = Math.floor(w / m.size);
      const W = cell * m.size;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = W * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${W}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = Date.now();
      const lit = phase === 'reveal' || phase === 'won' || now < echoUntil;

      // background
      ctx.fillStyle = '#06070f';
      ctx.fillRect(0, 0, W, W);

      const px = (pos % m.size) * cell + cell / 2;
      const py = Math.floor(pos / m.size) * cell + cell / 2;

      // visibility mask radius (in dark phase a lantern around the player)
      const seeR = lit ? W * 2 : cell * 1.9;

      // exit glow (always faintly visible — the goal calls to you)
      const ex = (m.exit % m.size) * cell + cell / 2;
      const ey = Math.floor(m.exit / m.size) * cell + cell / 2;
      const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, cell * 1.1);
      eg.addColorStop(0, 'rgba(255, 224, 102, 0.8)');
      eg.addColorStop(1, 'rgba(255, 224, 102, 0)');
      ctx.fillStyle = eg;
      ctx.fillRect(ex - cell, ey - cell, cell * 2, cell * 2);

      // walls
      ctx.lineCap = 'round';
      for (let i = 0; i < m.size * m.size; i++) {
        const cx = (i % m.size) * cell;
        const cy = Math.floor(i / m.size) * cell;
        const ccx = cx + cell / 2;
        const ccy = cy + cell / 2;
        const d = Math.hypot(ccx - px, ccy - py);
        if (d > seeR + cell) continue;
        const fade = lit ? 1 : Math.max(0, 1 - d / (seeR + cell * 0.4));
        ctx.strokeStyle = `rgba(125, 240, 255, ${0.75 * fade})`;
        ctx.shadowColor = '#7df0ff';
        ctx.shadowBlur = lit ? 6 : 10 * fade;
        ctx.lineWidth = 2.5;
        const wbits = m.walls[i]!;
        ctx.beginPath();
        if (wbits & 1) { ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy); }
        if (wbits & 2) { ctx.moveTo(cx + cell, cy); ctx.lineTo(cx + cell, cy + cell); }
        if (wbits & 4) { ctx.moveTo(cx, cy + cell); ctx.lineTo(cx + cell, cy + cell); }
        if (wbits & 8) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cell); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // bump flash — show the wall you hit in red
      const bf = bumpFlash.current;
      if (bf && now - bf.t < 450) {
        const a = 1 - (now - bf.t) / 450;
        const cx = (bf.cell % m.size) * cell;
        const cy = Math.floor(bf.cell / m.size) * cell;
        const d = DIRS[bf.dir]!;
        ctx.strokeStyle = `rgba(255, 90, 110, ${a})`;
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff5a6e';
        ctx.shadowBlur = 14 * a;
        ctx.beginPath();
        if (d.bit === 1) { ctx.moveTo(cx, cy); ctx.lineTo(cx + cell, cy); }
        if (d.bit === 2) { ctx.moveTo(cx + cell, cy); ctx.lineTo(cx + cell, cy + cell); }
        if (d.bit === 4) { ctx.moveTo(cx, cy + cell); ctx.lineTo(cx + cell, cy + cell); }
        if (d.bit === 8) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cell); }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // exit marker
      ctx.fillStyle = '#ffe066';
      ctx.font = `800 ${cell * 0.42}px 'Baloo 2 Variable', cursive`;
      ctx.textAlign = 'center';
      ctx.fillText('★', ex, ey + cell * 0.16);

      // player lantern
      const lg = ctx.createRadialGradient(px, py, 1, px, py, lit ? cell : cell * 1.9);
      lg.addColorStop(0, 'rgba(125, 240, 255, 0.35)');
      lg.addColorStop(1, 'rgba(125, 240, 255, 0)');
      ctx.fillStyle = lg;
      ctx.fillRect(px - cell * 2, py - cell * 2, cell * 4, cell * 4);
      ctx.fillStyle = '#eafdff';
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a3540';
      ctx.beginPath();
      ctx.arc(px - cell * 0.07, py - cell * 0.05, cell * 0.045, 0, Math.PI * 2);
      ctx.arc(px + cell * 0.07, py - cell * 0.05, cell * 0.045, 0, Math.PI * 2);
      ctx.fill();

      // reveal countdown bar
      if (phase === 'reveal') {
        const frac = 1 - Math.min(1, (now - revealStart.current) / m.revealMs);
        ctx.fillStyle = 'rgba(125, 240, 255, 0.85)';
        ctx.fillRect(0, 0, W * frac, 4);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase, pos, echoUntil]);

  const revealStart = useRef(Date.now());

  // swipe input
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 18) return;
    const dirIdx = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    move(dirIdx);
  };

  // keyboard for desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
      if (e.key in map) {
        e.preventDefault();
        move(map[e.key]!);
      }
      if (e.key === ' ') echo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, echo]);

  const onShare = async () => {
    const d = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const streak = load<number>('streak.n', 0);
    const text = [
      `Echo Maze · ${d}`,
      `⏱️ ${fmt(elapsed)} · 🔔 ${mazeRef.current.echoes - echoesLeft} echoes · 💥 ${bumps} bumps`,
      streak > 1 ? `🔥 ${streak}-day streak` : '',
      'https://echo-maze.app',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setShareState('shared');
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareState('copied');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="game-root maze-root">
      <header className="app-head">
        <span className="brand">Echo Maze</span>
        <div className="head-side">
          <span className="chip">💥 <strong data-testid="bumps">{bumps}</strong></span>
          <span className="chip">⏱ <strong>{fmt(elapsed)}</strong></span>
          <button className="chip" onClick={() => setSettings({ theme: theme === 'light' ? 'dark' : 'light' })} aria-label="Toggle theme">
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </header>

      <div className="maze-stage" onPointerDown={onDown} onPointerUp={onUp}>
        <canvas ref={canvasRef} className="game-canvas maze-canvas" data-testid="game-canvas" />
        {phase === 'reveal' && <div className="reveal-tag" data-testid="reveal-tag">MEMORIZE…</div>}
      </div>

      <div className="maze-controls">
        <button className="btn3d echo-btn" onClick={echo} disabled={phase !== 'dark' || echoesLeft === 0} data-testid="echo-btn">
          🔔 Echo ({echoesLeft})
        </button>
      </div>
      <p className="hint-text">Memorize the maze, then swipe to move in the dark · ★ is the exit</p>

      {phase === 'won' && (
        <div className="overlay" role="dialog" data-testid="result-overlay">
          <div className="card">
            <h2>Escaped!</h2>
            <p className="sub">
              {fmt(elapsed)} · {bumps} bumps · {mazeRef.current.echoes - echoesLeft} echoes used
            </p>
            <button className="btn3d" onClick={onShare} data-testid="share">
              {shareState === 'idle' ? 'Share result' : shareState === 'copied' ? 'Copied!' : 'Shared!'}
            </button>
            <p className="countdown-note">
              Next maze in <strong>{fmtCountdown(countdown)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
