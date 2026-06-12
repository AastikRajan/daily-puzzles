import { useMemo, useState } from 'react';
import {
  generateDaily,
  binairoHint,
  type BinairoPuzzle,
  type Difficulty,
} from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useSettings } from '../state/settings';
import { useProgress } from '../state/progress';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

interface BinairoState {
  cells: number[]; // -1 empty, 0, 1
}

export default function BinairoBoard({ date, difficulty }: { date: string; difficulty: Difficulty }) {
  const puzzle = useMemo(() => generateDaily(date, 'binairo') as BinairoPuzzle, [date]);
  const errorCheck = useSettings((s) => s.errorCheck);
  const setSettings = useSettings((s) => s.set);
  const consumeHint = useProgress((s) => s.consumeHint);
  const size = puzzle.size;

  const session = usePuzzleSession<BinairoState>({
    date,
    type: 'binairo',
    initial: () => ({ cells: puzzle.givens.slice() }),
    isSolved: (s) => s.cells.every((v, i) => v === puzzle.solution[i]),
  });

  const [lastTapped, setLastTapped] = useState<number | null>(null);
  const { state, apply, completed } = session;

  const cycle = (i: number) => {
    if (completed || puzzle.givens[i] !== -1) return;
    haptics.tap();
    setLastTapped(i);
    const cells = state.cells.slice();
    cells[i] = cells[i] === -1 ? 0 : cells[i] === 0 ? 1 : -1;
    const mistake = cells[i] !== -1 && cells[i] !== puzzle.solution[i];
    if (mistake) haptics.error();
    apply({ cells }, { mistake });
  };

  const hint = () => {
    if (completed) return;
    const h = binairoHint(puzzle, state.cells);
    if (!h || !consumeHint()) return;
    const cells = state.cells.slice();
    cells[h.cell] = h.value;
    setLastTapped(h.cell);
    apply({ cells }, { hint: true });
  };

  const cellSize = 360 / size;
  const pad = cellSize * 0.14;

  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const x = c * cellSize;
    const y = r * cellSize;
    const v = state.cells[i];
    const given = puzzle.givens[i] !== -1;
    const wrong = errorCheck && v !== -1 && v !== puzzle.solution[i];

    cells.push(
      <g key={i} onClick={() => cycle(i)} data-testid={`cell-${i}`} style={{ cursor: given ? 'default' : 'pointer' }}>
        <rect
          x={x + 2}
          y={y + 2}
          width={cellSize - 4}
          height={cellSize - 4}
          rx={cellSize * 0.22}
          fill={given ? 'var(--line)' : 'var(--surface-solid)'}
          stroke={wrong ? 'var(--bad)' : 'var(--line)'}
          strokeWidth={wrong ? 2.5 : 1}
          style={completed ? { animation: `cell-wave 700ms ease ${(r + c) * 34}ms` } : undefined}
        />
        {v === 0 && (
          <circle
            cx={x + cellSize / 2}
            cy={y + cellSize / 2}
            r={cellSize / 2 - pad - 2}
            fill="none"
            stroke={wrong ? 'var(--bad)' : 'var(--c-sudoku)'}
            strokeWidth={cellSize * 0.14}
            style={lastTapped === i && !completed ? { animation: 'pop-in 160ms cubic-bezier(0.2,0.9,0.3,1.4)' } : undefined}
          />
        )}
        {v === 1 && (
          <circle
            cx={x + cellSize / 2}
            cy={y + cellSize / 2}
            r={cellSize / 2 - pad}
            fill={wrong ? 'var(--bad)' : 'var(--accent)'}
            style={lastTapped === i && !completed ? { animation: 'pop-in 160ms cubic-bezier(0.2,0.9,0.3,1.4)' } : undefined}
          />
        )}
      </g>,
    );
  }

  // row/col balance indicators: count discs of each kind
  const rowFull = Array.from({ length: size }, (_, r) => {
    let n = 0;
    for (let c = 0; c < size; c++) if (state.cells[r * size + c] !== -1) n++;
    return n === size;
  });

  return (
    <>
      <PuzzleHeader type="binairo" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg className="board-svg" viewBox="-2 -2 364 364" data-testid="binairo-grid">
            {cells}
            {rowFull.map((full, r) =>
              full ? (
                <circle key={r} cx={-0.5} cy={r * cellSize + cellSize / 2} r={1.8} fill="var(--good)" />
              ) : null,
            )}
          </svg>
        </div>
      </div>

      <p className="board-hint-text">
        Tap to cycle <strong style={{ color: 'var(--c-sudoku)' }}>○</strong> /{' '}
        <strong style={{ color: 'var(--accent)' }}>●</strong> — balance each row, no three alike.
      </p>

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

      {completed && (
        <WinOverlay
          type="binairo"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
