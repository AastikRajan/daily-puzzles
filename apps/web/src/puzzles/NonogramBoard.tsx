import { useMemo, useRef, useState } from 'react';
import {
  generateDaily,
  nonogramHint,
  cluesForLine,
  type NonogramPuzzle,
  type Difficulty,
} from '@daily-logic/engine';
import { usePuzzleSession } from '../state/session';
import { useSettings } from '../state/settings';
import { useProgress } from '../state/progress';
import { PuzzleHeader, HintButton, Toolbar } from '../components/PuzzleChrome';
import WinOverlay from '../components/WinOverlay';
import * as haptics from '../lib/haptics';

interface NonogramState {
  /** -1 unknown, 0 marked empty (X), 1 filled */
  cells: number[];
}

type PaintTool = 'fill' | 'mark';

export default function NonogramBoard({ date, difficulty }: { date: string; difficulty: Difficulty }) {
  const puzzle = useMemo(() => generateDaily(date, 'nonogram') as NonogramPuzzle, [date]);
  const errorCheck = useSettings((s) => s.errorCheck);
  const setSettings = useSettings((s) => s.set);
  const consumeHint = useProgress((s) => s.consumeHint);
  const { width, height } = puzzle;

  const session = usePuzzleSession<NonogramState>({
    date,
    type: 'nonogram',
    initial: () => ({ cells: new Array(width * height).fill(-1) }),
    isSolved: (s) => s.cells.every((v, i) => (v === 1) === (puzzle.solution[i] === 1)),
  });

  const [tool, setTool] = useState<PaintTool>('fill');
  const { state, apply, completed } = session;

  // drag painting: one stroke = one undo entry; we batch into a ref and
  // commit on pointer up
  const svgRef = useRef<SVGSVGElement>(null);
  const stroke = useRef<{ paint: number; cells: Map<number, number> } | null>(null);
  const [preview, setPreview] = useState<Map<number, number> | null>(null);

  // layout: clue gutters sized by the longest clue list
  const maxRowClue = Math.max(...puzzle.rowClues.map((c) => c.length));
  const maxColClue = Math.max(...puzzle.colClues.map((c) => c.length));
  const clueW = Math.max(34, maxRowClue * 13 + 8);
  const clueH = Math.max(34, maxColClue * 13 + 8);
  const gridW = 360 - clueW;
  const cellSize = gridW / width;
  const gridH = cellSize * height;
  const totalW = clueW + gridW;
  const totalH = clueH + gridH;

  const cellAt = (clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * (totalW + 4) - 2;
    const sy = ((clientY - rect.top) / rect.height) * (totalH + 4) - 2;
    const c = Math.floor((sx - clueW) / cellSize);
    const r = Math.floor((sy - clueH) / cellSize);
    if (c < 0 || r < 0 || c >= width || r >= height) return null;
    return r * width + c;
  };

  const strokeValueFor = (start: number): number => {
    const cur = state.cells[start];
    if (tool === 'fill') return cur === 1 ? -1 : 1;
    return cur === 0 ? -1 : 0;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (completed) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const paint = strokeValueFor(cell);
    const cells = new Map<number, number>([[cell, paint]]);
    stroke.current = { paint, cells };
    setPreview(new Map(cells));
    haptics.tap();
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!stroke.current || completed) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell === null || stroke.current.cells.has(cell)) return;
    // only paint over cells that the stroke's action makes sense for
    const cur = state.cells[cell];
    const { paint } = stroke.current;
    if (paint === -1) {
      // erasing: only erase the tool's own kind
      if (tool === 'fill' ? cur !== 1 : cur !== 0) return;
    } else if (cur !== -1) {
      return; // don't overwrite other state while dragging
    }
    stroke.current.cells.set(cell, paint);
    setPreview(new Map(stroke.current.cells));
  };

  const onPointerUp = () => {
    if (!stroke.current || completed) {
      stroke.current = null;
      setPreview(null);
      return;
    }
    const { cells: painted } = stroke.current;
    const cells = state.cells.slice();
    let mistakes = 0;
    for (const [i, v] of painted) {
      cells[i] = v;
      if (v === 1 && puzzle.solution[i] !== 1) mistakes++;
    }
    if (mistakes > 0) haptics.error();
    stroke.current = null;
    setPreview(null);
    apply({ cells }, { mistake: mistakes > 0 });
  };

  const hint = () => {
    if (completed) return;
    const h = nonogramHint(puzzle, state.cells);
    if (!h || !consumeHint()) return;
    const cells = state.cells.slice();
    cells[h.cell] = h.value;
    apply({ cells }, { hint: true });
  };

  const effective = (i: number): number => {
    if (preview?.has(i)) return preview.get(i)!;
    return state.cells[i];
  };

  // line satisfaction for clue strike-out
  const rowDone = Array.from({ length: height }, (_, r) => {
    const line: number[] = [];
    for (let c = 0; c < width; c++) line.push(effective(r * width + c) === 1 ? 1 : 0);
    return JSON.stringify(cluesForLine(line)) === JSON.stringify(puzzle.rowClues[r]);
  });
  const colDone = Array.from({ length: width }, (_, c) => {
    const line: number[] = [];
    for (let r = 0; r < height; r++) line.push(effective(r * width + c) === 1 ? 1 : 0);
    return JSON.stringify(cluesForLine(line)) === JSON.stringify(puzzle.colClues[c]);
  });

  const cells = [];
  for (let i = 0; i < width * height; i++) {
    const r = Math.floor(i / width);
    const c = i % width;
    const x = clueW + c * cellSize;
    const y = clueH + r * cellSize;
    const v = effective(i);
    const wrongFill = errorCheck && v === 1 && puzzle.solution[i] !== 1;

    cells.push(
      <g key={i} data-testid={`cell-${i}`}>
        <rect
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          fill={
            v === 1
              ? wrongFill
                ? 'var(--bad)'
                : 'var(--accent)'
              : (Math.floor(c / 5) + Math.floor(r / 5)) % 2 === 1
                ? 'var(--accent-soft)'
                : 'var(--surface-solid)'
          }
          style={completed ? { animation: `cell-wave 700ms ease ${(r + c) * 22}ms` } : undefined}
        />
        {v === 0 && (
          <path
            d={`M${x + cellSize * 0.3} ${y + cellSize * 0.3}L${x + cellSize * 0.7} ${y + cellSize * 0.7}M${x + cellSize * 0.7} ${y + cellSize * 0.3}L${x + cellSize * 0.3} ${y + cellSize * 0.7}`}
            stroke="var(--ink-faint)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        )}
      </g>,
    );
  }

  const gridLines = [];
  for (let k = 0; k <= width; k++) {
    const strong = k % 5 === 0;
    gridLines.push(
      <line key={`v${k}`} x1={clueW + k * cellSize} y1={clueH} x2={clueW + k * cellSize} y2={clueH + gridH}
        stroke={strong ? 'var(--line-strong)' : 'var(--line)'} strokeWidth={strong ? 2 : 1} />,
    );
  }
  for (let k = 0; k <= height; k++) {
    const strong = k % 5 === 0;
    gridLines.push(
      <line key={`h${k}`} x1={clueW} y1={clueH + k * cellSize} x2={clueW + gridW} y2={clueH + k * cellSize}
        stroke={strong ? 'var(--line-strong)' : 'var(--line)'} strokeWidth={strong ? 2 : 1} />,
    );
  }

  const clueFont = Math.min(12, cellSize * 0.52);
  const rowClueTexts = puzzle.rowClues.map((clue, r) => (
    <text
      key={`r${r}`}
      x={clueW - 6}
      y={clueH + r * cellSize + cellSize / 2 + clueFont * 0.36}
      textAnchor="end"
      fontSize={clueFont}
      fontWeight={800}
      fill={rowDone[r] ? 'var(--ink-faint)' : 'var(--ink)'}
      style={rowDone[r] ? { textDecoration: 'line-through' } : undefined}
    >
      {clue.join(' ')}
    </text>
  ));
  const colClueTexts = puzzle.colClues.map((clue, c) => (
    <text key={`c${c}`} textAnchor="middle" fontSize={clueFont} fontWeight={800}
      fill={colDone[c] ? 'var(--ink-faint)' : 'var(--ink)'}>
      {clue.map((n, k) => (
        <tspan
          key={k}
          x={clueW + c * cellSize + cellSize / 2}
          y={clueH - 6 - (clue.length - 1 - k) * (clueFont + 1.5)}
        >
          {n}
        </tspan>
      ))}
    </text>
  ));

  return (
    <>
      <PuzzleHeader type="nonogram" elapsedMs={session.elapsedMs} difficulty={difficulty} />
      <div className="board-wrap">
        <div className="board-panel">
          <svg
            ref={svgRef}
            className="board-svg"
            viewBox={`-2 -2 ${totalW + 4} ${totalH + 4}`}
            data-testid="nonogram-grid"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none' }}
          >
            {cells}
            {gridLines}
            {rowClueTexts}
            {colClueTexts}
          </svg>
        </div>
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
        <button className={`tool ${tool === 'fill' ? 'active' : ''}`} onClick={() => setTool('fill')} data-testid="tool-fill" aria-pressed={tool === 'fill'} aria-label="Fill squares">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <rect x="4" y="4" width="14" height="14" rx="3.5" fill="currentColor" />
          </svg>
          <span className="tool-label">Fill</span>
        </button>
        <button className={`tool ${tool === 'mark' ? 'active' : ''}`} onClick={() => setTool('mark')} data-testid="tool-mark" aria-pressed={tool === 'mark'} aria-label="Mark empty">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6.5 6.5l9 9M15.5 6.5l-9 9" />
          </svg>
          <span className="tool-label">Mark</span>
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
          type="nonogram"
          elapsedMs={session.elapsedMs}
          mistakes={session.mistakes}
          hintsUsed={session.hintsUsed}
        />
      )}
    </>
  );
}
