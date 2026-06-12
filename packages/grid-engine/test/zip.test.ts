import { describe, it, expect } from 'vitest';
import { generateZip, countZipSolutions, ZIP_SIZE, ZIP_MAX_CHECKPOINTS } from '../src/zip/generator';
import type { Difficulty } from '@daily-logic/engine';

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];
const N = 10;

describe('zip generator', () => {
  it('determinism: same seed → identical puzzle', () => {
    const a = generateZip('det-check', 'medium');
    const b = generateZip('det-check', 'medium');
    expect(a).toEqual(b);
  });

  it('generates valid, unique Hamiltonian path puzzles', () => {
    let totalMs = 0;
    let count = 0;

    for (const diff of TIERS) {
      const n = ZIP_SIZE[diff];
      const cells = n * n;
      const k = n + 1;

      for (let ki = 0; ki < N; ki++) {
        const seed = `test-zip-${diff}-${ki}`;
        const t0 = performance.now();
        const p = generateZip(seed, diff);
        totalMs += performance.now() - t0;
        count++;

        expect(p.type).toBe('zip');
        expect(p.n).toBe(n);
        expect(p.checkpoints.length).toBe(cells);
        expect(p.solution.length).toBe(cells);

        // Solution is a permutation of all cells
        const visited = new Set(p.solution);
        expect(visited.size).toBe(cells);

        // Solution is a valid path (consecutive cells are adjacent)
        for (let s = 1; s < p.solution.length; s++) {
          const prev = p.solution[s - 1];
          const curr = p.solution[s];
          const pr = Math.floor(prev / n);
          const pc = prev % n;
          const cr = Math.floor(curr / n);
          const cc = curr % n;
          const dist = Math.abs(pr - cr) + Math.abs(pc - cc);
          expect(dist, `step ${s}: not adjacent`).toBe(1);
        }

        // Checkpoints are ordered along the solution path
        const cpNums = p.checkpoints.filter((v) => v > 0);
        expect(cpNums.length).toBeGreaterThanOrEqual(k);
        expect(cpNums.length).toBeLessThanOrEqual(ZIP_MAX_CHECKPOINTS[diff]);

        // Find checkpoint cells along solution path
        const cpInPath: number[] = [];
        for (const cell of p.solution) {
          if (p.checkpoints[cell] > 0) cpInPath.push(p.checkpoints[cell]);
        }
        // Checkpoints must be strictly ascending along path
        for (let i = 1; i < cpInPath.length; i++) {
          expect(cpInPath[i]).toBeGreaterThan(cpInPath[i - 1]);
        }

        // Checkpoint 1 is at solution[0] and last checkpoint at solution[n*n-1]
        expect(p.checkpoints[p.solution[0]]).toBe(1);
        const maxCp = Math.max(...p.checkpoints);
        expect(p.checkpoints[p.solution[cells - 1]]).toBe(maxCp);

        // Unique solution
        const cnt = countZipSolutions(n, p.checkpoints, p.solution, 2, 300_000);
        expect(cnt, `seed=${seed} should be unique`).toBe(1);
      }
    }

    const avgMs = totalMs / count;
    expect(avgMs, `avg ms = ${avgMs}`).toBeLessThan(200);
  });
});
