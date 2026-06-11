import type { Difficulty } from '@daily-logic/engine';
import ComingSoon from './ComingSoon';

export default function NonogramBoard({ difficulty }: { date: string; difficulty: Difficulty }) {
  return <ComingSoon type="nonogram" difficulty={difficulty} />;
}
