import type { Difficulty } from '@daily-logic/engine';
import ComingSoon from './ComingSoon';

export default function KakuroBoard({ difficulty }: { date: string; difficulty: Difficulty }) {
  return <ComingSoon type="kakuro" difficulty={difficulty} />;
}
