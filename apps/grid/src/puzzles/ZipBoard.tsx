/**
 * Zip board: drag to draw a Hamiltonian path through all cells, visiting
 * numbered checkpoints in order (1→2→3…→k).
 */
import { useMemo, useCallback, useRef, useState } from 'react';
import type { Difficulty } from '@daily-logic/engine';
import { generateZip, type ZipPuzzle } from '@daily-logic/grid-engine';
import { dailySeed } from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useProgress } from '../state/progress';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

interface ZipState {
  /** path as flat cell indices in order */
  path: number[];
}

const PATH_COLOR = '#22c55e';
const CP_COLOR = '#16a34a';

function isSolved(puzzle: ZipPuzzle, path: number[]): boolean {
  if (path.length !== puzzle.n * puzzle.n) return false;
  // Check all cells visited exactly once
  const visited = new Set(path);
  if (visited.size !== puzzle.n * puzzle.n) return false;
  // Check checkpoints visited in ascending order
  const cpSteps: [number, number][] = []; // [checkpoint_num, step]
  for (let step = 0; step < path.length; step++) {
    const cell = path[step];
    const cp = puzzle.checkpoints[cell];
    if (cp > 0) cpSteps.push([cp, step]);
  }
  cpSteps.sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < cpSteps.length; i++) {
    if (cpSteps[i][0] !== i + 1) return false;
  }
  return true;
}

