import { readFileSync, writeFileSync } from 'node:fs';

const f = 'apps/maze/src/components/GameView.tsx';
let s = readFileSync(f, 'utf8');

// splice the JSX block between stable anchors
const a1 = s.indexOf('<header className="app-head">');
const a2 = s.indexOf('is the exit</p>');
if (a1 < 0 || a2 < 0) throw new Error('anchors not found');
const end = a2 + 'is the exit</p>'.length;
const clean = `<header className="app-head">
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
        {started && phase === 'reveal' && <div className="reveal-tag" data-testid="reveal-tag">MEMORIZE…</div>}
        {!started && (
          <div className="start-overlay" data-testid="start-overlay">
            <h1 className="start-title">Echo Maze</h1>
            <p className="start-sub">memorize it lit — escape it dark</p>
            <div className="howto-row">
              <span>👀 memorize</span>
              <span>👆 swipe = move</span>
              <span>🔔 echo = re-light</span>
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

      <div className="maze-controls">
        <button className="btn3d echo-btn" onClick={echo} disabled={phase !== 'dark' || echoesLeft === 0} data-testid="echo-btn">
          🔔 Echo ({echoesLeft})
        </button>
      </div>
      <p className="hint-text">Memorize the maze, then swipe to move in the dark · ★ is the exit</p>`;
s = s.slice(0, a1) + clean + s.slice(end);

// splice the share lines between anchors
const b1 = s.indexOf('`Echo Maze');
const b2 = s.indexOf("-day streak` : '',");
if (b1 < 0 || b2 < 0) throw new Error('share anchors not found');
const bEnd = b2 + "-day streak` : '',".length;
const cleanShare = '`Echo Maze · ${d}`,\n      `⏱️ ${fmt(elapsed)} · 🔔 ${mazeRef.current.echoes - echoesLeft} echoes · 💥 ${bumps} bumps`,\n      streak > 1 ? `🔥 ${streak}-day streak` : \'\',';
s = s.slice(0, b1) + cleanShare + s.slice(bEnd);

writeFileSync(f, s);
console.log('maze fixed');
