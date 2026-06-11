import type { Difficulty } from '@daily-logic/engine';
import ComingSoon from './ComingSoon';

export default function KillerBoard({ difficulty }: { date: string; difficulty: Difficulty }) {
  return <ComingSoon type="killer" difficulty={difficulty} />;
}
