import type { PuzzleType, Difficulty } from '@daily-logic/engine';
import { PuzzleHeader } from '../components/PuzzleChrome';

/** Temporary placeholder while boards land phase by phase. */
export default function ComingSoon({ type, difficulty }: { type: PuzzleType; difficulty: Difficulty }) {
  return (
    <>
      <PuzzleHeader type={type} elapsedMs={0} difficulty={difficulty} />
      <div className="board-wrap" style={{ minHeight: 320, alignItems: 'center' }}>
        <p style={{ color: 'var(--ink-soft)' }}>This board is under construction.</p>
      </div>
    </>
  );
}