export default function ZipBoard({
  date,
  difficulty,
}: {
  date: string;
  difficulty: Difficulty;
}) {
  const puzzle = useMemo<ZipPuzzle>(
    () => generateZip(dailySeed(date, 'zip' as never), difficulty),
    [date, difficulty],
  );

  const consumeHint = useProgress((s) => s.consumeHint);

  const session = usePuzzleSession<ZipState>({
    date,
    type: 'zip',
    initial: () => ({ path: [] }),
    isSolved: (s) => isSolved(puzzle, s.path),
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const { n } = puzzle;
  const CELL = Math.min(52, 340 / n);
  const SIZE = n * CELL;

  const cellFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const col = Math.floor((relX / rect.width) * n);
      const row = Math.floor((relY / rect.height) * n);
      if (col < 0 || col >= n || row < 0 || row >= n) return null;
      return row * n + col;
    },
    [n],
  );

  const isAdjacent = useCallback(
    (a: number, b: number) => {
      const ar = Math.floor(a / n), ac = a % n;
      const br = Math.floor(b / n), bc = b % n;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    },
    [n],
  );

  const startDrag = useCallback(
    (cell: number) => {
      if (session.completed) return;
      setDragging(true);
      haptics.tap();
      const path = session.state.path;
      // If tapping on last cell, extend; if tapping earlier in path, truncate to there
      const existingIdx = path.indexOf(cell);
      if (existingIdx !== -1) {
        // truncate
        session.apply({ path: path.slice(0, existingIdx + 1) });
      } else if (path.length === 0 || isAdjacent(path[path.length - 1], cell)) {
        session.apply({ path: [...path, cell] });
      } else {
        // start fresh from this cell
        session.apply({ path: [cell] });
      }
    },
    [session, isAdjacent],
  );

  const continueDrag = useCallback(
    (cell: number) => {
      if (!dragging || session.completed) return;
      const path = session.state.path;
      if (path.length === 0) return;
      const last = path[path.length - 1];
      if (cell === last) return;

      // Check if we're going back (truncate)
      const existingIdx = path.indexOf(cell);
      if (existingIdx !== -1) {
        session.apply({ path: path.slice(0, existingIdx + 1) });
        return;
      }

      // Extend if adjacent
      if (isAdjacent(last, cell)) {
        session.apply({ path: [...path, cell] });
      }
    },
    [dragging, session, isAdjacent],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
  }, []);

  const onHint = useCallback(() => {
    if (!consumeHint()) return;
    const { path } = session.state;
    const sol = puzzle.solution;
    let step = path.length;
    if (step >= sol.length) return;
    const nextCell = sol[step];
    session.apply({ path: [...path, nextCell] }, { hint: true });
  }, [puzzle, session, consumeHint]);

  const path = session.state.path;
  const pathSet = new Set(path);

  // Build polyline points from path
  const toCenter = (cell: number) => {
    const row = Math.floor(cell / n);
    const col = cell % n;
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  };

  const polylinePoints = path
    .map((cell) => {
      const { x, y } = toCenter(cell);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <>
      <PuzzleHeader type="zip" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg
            ref={svgRef}
            className="board-svg"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="grid"
            aria-label="Zip board"
            data-testid="zip-grid"
            onMouseDown={(e) => {
              const cell = cellFromPoint(e.clientX, e.clientY);
              if (cell !== null) startDrag(cell);
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              const cell = cellFromPoint(e.clientX, e.clientY);
              if (cell !== null) continueDrag(cell);
            }}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              const cell = cellFromPoint(t.clientX, t.clientY);
              if (cell !== null) startDrag(cell);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              const cell = cellFromPoint(t.clientX, t.clientY);
              if (cell !== null) continueDrag(cell);
            }}
            onTouchEnd={endDrag}
          >
            {/* Cell backgrounds */}
            {Array.from({ length: n * n }, (_, idx) => {
              const row = Math.floor(idx / n);
              const col = idx % n;
              const inPath = pathSet.has(idx);
              const isLast = path[path.length - 1] === idx;
              return (
                <rect
                  key={idx}
                  x={col * CELL + 1}
                  y={row * CELL + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx="6"
                  fill={
                    inPath
                      ? isLast
                        ? 'rgba(34,197,94,0.4)'
                        : 'rgba(34,197,94,0.22)'
                      : 'var(--surface)'
                  }
                  stroke={inPath ? PATH_COLOR : 'var(--surface-edge)'}
                  strokeWidth={inPath ? '2' : '1'}
                  style={{ pointerEvents: 'none' }}
                  data-testid={`cell-${row}-${col}`}
                />
              );
            })}

            {/* Path line */}
            {path.length >= 2 && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke={PATH_COLOR}
                strokeWidth={CELL * 0.28}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.45"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Checkpoints */}
            {Array.from({ length: n * n }, (_, idx) => {
              const cp = puzzle.checkpoints[idx];
              if (!cp) return null;
              const { x, y } = toCenter(idx);
              const visited = pathSet.has(idx);
              return (
                <g key={`cp-${idx}`} style={{ pointerEvents: 'none' }}>
                  <circle
                    cx={x}
                    cy={y}
                    r={CELL * 0.34}
                    fill={visited ? CP_COLOR : 'var(--surface)'}
                    stroke={CP_COLOR}
                    strokeWidth="2.5"
                  />
                  <text
                    x={x}
                    y={y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={CELL * 0.38}
                    fontWeight="800"
                    fill={visited ? '#fff' : CP_COLOR}
                    style={{ userSelect: 'none' }}
                  >
                    {cp}
                  </text>
                </g>
              );
            })}

            {/* Current path head indicator */}
            {path.length > 0 && !session.completed && (
              <circle
                cx={toCenter(path[path.length - 1]).x}
                cy={toCenter(path[path.length - 1]).y}
                r={CELL * 0.18}
                fill={PATH_COLOR}
                style={{ pointerEvents: 'none' }}
              />
            )}
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
          onClick={() => session.apply({ path: [] })}
          disabled={path.length === 0}
          aria-label="Clear path"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 17L11 11M11 11L17 5M11 11L5 5M11 11L17 17" />
          </svg>
          <span className="tool-label">Clear</span>
        </button>
        <HintButton onHint={onHint} disabled={session.completed} />
      </Toolbar>
      {session.completed && (
        <WinOverlay
          type="zip"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}

