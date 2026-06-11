import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateDaily,
  dailySeed,
  difficultyForDate,
  utcDateString,
  msUntilNextPuzzle,
  addDays,
  PUZZLE_TYPES,
} from '../src/index';

describe('daily system', () => {
  it('dailySeed is pure and date-scoped', () => {
    expect(dailySeed('2026-06-11', 'sudoku')).toBe(dailySeed('2026-06-11', 'sudoku'));
    expect(dailySeed('2026-06-11', 'sudoku')).not.toBe(dailySeed('2026-06-12', 'sudoku'));
    expect(dailySeed('2026-06-11', 'sudoku')).not.toBe(dailySeed('2026-06-11', 'kakuro'));
  });

  it('difficulty follows the weekly rhythm', () => {
    expect(difficultyForDate('2026-06-08')).toBe('easy'); // Monday
    expect(difficultyForDate('2026-06-09')).toBe('easy'); // Tuesday
    expect(difficultyForDate('2026-06-10')).toBe('medium'); // Wednesday
    expect(difficultyForDate('2026-06-12')).toBe('medium'); // Friday
    expect(difficultyForDate('2026-06-13')).toBe('hard'); // Saturday
    expect(difficultyForDate('2026-06-14')).toBe('hard'); // Sunday
  });

  it('same date string → byte-identical puzzle for every type', () => {
    for (const type of PUZZLE_TYPES) {
      const a = generateDaily('2026-06-11', type);
      const b = generateDaily('2026-06-11', type);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('different dates → different puzzles', () => {
    const a = generateDaily('2026-06-10', 'sudoku');
    const b = generateDaily('2026-06-11', 'sudoku');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('utc date helpers behave', () => {
    expect(utcDateString(new Date(Date.UTC(2026, 5, 11, 23, 59)))).toBe('2026-06-11');
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31');
    const ms = msUntilNextPuzzle(new Date(Date.UTC(2026, 5, 11, 23, 0)));
    expect(ms).toBe(60 * 60 * 1000);
  });

  it('engine source never uses Math.random', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..', 'src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (readFileSync(p, 'utf8').includes('Math.random')) offenders.push(p);
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
