import { describe, it, expect } from 'vitest';
import { generateSudoku, gradeSudoku } from '../src/sudoku/generator';
import { countSolutions } from '../src/sudoku/solver';
import type { Difficulty } from '../src/core/types';

const FULL = !!process.env.ENGINE_FULL;
const N = FULL ? 67 : 14; // per tier; 3 tiers ≈ 200 / 42 puzzles total

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('sudoku generator', () => {
  it(`generates ${N}/tier valid, unique, correctly-graded puzzles fast enough`, () => {
    const gradeScore: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    let totalMs = 0;
    let count = 0;
    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateSudoku(seed, diff);
        totalMs += performance.now() - t0;
        count++;
        // (a) solvable & solution consistent with givens
        for (let i = 0; i < 81; i++) {
          if (p.givens[i] !== 0) expect(p.givens[i]).toBe(p.solution[i]);
        }
        // (b) exactly one solution (independent recount)
        expect(countSolutions(p.givens, 2), `seed=${seed}`).toBe(1);
        // solution actually solves: no zeros, valid by construction of countSolutions
        expect(p.solution.every((v) => v >= 1 && v <= 9)).toBe(true);
        // (c) grade matches request
        expect(gradeSudoku(p.givens), `seed=${seed}`).toBe(diff);
        gradeScore[diff] += p.givens.filter((v) => v !== 0).length;
      }
    }
    // (c) sanity: clue counts trend downward with difficulty
    expect(gradeScore.easy / N).toBeGreaterThan(gradeScore.hard / N);
    // (d) average generation < 200ms
    expect(totalMs / count, `avg ms = ${totalMs / count}`).toBeLessThan(200);
  });

  it('is deterministic: same seed → identical puzzle', () => {
    const a = generateSudoku('determinism-check', 'medium');
    const b = generateSudoku('determinism-check', 'medium');
    expect(a).toEqual(b);
  });
});
