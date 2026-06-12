import { Suspense, lazy } from 'react';
import { useUi } from '../state/ui';
import { TYPE_META } from '../lib/meta';
import { difficultyForDate } from '@daily-logic/engine';
import './puzzle.css';

const boards = {
  queens: lazy(() => import('../puzzles/QueensBoard')),
  tango: lazy(() => import('../puzzles/TangoBoard')),
  zip: lazy(() => import('../puzzles/ZipBoard')),
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
      style={
        {
          '--accent': meta.accent,
          '--accent-deep': meta.accentDeep,
          '--accent-soft': meta.accentSoft,
          '--accent-grad': meta.grad,
        } as React.CSSProperties
      }
    >
      <Suspense fallback={<div className="board-loading" aria-label="Loading puzzle" />}>
        <Board date={date} difficulty={difficultyForDate(date)} />
      </Suspense>
    </div>
  );
}
