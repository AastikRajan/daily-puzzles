import { describe, it, expect } from 'vitest';
import { generateKiller, gradeKiller, countKillerSolutions } from '../src/killer/generator';
import type { Difficulty } from '../src/core/types';

const FULL = !!process.env.ENGINE_FULL;
const N = FULL ? 67 : 14;
const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('killer sudoku generator', () => {
  it(`generates ${N}/tier valid, unique puzzles fast enough`, () => {
    let totalMs = 0;
    let count = 0;
    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateKiller(seed, diff);
        totalMs += performance.now() - t0;
        count++;
        // (a) cages partition the grid exactly, sums match, no repeats
        const covered = new Array(81).fill(0);
        for (const cage of p.cages) {
          expect(cage.cells.length).toBeGreaterThanOrEqual(1);
          const digits = cage.cells.map((c) => p.solution[c]);
          expect(new Set(digits).size).toBe(digits.length);
          expect(digits.reduce((s, d) => s + d, 0)).toBe(cage.sum);
          for (const c of cage.cells) covered[c]++;
        }
        expect(covered.every((x) => x === 1), `partition seed=${seed}`).toBe(true);
        // solution is a valid sudoku grid
        for (let unit = 0; unit < 9; unit++) {
          const row = new Set<number>();
          const col = new Set<number>();
          for (let j = 0; j < 9; j++) {
            row.add(p.solution[unit * 9 + j]);
            col.add(p.solution[j * 9 + unit]);
          }
          expect(row.size).toBe(9);
          expect(col.size).toBe(9);
        }
        // givens consistent
        for (let i = 0; i < 81; i++) {
          if (p.givens[i] !== 0) expect(p.givens[i]).toBe(p.solution[i]);
        }
        // (b) exactly one solution — independent recount
        expect(countKillerSolutions(p.cages, p.givens, 2), `seed=${seed}`).toBe(1);
        // (c) grading consistent
        expect(gradeKiller(p), `seed=${seed}`).toBe(diff);
      }
    }
    expect(totalMs / count, `avg ms = ${totalMs / count}`).toBeLessThan(200);
  });

  it('is deterministic', () => {
    expect(generateKiller('det', 'hard')).toEqual(generateKiller('det', 'hard'));
  });
});
