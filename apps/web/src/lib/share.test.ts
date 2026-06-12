import { describe, it, expect } from 'vitest';
import { buildPuzzleShare, buildDailyShare, performanceRow } from './share';
import type { CompletionLog } from '../state/progress';

const clean = { timeMs: 222_000, mistakes: 0, hintsUsed: 0, completedAt: 0 };

describe('share formatting', () => {
  it('flawless run keeps all type-colored squares', () => {
    expect(performanceRow('sudoku', clean)).toBe('🟦🟦🟦🟦🟦');
    const text = buildPuzzleShare('sudoku', '2026-06-12', clean, 5);
    expect(text).toContain('Daily Logic · Sudoku · Jun 12');
    expect(text).toContain('⏱️ 3:42 · 🔥 5');
    expect(text).toContain('🟦🟦🟦🟦🟦 flawless');
  });

  it('mistakes burn squares left→right, hints right→left', () => {
    expect(performanceRow('nonogram', { ...clean, mistakes: 2, hintsUsed: 1 })).toBe('🟥🟥🟩🟩⬜');
    expect(performanceRow('kakuro', { ...clean, mistakes: 7 })).toBe('🟥🟥🟥🟥🟥');
  });

  it('no streak line for streak ≤ 1', () => {
    const text = buildPuzzleShare('binairo', '2026-06-12', clean, 1);
    expect(text).not.toContain('🔥');
  });

  it('never leaks grid contents', () => {
    const text = buildPuzzleShare('sudoku', '2026-06-12', { ...clean, mistakes: 1 }, 2);
    expect(text).not.toMatch(/[1-9]{5,}/); // no digit runs that could be a grid row
  });

  it('daily card shows done squares and total time', () => {
    const log: CompletionLog = {
      '2026-06-12.sudoku': clean,
      '2026-06-12.kakuro': { ...clean, timeMs: 60_000 },
    };
    const text = buildDailyShare('2026-06-12', log, 1);
    expect(text).toContain('🟦⬛⬛🟨🟪'.slice(0, 2)); // sudoku done, killer not
    expect(text).toContain('2/5');
    expect(text).toContain('⏱️ 4:42 total');
  });

  it('full day with streak', () => {
    const log: CompletionLog = Object.fromEntries(
      ['sudoku', 'killer', 'nonogram', 'kakuro', 'binairo'].map((t) => [`2026-06-12.${t}`, clean]),
    );
    const text = buildDailyShare('2026-06-12', log, 3);
    expect(text).toContain('🟦🟧🟩🟨🟪 5/5');
    expect(text).toContain('🔥 3 perfect days');
  });
});
