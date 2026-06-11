import { useEffect, useMemo, useState } from 'react';
import {
  generateDaily,
  sudokuHint,
  type SudokuPuzzle,
  type Difficulty,
} from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useSettings } from '../state/settings';
import { useProgress } from '../state/progress';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

interface SudokuState {
  values: number[];
  /** bitmask per cell, bit d-1 = pencil mark d */
  pencil: number[];
}

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

export default function SudokuBoard({ date, difficulty }: { date: string; difficulty: Difficulty }) {
  const puzzle = useMemo(() => generateDaily(date, 'sudoku') as SudokuPuzzle, [date]);
  const errorCheck = useSettings((s) => s.errorCheck);
  const setSettings = useSettings((s) => s.set);
  const consumeHint = useProgress((s) => s.consumeHint);

  const session = usePuzzleSession<SudokuState>({
    date,
    type: 'sudoku',
    initial: () => ({ values: puzzle.givens.slice(), pencil: new Array(81).fill(0) }),
    isSolved: (s) => s.values.every((v, i) => v === puzzle.solution[i]),
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [pencilMode, setPencilMode] = useState(false);
  const { state, apply, completed } = session;

  const setDigit = (d: number) => {
    if (selected === null || completed) return;
    if (puzzle.givens[selected] !== 0) return;
    haptics.tap();
    if (pencilMode) {
      const pencil = state.pencil.slice();
      pencil[selected] ^= 1 << (d - 1);
      apply({ values: state.values, pencil });
      return;
    }
    if (state.values[selected] === d) return;
    const values = state.values.slice();
    values[selected] = d;
    // clear pencil marks for d in peers
    const pencil = state.pencil.slice();
    pencil[selected] = 0;
    for (let i = 0; i < 81; i++) {
      if (ROW(i) === ROW(selected) || COL(i) === COL(selected) || BOX(i) === BOX(selected)) {
        pencil[i] &= ~(1 << (d - 1));
      }
    }
    const mistake = puzzle.solution[selected] !== d;
    if (mistake) haptics.error();
    apply({ values, pencil }, { mistake });
  };

  const erase = () => {
    if (selected === null || completed || puzzle.givens[selected] !== 0) return;
    if (state.values[selected] === 0 && state.pencil[selected] === 0) return;
    const values = state.values.slice();
    const pencil = state.pencil.slice();
    values[selected] = 0;
    pencil[selected] = 0;
    apply({ values, pencil });
  };

  const hint = () => {
    if (completed) return;
    const h = sudokuHint(puzzle, state.values);
    if (!h || !consumeHint()) return;
    const values = state.values.slice();
    values[h.cell] = h.value;
    const pencil = state.pencil.slice();
    pencil[h.cell] = 0;
    setSelected(h.cell);
    apply({ values, pencil }, { hint: true });
  };

  // keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') setDigit(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete') erase();
      else if (e.key === 'p' || e.key === 'P') setPencilMode((m) => !m);
      else if (e.key.startsWith('Arrow') && selected !== null) {
        e.preventDefault();
        const delta =
          e.key === 'ArrowUp' ? -9 : e.key === 'ArrowDown' ? 9 : e.key === 'ArrowLeft' ? -1 : 1;
        const next = selected + delta;
        if (next >= 0 && next < 81) setSelected(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const digitCounts = useMemo(() => {
    const counts = new Array(10).fill(0);
    state.values.forEach((v, i) => {
      if (v !== 0 && v === puzzle.solution[i]) counts[v]++;
    });
    return counts;
  }, [state.values, puzzle.solution]);

  const sel = selected;
  const selVal = sel !== null ? state.values[sel] : 0;

  const cellSize = 40;
  const cells = [];
  for (let i = 0; i < 81; i++) {
    const x = COL(i) * cellSize;
    const y = ROW(i) * cellSize;
    const v = state.values[i];
    const given = puzzle.givens[i] !== 0;
    const wrong = errorCheck && v !== 0 && v !== puzzle.solution[i];
    const isSel = sel === i;
    const peer =
      sel !== null && !isSel && (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel));
    const same = !isSel && v !== 0 && selVal !== 0 && v === selVal;

    let fill = 'transparent';
    if (isSel) fill = 'var(--accent-soft)';
    else if (same) fill = 'var(--accent-soft)';
    else if (peer) fill = 'var(--hairline)';

    cells.push(
      <g key={i} onClick={() => setSelected(i)} data-testid={`cell-${i}`} style={{ cursor: 'pointer' }}>
        <rect
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          fill={fill}
          className={completed ? 'cell-win' : undefined}
          style={completed ? { animation: `cell-wave 700ms ease ${(ROW(i) + COL(i)) * 28}ms` } : undefined}
        />
        {v !== 0 ? (
          <text
            x={x + cellSize / 2}
            y={y + cellSize / 2 + 8}
            textAnchor="middle"
            fontSize="23"
            fontWeight={given ? 700 : 500}
            fill={wrong ? 'var(--bad)' : given ? 'var(--ink)' : 'var(--accent)'}
          >
            {v}
          </text>
        ) : (
          state.pencil[i] !== 0 && (
            <g>
              {Array.from({ length: 9 }, (_, d) =>
                state.pencil[i] & (1 << d) ? (
                  <text
                    key={d}
                    x={x + 7 + (d % 3) * 13}
                    y={y + 12 + Math.floor(d / 3) * 12.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={600}
                    fill="var(--ink-faint)"
                  >
                    {d + 1}
                  </text>
                ) : null,
              )}
            </g>
          )
        )}
      </g>,
    );
  }

  const lines = [];
  for (let k = 0; k <= 9; k++) {
    const strong = k % 3 === 0;
    lines.push(
      <line key={`h${k}`} x1={0} y1={k * cellSize} x2={360} y2={k * cellSize}
        stroke={strong ? 'var(--hairline-strong)' : 'var(--hairline)'} strokeWidth={strong ? 2 : 1} />,
      <line key={`v${k}`} x1={k * cellSize} y1={0} x2={k * cellSize} y2={360}
        stroke={strong ? 'var(--hairline-strong)' : 'var(--hairline)'} strokeWidth={strong ? 2 : 1} />,
    );
  }

  return (
    <>
      <PuzzleHeader type="sudoku" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <svg className="board-svg" viewBox="-2 -2 364 364" data-testid="sudoku-grid">
          {cells}
          {lines}
        </svg>
      </div>

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
        <button className={`tool ${pencilMode ? 'active' : ''}`} onClick={() => setPencilMode((m) => !m)} data-testid="pencil" aria-pressed={pencilMode} aria-label="Pencil marks">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 18l1-4L15.5 3.5a2.1 2.1 0 0 1 3 3L8 17l-4 1z" />
          </svg>
          <span className="tool-label">Pencil</span>
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
          const left = 9 - digitCounts[d];
          return (
            <button key={d} className="key" onClick={() => setDigit(d)} disabled={left === 0 || completed} data-testid={`key-${d}`}>
              {d}
              <span className="key-count">{left}</span>
            </button>
          );
        })}
      </div>

      {completed && (
        <WinOverlay
          type="sudoku"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
