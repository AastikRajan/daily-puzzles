import type { Difficulty } from '@daily-logic/engine';
import ComingSoon from './ComingSoon';

export default function BinairoBoard({ difficulty }: { date: string; difficulty: Difficulty }) {
  return <ComingSoon type="binairo" difficulty={difficulty} />;
}
