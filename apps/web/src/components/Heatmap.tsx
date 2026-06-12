import { addDays, utcDateString } from '@daily-logic/engine';
import type { CompletionLog } from '../state/progress';
import { TYPE_ORDER } from '../lib/meta';

const WEEKS = 12;

/** GitHub-style completion calendar: one column per week, intensity = puzzles done (0-5). */
export default function Heatmap({ log }: { log: CompletionLog }) {
  const today = utcDateString();
  // align last column to the current week (Mon-first rows)
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const start = addDays(today, -(WEEKS * 7 - 1) - (6 - dow));

  const cells = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      if (day > today) continue;
      const count = TYPE_ORDER.filter((t) => `${day}.${t}` in log).length;
      cells.push(
        <div
          key={day}
          className="heat-cell"
          style={{ gridColumn: w + 1, gridRow: d + 1, opacity: count === 0 ? undefined : 0.25 + count * 0.15 }}
          data-count={count}
          title={`${day}: ${count}/5`}
        />,
      );
    }
  }

  return (
    <div className="heatmap" aria-label="Completion calendar, last 12 weeks" data-testid="heatmap">
      {cells}
    </div>
  );
}
