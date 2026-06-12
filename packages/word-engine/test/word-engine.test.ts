import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays } from '@daily-logic/engine';
import {
  generateGuessPuzzle,
  dailyGuessAnswer,
  canBuildFromRack,
  generateAnagramsPuzzle,
  generateHuntPuzzle,
  GRID_SIZE,
} from '../src/index';
import { ANSWERS } from '../src/data/answers';

const BASE_DATE = '2026-06-11';

function dateRange(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(BASE_DATE, i));
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Determinism
// ──────────────────────────────────────────────────────────────────────────────
describe('determinism', () => {
  it('guess: same date → same answer', () => {
    for (const date of dateRange(30)) {
      const a = generateGuessPuzzle(date);
      const b = generateGuessPuzzle(date);
      expect(a.answer).toBe(b.answer);
    }
  });

  it('guess: different dates → different answers (usually)', () => {
    const answers = dateRange(30).map((d) => dailyGuessAnswer(d));
    const unique = new Set(answers);
    expect(unique.size).toBeGreaterThan(20);
  });

  it('anagrams: same date → same rack and solutions', () => {
    for (const date of dateRange(30)) {
      const a = generateAnagramsPuzzle(date);
      const b = generateAnagramsPuzzle(date);
      expect(a.rack).toEqual(b.rack);
      expect(a.solutions).toEqual(b.solutions);
    }
  });

  it('hunt: same date → same grid and words', () => {
    for (const date of dateRange(30)) {
      const a = generateHuntPuzzle(date);
      const b = generateHuntPuzzle(date);
      expect(JSON.stringify(a.grid)).toBe(JSON.stringify(b.grid));
      expect(JSON.stringify(a.words)).toBe(JSON.stringify(b.words));
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Guess answer validity
// ──────────────────────────────────────────────────────────────────────────────
describe('guess answers', () => {
  it('answer is always in ANSWERS list over 30 dates', () => {
    const answerSet = new Set(ANSWERS);
    for (const date of dateRange(30)) {
      const { answer } = generateGuessPuzzle(date);
      expect(answerSet.has(answer)).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Anagrams validity
// ──────────────────────────────────────────────────────────────────────────────
describe('anagrams', () => {
  it('over 30 dates: rack is 7 letters, ≥1 7-letter solution, ≥15 solutions total', () => {
    for (const date of dateRange(30)) {
      const puzzle = generateAnagramsPuzzle(date);
      expect(puzzle.rack).toHaveLength(7);
      expect(puzzle.solutions.length).toBeGreaterThanOrEqual(15);
      const sevenLetterSolutions = puzzle.solutions.filter((w) => w.length === 7);
      expect(sevenLetterSolutions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all solutions are buildable from the rack', () => {
    for (const date of dateRange(30)) {
      const puzzle = generateAnagramsPuzzle(date);
      for (const sol of puzzle.solutions) {
        expect(canBuildFromRack(sol, puzzle.rack)).toBe(true);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Hunt validity
// ──────────────────────────────────────────────────────────────────────────────
describe('word hunt', () => {
  it('over 30 dates: grid is 8×8, all 6 words placed within bounds', () => {
    for (const date of dateRange(30)) {
      const puzzle = generateHuntPuzzle(date);
      expect(puzzle.grid).toHaveLength(GRID_SIZE);
      for (const row of puzzle.grid) {
        expect(row).toHaveLength(GRID_SIZE);
        for (const cell of row) {
          expect(cell).toMatch(/^[A-Z]$/);
        }
      }
      expect(puzzle.words.length).toBeGreaterThanOrEqual(1);
      for (const placed of puzzle.words) {
        for (const { row, col } of placed.cells) {
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(GRID_SIZE);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(GRID_SIZE);
        }
      }
    }
  });

  it('placed words letters are in grid at recorded positions', () => {
    for (const date of dateRange(30)) {
      const puzzle = generateHuntPuzzle(date);
      for (const placed of puzzle.words) {
        for (let i = 0; i < placed.word.length; i++) {
          const { row, col } = placed.cells[i]!;
          expect(puzzle.grid[row]![col]).toBe(placed.word[i]!.toUpperCase());
        }
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// No Math.random in engine source
// ──────────────────────────────────────────────────────────────────────────────
describe('no Math.random', () => {
  it('engine src never uses Math.random', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..', 'src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (p.endsWith('.ts') && readFileSync(p, 'utf8').includes('Math.random')) {
          offenders.push(p);
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
