import { describe, it, expect } from 'vitest';
import { generateTango, countTangoSolutions } from '../src/tango/generator';
import type { Difficulty } from '@daily-logic/engine';

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];
const N = 10;
const SIZE = 6;
const HALF = 3;

describe('tango generator', () => {
  it('determinism: same seed → identical puzzle', () => {
    const a = generateTango('det-check', 'medium');
    const b = generateTango('det-check', 'medium');
    expect(a).toEqual(b);
  });

  it('generates valid, unique puzzles', () => {
    let totalMs = 0;
    let count = 0;

    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-tango-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateTango(seed, diff);
        totalMs += performance.now() - t0;
        count++;

        expect(p.type).toBe('tango');
        expect(p.solution.length).toBe(SIZE * SIZE);
        expect(p.givens.length).toBe(SIZE * SIZE);

        // Solution validity
        for (let r = 0; r < SIZE; r++) {
          let zeros = 0, ones = 0;
          for (let c = 0; c < SIZE; c++) {
            const v = p.solution[r * SIZE + c];
            expect(v === 0 || v === 1).toBe(true);
            if (v === 0) zeros++; else ones++;
            // no three in a row
            if (c >= 2) {
              const prev2 = p.solution[r * SIZE + c - 2];
              const prev1 = p.solution[r * SIZE + c - 1];
              expect(!(prev2 === v && prev1 === v)).toBe(true);
            }
          }
          expect(zeros).toBe(HALF);
          expect(ones).toBe(HALF);
        }
        for (let c = 0; c < SIZE; c++) {
          let zeros = 0, ones = 0;
          for (let r = 0; r < SIZE; r++) {
            const v = p.solution[r * SIZE + c];
            if (v === 0) zeros++; else ones++;
            if (r >= 2) {
              const prev2 = p.solution[(r-2) * SIZE + c];
              const prev1 = p.solution[(r-1) * SIZE + c];
              expect(!(prev2 === v && prev1 === v)).toBe(true);
            }
          }
          expect(zeros).toBe(HALF);
          expect(ones).toBe(HALF);
        }

        // Signs consistent with solution
        for (const s of p.signs) {
          const va = p.solution[s.a];
          const vb = p.solution[s.b];
          if (s.type === '=') expect(va).toBe(vb);
          else expect(va).not.toBe(vb);
        }

        // Givens match solution
        for (let i = 0; i < SIZE * SIZE; i++) {
          if (p.givens[i] !== -1) expect(p.givens[i]).toBe(p.solution[i]);
        }

        // Unique solution
        const cnt = countTangoSolutions(p.givens, p.signs, 2);
        expect(cnt, `seed=${seed} should be unique`).toBe(1);
      }
    }

    const avgMs = totalMs / count;
    expect(avgMs, `avg ms = ${avgMs}`).toBeLessThan(200);
  });
});
