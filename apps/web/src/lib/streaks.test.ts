import { describe, it, expect } from 'vitest';
import { typeStreak, anyStreak, allStreak, typeStats } from './streaks';
import type { CompletionLog } from '../state/progress';

const c = { timeMs: 100_000, mistakes: 0, hintsUsed: 0, completedAt: 0 };

function logOf(entries: string[]): CompletionLog {
  return Object.fromEntries(entries.map((k) => [k, c]));
}

describe('streak math', () => {
  it('counts consecutive days ending today', () => {
    const log = logOf(['2026-06-10.sudoku', '2026-06-11.sudoku', '2026-06-12.sudoku']);
    expect(typeStreak(log, 'sudoku', '2026-06-12')).toBe(3);
  });

  it('keeps streak alive if today is not played yet', () => {
    const log = logOf(['2026-06-10.sudoku', '2026-06-11.sudoku']);
    expect(typeStreak(log, 'sudoku', '2026-06-12')).toBe(2);
  });

  it('breaks on a gap', () => {
    const log = logOf(['2026-06-09.sudoku', '2026-06-11.sudoku', '2026-06-12.sudoku']);
    expect(typeStreak(log, 'sudoku', '2026-06-12')).toBe(2);
  });

  it('handles month boundaries', () => {
    const log = logOf(['2026-05-31.kakuro', '2026-06-01.kakuro']);
    expect(typeStreak(log, 'kakuro', '2026-06-01')).toBe(2);
  });

  it('anyStreak counts days with ≥1 type, allStreak needs all five', () => {
    const all = ['sudoku', 'killer', 'nonogram', 'kakuro', 'binairo'];
    const log = logOf([
      ...all.map((t) => `2026-06-11.${t}`),
      '2026-06-12.sudoku',
    ]);
    expect(anyStreak(log, '2026-06-12')).toBe(2);
    expect(allStreak(log, '2026-06-12')).toBe(1);
  });

  it('zero when nothing played', () => {
    expect(typeStreak({}, 'sudoku', '2026-06-12')).toBe(0);
    expect(anyStreak({}, '2026-06-12')).toBe(0);
  });

  it('typeStats aggregates best/avg/played', () => {
    const log: CompletionLog = {
      '2026-06-11.sudoku': { ...c, timeMs: 120_000 },
      '2026-06-12.sudoku': { ...c, timeMs: 60_000 },
      '2026-06-12.kakuro': { ...c, timeMs: 30_000 },
    };
    const s = typeStats(log, 'sudoku', '2026-06-12');
    expect(s.played).toBe(2);
    expect(s.bestMs).toBe(60_000);
    expect(s.avgMs).toBe(90_000);
    expect(s.streak).toBe(2);
  });
});
