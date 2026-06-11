import { Suspense, lazy } from 'react';
import { useUi } from '../state/ui';
import { TYPE_META } from '../lib/meta';
import { difficultyForDate } from '@daily-logic/engine';
import './puzzle.css';

const boards = {
  sudoku: lazy(() => import('../puzzles/SudokuBoard')),
  killer: lazy(() => import('../puzzles/KillerBoard')),
  nonogram: lazy(() => import('../puzzles/NonogramBoard')),
  kakuro: lazy(() => import('../puzzles/KakuroBoard')),
  binairo: lazy(() => import('../puzzles/BinairoBoard')),
};

export default function PuzzleView() {
  const type = useUi((s) => s.puzzleType);
  const date = useUi((s) => s.date);
  if (!type) return null;
  const meta = TYPE_META[type];
  const Board = boards[type];

  return (
    <div
      className="view puzzle-view"
      style={{ '--accent': meta.accent, '--accent-soft': meta.accentSoft } as React.CSSProperties}
    >
      <Suspense fallback={<div className="board-loading" aria-label="Loading puzzle" />}>
        <Board date={date} difficulty={difficultyForDate(date)} />
      </Suspense>
    </div>
  );
}
