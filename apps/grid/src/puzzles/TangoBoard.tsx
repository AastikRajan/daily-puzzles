/**
 * Tango board: 6×6 grid with ☀/☾ symbols.
 * Each row/col must have exactly 3 of each; no 3 identical adjacent (row or col).
 * '=' signs mean both cells must match; '×' signs mean both cells must differ.
 */
import { useMemo, useCallback } from 'react';
import type { Difficulty } from '@daily-logic/engine';
import { generateTango, type TangoPuzzle, type TangoSign } from '@daily-logic/grid-engine';
import { dailySeed } from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useProgress } from '../state/progress';
import { useSettings } from '../state/settings';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

type CellVal = 0 | 1 | 2; // 0=empty, 1=sun, 2=moon

interface TangoState {
  cells: CellVal[];
}

const SUN_COLOR = '#f59e0b';
const MOON_COLOR = '#818cf8';
const SUN_SOFT = 'rgba(245,158,11,0.15)';
const MOON_SOFT = 'rgba(129,140,248,0.15)';

function isSolved(puzzle: TangoPuzzle, cells: CellVal[]): boolean {
  // cells use 0=empty,1=sun,2=moon; solution uses 0=sun,1=moon
  for (let i = 0; i < 36; i++) {
    if (cells[i] === 0) return false; // empty cell
    const cellSol = cells[i] - 1; // convert to 0=sun,1=moon
    if (cellSol !== puzzle.solution[i]) return false;
  }
  return true;
}

function hasConflict(cells: CellVal[], n: number, idx: number): boolean {
  if (cells[idx] === 0) return false;
  const row = Math.floor(idx / n);
  const col = idx % n;
  const v = cells[idx];

  // check 3 in a row (row)
  for (let c = 0; c <= n - 3; c++) {
    if (
      cells[row * n + c] === v &&
      cells[row * n + c + 1] === v &&
      cells[row * n + c + 2] === v
    ) {
      if (col >= c && col <= c + 2) return true;
    }
  }
  // check 3 in a row (col)
  for (let r = 0; r <= n - 3; r++) {
    if (
      cells[r * n + col] === v &&
      cells[(r + 1) * n + col] === v &&
      cells[(r + 2) * n + col] === v
    ) {
      if (row >= r && row <= r + 2) return true;
    }
  }
  return false;
}

// Draw a constraint sign between two cells
function ConstraintSign({
  x, y, sign, cellSize,
}: {
  x: number; y: number; sign: '=' | 'x';
  cellSize: number;
}) {
  const hs = cellSize / 2;
  return (
    <g>
      <circle cx={x} cy={y} r={hs * 0.42} fill="var(--surface)" stroke="var(--surface-edge)" strokeWidth="1" />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={hs * 0.7}
        fontWeight="800"
        fill={sign === '=' ? '#22c55e' : '#ef4444'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {sign === '=' ? '=' : '×'}
      </text>
    </g>
  );
}

function signPosition(sign: TangoSign, n: number, cellSize: number): { x: number; y: number } {
  const rowA = Math.floor(sign.a / n);
  const colA = sign.a % n;
  const rowB = Math.floor(sign.b / n);
  const colB = sign.b % n;
  // midpoint between cell centers
  const cx = ((colA + colB) / 2 + 0.5) * cellSize;
  const cy = ((rowA + rowB) / 2 + 0.5) * cellSize;
  return { x: cx, y: cy };
}

export default function TangoBoard({
  date,
  difficulty,
}: {
  date: string;
  difficulty: Difficulty;
}) {
  const puzzle = useMemo<TangoPuzzle>(
    () => generateTango(dailySeed(date, 'tango' as never), difficulty),
    [date, difficulty],
  );

  const consumeHint = useProgress((s) => s.consumeHint);
  const errorCheck = useSettings((s) => s.errorCheck);

  const n = 6;

  const initCells = useCallback((): TangoState => {
    const cells = new Array<CellVal>(n * n).fill(0);
    for (let i = 0; i < n * n; i++) {
      // givens: -1=unknown, 0=sun, 1=moon
      // cells: 0=empty, 1=sun, 2=moon
      if (puzzle.givens[i] !== -1) cells[i] = (puzzle.givens[i] + 1) as CellVal;
    }
    return { cells };
  }, [puzzle]);

  const session = usePuzzleSession<TangoState>({
    date,
    type: 'tango',
    initial: initCells,
    isSolved: (s) => isSolved(puzzle, s.cells),
  });

  const isGiven = useCallback((idx: number) => puzzle.givens[idx] !== -1, [puzzle]);

  const onTap = useCallback(
    (idx: number) => {
      if (session.completed) return;
      if (isGiven(idx)) return;
      haptics.tap();
      const newCells = [...session.state.cells] as CellVal[];
      const cur = newCells[idx];
      newCells[idx] = cur === 0 ? 1 : cur === 1 ? 2 : 0;
      session.apply({ cells: newCells });
    },
    [session, isGiven],
  );

  const onHint = useCallback(() => {
    if (!consumeHint()) return;
    const newCells = [...session.state.cells] as CellVal[];
    for (let i = 0; i < n * n; i++) {
      const solCell = (puzzle.solution[i] + 1) as CellVal; // 0->1 sun, 1->2 moon
      if (!isGiven(i) && newCells[i] !== solCell) {
        newCells[i] = solCell;
        session.apply({ cells: newCells }, { hint: true });
        return;
      }
    }
  }, [puzzle, session, consumeHint, isGiven]);

  const cells = session.state.cells;
  const CELL = 52;
  const SIZE = n * CELL;

  return (
    <>
      <PuzzleHeader type="tango" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg
            className="board-svg"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="grid"
            aria-label="Tango board"
            data-testid="tango-grid"
          >
            {Array.from({ length: n * n }, (_, idx) => {
              const row = Math.floor(idx / n);
              const col = idx % n;
              const val = cells[idx];
              const given = isGiven(idx);
              const conflict = errorCheck && hasConflict(cells, n, idx);
              const bg =
                conflict
                  ? 'rgba(239,68,68,0.18)'
                  : val === 1
                    ? SUN_SOFT
                    : val === 2
                      ? MOON_SOFT
                      : 'var(--surface)';
              return (
                <g key={idx}>
                  <rect
                    x={col * CELL + 1}
                    y={row * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx="6"
                    fill={bg}
                    stroke={
                      given
                        ? (val === 1 ? SUN_COLOR : MOON_COLOR)
                        : 'var(--surface-edge)'
                    }
                    strokeWidth={given ? '2.5' : '1'}
                    onClick={() => onTap(idx)}
                    style={{ cursor: given ? 'default' : 'pointer' }}
                    data-testid={`cell-${row}-${col}`}
                  />
                  {val === 1 && (
                    <text
                      x={col * CELL + CELL / 2}
                      y={row * CELL + CELL / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="26"
                      fill={conflict ? '#ef4444' : SUN_COLOR}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      ☀
                    </text>
                  )}
                  {val === 2 && (
                    <text
                      x={col * CELL + CELL / 2}
                      y={row * CELL + CELL / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="26"
                      fill={conflict ? '#ef4444' : MOON_COLOR}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      ☾
                    </text>
                  )}
                </g>
              );
            })}

            {/* Constraint signs between adjacent cells */}
            {puzzle.signs.map((sign, idx) => {
              const pos = signPosition(sign, n, CELL);
              return (
                <ConstraintSign
                  key={`s-${idx}`}
                  x={pos.x}
                  y={pos.y}
                  sign={sign.type}
                  cellSize={CELL}
                />
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
          type="tango"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
