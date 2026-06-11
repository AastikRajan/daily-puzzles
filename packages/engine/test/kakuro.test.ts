import { describe, it, expect } from 'vitest';
import { generateKakuro, gradeKakuro } from '../src/kakuro/generator';
import { countKakuroSolutions } from '../src/kakuro/solver';
import { layoutValid } from '../src/kakuro/layout';
import type { Difficulty } from '../src/core/types';

const FULL = !!process.env.ENGINE_FULL;
const N = FULL ? 67 : 14;
const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('kakuro generator', () => {
  it(`generates ${N}/tier valid, unique puzzles fast enough`, () => {
    const whiteAvg: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    let totalMs = 0;
    let count = 0;
    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateKakuro(seed, diff);
        totalMs += performance.now() - t0;
        count++;
        // layout sanity
        expect(layoutValid(p.walls, p.width, p.height), `layout seed=${seed}`).toBe(true);
        // (a) solution satisfies all run sums with distinct digits
        p.runs.forEach((run, ri) => {
          const digits = run.cells.map((c) => p.solution[c]);
          expect(digits.every((d) => d >= 1 && d <= 9)).toBe(true);
          expect(new Set(digits).size).toBe(digits.length);
          expect(digits.reduce((s, d) => s + d, 0), `run ${ri} seed=${seed}`).toBe(p.sums[ri]);
        });
        // givens are consistent with the solution and sparse
        const givens = new Map<number, number>(
          Object.entries(p.givens).map(([k, v]) => [Number(k), v]),
        );
        for (const [cell, d] of givens) expect(p.solution[cell]).toBe(d);
        expect(givens.size).toBeLessThanOrEqual(Math.max(2, Math.floor(p.whiteCells.length / 5)));
        // (b) exactly one solution given the revealed cells — recount independently
        expect(
          countKakuroSolutions(p.runs, p.sums, p.whiteCells, 2, undefined, givens),
          `seed=${seed}`,
        ).toBe(1);
        // (c) grading consistent
        expect(gradeKakuro(p)).toBe(diff);
        whiteAvg[diff] += p.whiteCells.length / N;
      }
    }
    // (c) monotone: more cells = harder
    expect(whiteAvg.easy).toBeLessThan(whiteAvg.medium);
    expect(whiteAvg.medium).toBeLessThan(whiteAvg.hard);
    expect(totalMs / count, `avg ms = ${totalMs / count}`).toBeLessThan(200);
  });

  it('is deterministic', () => {
    expect(generateKakuro('det', 'easy')).toEqual(generateKakuro('det', 'easy'));
  });
});
