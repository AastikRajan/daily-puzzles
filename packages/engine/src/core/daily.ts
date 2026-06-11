import type { Difficulty, PuzzleType } from './types';

/** YYYY-MM-DD in UTC — the global puzzle identity. */
export function utcDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pure: same date string → same seed forever. */
export function dailySeed(date: string, type: PuzzleType): string {
  return `daily-logic:${date}:${type}`;
}

/**
 * Weekly rhythm: Mon–Tue easy, Wed–Fri medium, Sat–Sun hard.
 * Date-only parse in UTC keeps this identical worldwide.
 */
export function difficultyForDate(date: string): Difficulty {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun
  if (dow === 1 || dow === 2) return 'easy';
  if (dow >= 3 && dow <= 5) return 'medium';
  return 'hard'; // Sat(6) + Sun(0)
}

/** Milliseconds until next UTC midnight (when new puzzles drop). */
export function msUntilNextPuzzle(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return next - now.getTime();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateString(d);
}
