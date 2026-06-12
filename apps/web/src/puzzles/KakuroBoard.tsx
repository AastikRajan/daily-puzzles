import { useEffect, useMemo, useState } from 'react';
import {
  generateDaily,
  kakuroHint,
  type KakuroPuzzle,
  type Difficulty,
} from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useSettings } from '../state/settings';
import { useProgress } from '../state/progress';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

interface KakuroState {
  /** cell index → digit (0/undefined = empty) */
  values: Record<number, number>;
}

export default function KakuroBoard({ date, difficulty }: { date: string; difficulty: Difficulty }) {
  const puzzle = useMemo(() => generateDaily(date, 'kakuro') as KakuroPuzzle, [date]);
  const errorCheck = useSettings((s) => s.errorCheck);
  const setSettings = useSettings((s) => s.set);
  const consumeHint = useProgress((s) => s.consumeHint);
  const { width, height, walls } = puzzle;

  const givens = puzzle.givens;

  const session = usePuzzleSession<KakuroState>({
    date,
    type: 'kakuro',
    initial: () => ({ values: { ...givens } }),
    isSolved: (s) => puzzle.whiteCells.every((i) => s.values[i] === puzzle.solution[i]),
  });

  const [selected, setSelected] = useState<number | null>(null);
  const { state, apply, completed } = session;

  // clue sums per wall cell: right (h) and down (v)
  const clues = useMemo(() => {
    const map = new Map<number, { right?: number; down?: number }>();
    puzzle.runs.forEach((run, ri) => {
      const entry = map.get(run.clueCell) ?? {};
      if (run.dir === 'h') entry.right = puzzle.sums[ri];
      else entry.down = puzzle.sums[ri];
      map.set(run.clueCell, entry);
    });
    return map;
  }, [puzzle]);

  const isGiven = (i: number) => givens[i] !== undefined;

  const setDigit = (d: number) => {
    if (selected === null || completed || isGiven(selected)) return;
    if (state.values[selected] === d) return;
    haptics.tap();
    const values = { ...state.values, [selected]: d };
    const mistake = puzzle.solution[selected] !== d;
    if (mistake) haptics.error();
    apply({ values }, { mistake });
  };

  const erase = () => {
    if (selected === null || completed || isGiven(selected)) return;
    if (!state.values[selected]) return;
    const values = { ...state.values };
    delete values[selected];
    apply({ values });
  };

  const hint = () => {
    if (completed) return;
    const h = kakuroHint(puzzle, state.values);
    if (!h || !consumeHint()) return;
    const values = { ...state.values, [h.cell]: h.value };
    setSelected(h.cell);
    apply({ values }, { hint: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') setDigit(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete') erase();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cellSize = 360 / Math.max(width, height);
  const sel = selected;

  // same-run highlight
  const selRuns = useMemo(() => {
    if (sel === null) return new Set<number>();
    const out = new Set<number>();
    for (const run of puzzle.runs) {
      if (run.cells.includes(sel)) run.cells.forEach((c) => out.add(c));
    }
    return out;
  }, [sel, puzzle]);

  const cells = [];
  for (let i = 0; i < width * height; i++) {
    const r = Math.floor(i / width);
    const c = i % width;
    const x = c * cellSize;
    const y = r * cellSize;

    if (walls[i]) {
      const clue = clues.get(i);
      cells.push(
        <g key={i}>
          <rect x={x + 1.5} y={y + 1.5} width={cellSize - 3} height={cellSize - 3} rx={5}
            fill="var(--ink)" opacity="0.82" />
          {clue && (clue.right !== undefined || clue.down !== undefined) && (
            <>
              <line x1={x + 4} y1={y + 4} x2={x + cellSize - 4} y2={y + cellSize - 4}
                stroke="var(--bg-a)" strokeWidth="1" opacity="0.5" />
              {clue.right !== undefined && (
                <text x={x + cellSize - 5} y={y + cellSize * 0.42} textAnchor="end"
                  fontSize={cellSize * 0.3} fontWeight={800} fill="var(--bg-a)">
                  {clue.right}
                </text>
              )}
              {clue.down !== undefined && (
                <text x={x + 5} y={y + cellSize - 6} textAnchor="start"
                  fontSize={cellSize * 0.3} fontWeight={800} fill="var(--bg-a)">
                  {clue.down}
                </text>
              )}
            </>
          )}
        </g>,
      );
      continue;
    }

    const v = state.values[i] ?? 0;
    const given = isGiven(i);
    const wrong = errorCheck && v !== 0 && v !== puzzle.solution[i];
    const isSel = sel === i;
    const inRun = !isSel && selRuns.has(i);

    cells.push(
      <g key={i} onClick={() => !given && setSelected(i)} data-testid={`cell-${i}`}
        style={{ cursor: given ? 'default' : 'pointer' }}>
        <rect
          x={x + 1.5}
          y={y + 1.5}
          width={cellSize - 3}
          height={cellSize - 3}
          rx={5}
          fill={isSel ? 'var(--accent-soft)' : given ? 'var(--line)' : 'var(--surface-solid)'}
          stroke={isSel ? 'var(--accent)' : inRun ? 'var(--accent)' : 'var(--line)'}
          strokeWidth={isSel ? 2.5 : inRun ? 1.5 : 1}
          opacity={inRun && !isSel ? 0.95 : 1}
          style={completed ? { animation: `cell-wave 700ms ease ${(r + c) * 30}ms` } : undefined}
        />
        {v !== 0 && (
          <text
            x={x + cellSize / 2}
            y={y + cellSize / 2 + cellSize * 0.18}
            textAnchor="middle"
            fontSize={cellSize * 0.5}
            fontWeight={given ? 800 : 600}
            fill={wrong ? 'var(--bad)' : given ? 'var(--ink)' : 'var(--accent)'}
          >
            {v}
          </text>
        )}
      </g>,
    );
  }

  return (
    <>
      <PuzzleHeader type="kakuro" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg className="board-svg" viewBox={`-2 -2 ${width * cellSize + 4} ${height * cellSize + 4}`} data-testid="kakuro-grid">
            {cells}
          </svg>
        </div>
      </div>

      <p className="board-hint-text">Each run adds to its clue — no repeated digits in a run.</p>

      <Toolbar>
        <button className="tool" onClick={session.undo} disabled={!session.canUndo} data-testid="undo" aria-label="Undo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6L4 10l4 4" /><path d="M4 10h9a5 5 0 0 1 0 10h-2" />
          </svg>
          <span className="tool-label">Undo</span>
        </button>
        <button className="tool" onClick={session.redo} disabled={!session.canRedo} data-testid="redo" aria-label="Redo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 6l4 4-4 4" /><path d="M18 10H9a5 5 0 0 0 0 10h2" />
          </svg>
          <span className="tool-label">Redo</span>
        </button>
        <button className="tool" onClick={erase} data-testid="erase" aria-label="Erase">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 17.5L3.5 12.5a1.6 1.6 0 0 1 0-2.3l7-7a1.6 1.6 0 0 1 2.3 0l5.7 5.7a1.6 1.6 0 0 1 0 2.3l-6.3 6.3H8.5z" /><path d="M6 18h12" />
          </svg>
          <span className="tool-label">Erase</span>
        </button>
        <button
          className={`tool ${errorCheck ? 'active' : ''}`}
          onClick={() => setSettings({ errorCheck: !errorCheck })}
          data-testid="error-toggle"
          aria-pressed={errorCheck}
          aria-label="Check errors"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M11 7v5" /><circle cx="11" cy="15" r="0.4" fill="currentColor" />
          </svg>
          <span className="tool-label">Check</span>
        </button>
        <HintButton onHint={hint} disabled={completed} />
      </Toolbar>

      <div className="keypad" data-testid="keypad">
        {Array.from({ length: 9 }, (_, k) => {
          const d = k + 1;
          return (
            <button key={d} className="key" onClick={() => setDigit(d)} disabled={completed} data-testid={`key-${d}`}>
              {d}
            </button>
          );
        })}
      </div>

      {completed && (
        <WinOverlay
          type="kakuro"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
