/**
 * Queens board: tap to cycle empty → X → queen per cell.
 * One queen per row, column, region; no two queens adjacent (incl. diagonal).
 */
import { useMemo, useCallback } from 'react';
import type { Difficulty } from '@daily-logic/engine';
import { generateQueens, type QueensPuzzle } from '@daily-logic/grid-engine';
import { dailySeed } from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useProgress } from '../state/progress';
import { useSettings } from '../state/settings';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

type CellState = 'empty' | 'x' | 'queen';

interface QueensState {
  cells: CellState[];
}

// region hues must stay distinguishable after softening, so the soft fills
// use high alpha and the palette avoids adjacent-hue neighbors
const REGION_COLORS = [
  '#7c3aed', '#f59e0b', '#16a34a', '#dc2626', '#2563eb',
  '#db2777', '#0d9488', '#854d0e', '#64748b', '#ca8a04',
];

const REGION_COLORS_SOFT = [
  'rgba(124,58,237,0.42)', 'rgba(245,158,11,0.50)', 'rgba(22,163,74,0.42)',
  'rgba(220,38,38,0.40)', 'rgba(37,99,235,0.40)', 'rgba(219,39,119,0.38)',
  'rgba(13,148,136,0.45)', 'rgba(133,77,14,0.42)', 'rgba(100,116,139,0.42)',
  'rgba(202,138,4,0.55)',
];

function isSolved(puzzle: QueensPuzzle, cells: CellState[]): boolean {
  for (let row = 0; row < puzzle.n; row++) {
    const col = puzzle.solution[row];
    if (cells[row * puzzle.n + col] !== 'queen') return false;
  }
  return true;
}

function hasConflict(cells: CellState[], n: number, idx: number): boolean {
  const row = Math.floor(idx / n);
  const col = idx % n;
  if (cells[idx] !== 'queen') return false;

  for (let c = 0; c < n; c++) {
    if (c !== col && cells[row * n + c] === 'queen') return true;
  }
  for (let r = 0; r < n; r++) {
    if (r !== row && cells[r * n + col] === 'queen') return true;
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r !== row && c !== col && Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) {
        if (cells[r * n + c] === 'queen') return true;
      }
    }
  }
  return false;
}

function hasRegionConflict(cells: CellState[], n: number, regions: number[], idx: number): boolean {
  if (cells[idx] !== 'queen') return false;
  const reg = regions[idx];
  for (let i = 0; i < n * n; i++) {
    if (i !== idx && regions[i] === reg && cells[i] === 'queen') return true;
  }
  return false;
}

export default function QueensBoard({
  date,
  difficulty,
}: {
  date: string;
  difficulty: Difficulty;
}) {
  const puzzle = useMemo<QueensPuzzle>(
    () => generateQueens(dailySeed(date, 'queens' as never), difficulty),
    [date, difficulty],
  );

  const consumeHint = useProgress((s) => s.consumeHint);
  const errorCheck = useSettings((s) => s.errorCheck);

  const session = usePuzzleSession<QueensState>({
    date,
    type: 'queens',
    initial: () => ({ cells: new Array(puzzle.n * puzzle.n).fill('empty') }),
    isSolved: (s) => isSolved(puzzle, s.cells),
  });

  const onTap = useCallback(
    (idx: number) => {
      if (session.completed) return;
      haptics.tap();
      const newCells = [...session.state.cells];
      const cur = newCells[idx];
      newCells[idx] = cur === 'empty' ? 'x' : cur === 'x' ? 'queen' : 'empty';
      session.apply({ cells: newCells });
    },
    [session],
  );

  const onHint = useCallback(() => {
    if (!consumeHint()) return;
    const newCells = [...session.state.cells];
    for (let row = 0; row < puzzle.n; row++) {
      const col = puzzle.solution[row];
      const idx = row * puzzle.n + col;
      if (newCells[idx] !== 'queen') {
        newCells[idx] = 'queen';
        session.apply({ cells: newCells }, { hint: true });
        return;
      }
    }
  }, [puzzle, session, consumeHint]);

  const { n, regions } = puzzle;
  const cells = session.state.cells;
  const CELL = 46;
  const SIZE = n * CELL;

  return (
    <>
      <PuzzleHeader type="queens" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg
            className="board-svg"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="grid"
            aria-label="Queens board"
            data-testid="queens-grid"
          >
            {Array.from({ length: n * n }, (_, idx) => {
              const row = Math.floor(idx / n);
              const col = idx % n;
              const reg = regions[idx];
              const cell = cells[idx];
              const conflict = errorCheck && (hasConflict(cells, n, idx) || hasRegionConflict(cells, n, regions, idx));
              return (
                <g key={idx}>
                  <rect
                    x={col * CELL + 1}
                    y={row * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx="6"
                    fill={conflict ? 'rgba(239,68,68,0.22)' : REGION_COLORS_SOFT[reg % REGION_COLORS_SOFT.length]}
                    stroke={REGION_COLORS[reg % REGION_COLORS.length]}
                    strokeWidth="1.5"
                    onClick={() => onTap(idx)}
                    style={{ cursor: 'pointer' }}
                    data-testid={`cell-${row}-${col}`}
                  />
                  {cell === 'x' && (
                    <text
                      x={col * CELL + CELL / 2}
                      y={row * CELL + CELL / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="18"
                      fill={conflict ? '#ef4444' : 'var(--ink-soft)'}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      ✕
                    </text>
                  )}
                  {cell === 'queen' && (
                    <text
                      x={col * CELL + CELL / 2}
                      y={row * CELL + CELL / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="24"
                      fill={conflict ? '#ef4444' : REGION_COLORS[reg % REGION_COLORS.length]}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      👑
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <Toolbar>
        <button
          className="tool"
          onClick={() => session.undo()}
          disabled={!session.canUndo}
          aria-label="Undo"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 8h10a4 4 0 0 1 0 8H9" />
            <path d="M7 5l-3 3 3 3" />
          </svg>
          <span className="tool-label">Undo</span>
        </button>
        <button
          className="tool"
          onClick={() => session.redo()}
          disabled={!session.canRedo}
          aria-label="Redo"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8H8a4 4 0 0 0 0 8h5" />
            <path d="M15 5l3 3-3 3" />
          </svg>
          <span className="tool-label">Redo</span>
        </button>
        <HintButton onHint={onHint} disabled={session.completed} />
      </Toolbar>
      {session.completed && (
        <WinOverlay
          type="queens"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
