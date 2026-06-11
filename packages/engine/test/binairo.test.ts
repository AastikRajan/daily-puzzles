import { describe, it, expect } from 'vitest';
import { generateBinairo, gradeBinairo, BINAIRO_SIZE } from '../src/binairo/generator';
import { countBinairoSolutions } from '../src/binairo/solver';
import type { Difficulty } from '../src/core/types';

const FULL = !!process.env.ENGINE_FULL;
const N = FULL ? 67 : 14;
const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('binairo generator', () => {
  it(`generates ${N}/tier valid, unique puzzles fast enough`, () => {
    let totalMs = 0;
    let count = 0;
    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateBinairo(seed, diff);
        totalMs += performance.now() - t0;
        count++;
        const size = BINAIRO_SIZE[diff];
        expect(p.size).toBe(size);
        // (a) solution is valid & consistent with givens
        for (let i = 0; i < size * size; i++) {
          expect(p.solution[i] === 0 || p.solution[i] === 1).toBe(true);
          if (p.givens[i] !== -1) expect(p.givens[i]).toBe(p.solution[i]);
        }
        for (let r = 0; r < size; r++) {
          let z = 0;
          for (let c = 0; c < size; c++) if (p.solution[r * size + c] === 0) z++;
          expect(z, `row balance seed=${seed}`).toBe(size / 2);
        }
        // (b) exactly one solution — independent brute-force count
        expect(countBinairoSolutions(p.givens, size, 2), `seed=${seed}`).toBe(1);
        // (c) grading consistent
        expect(gradeBinairo(p)).toBe(diff);
        // some cells must actually be blank
        expect(p.givens.filter((v) => v === -1).length).toBeGreaterThan(size);
      }
    }
    expect(totalMs / count, `avg ms = ${totalMs / count}`).toBeLessThan(200);
  });

  it('is deterministic', () => {
    expect(generateBinairo('det', 'hard')).toEqual(generateBinairo('det', 'hard'));
  });
});
