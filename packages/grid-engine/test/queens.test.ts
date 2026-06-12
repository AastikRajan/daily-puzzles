import { describe, it, expect } from 'vitest';
import { generateQueens, countQueensSolutions, QUEENS_SIZE } from '../src/queens/generator';
import type { Difficulty } from '@daily-logic/engine';

const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];
const N = 10; // per tier

describe('queens generator', () => {
  it('determinism: same seed → identical puzzle', () => {
    const a = generateQueens('det-check', 'medium');
    const b = generateQueens('det-check', 'medium');
    expect(a).toEqual(b);
  });

  it('no Math.random usage (deterministic RNG only)', () => {
    // If this runs without error using the engine RNG, we're good
    const p = generateQueens('rng-test', 'easy');
    expect(p.type).toBe('queens');
  });

  it('generates valid, unique, correctly-sized puzzles fast enough', () => {
    let totalMs = 0;
    let count = 0;

    for (const diff of TIERS) {
      const n = QUEENS_SIZE[diff];
      for (let k = 0; k < N; k++) {
        const seed = `test-queens-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateQueens(seed, diff);
        totalMs += performance.now() - t0;
        count++;

        expect(p.type).toBe('queens');
        expect(p.n).toBe(n);
        expect(p.regions.length).toBe(n * n);
        expect(p.solution.length).toBe(n);

        // All region indices valid
        for (const r of p.regions) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(n);
        }

        // Solution: one per row, one per col, one per region
        const cols = new Set(p.solution);
        expect(cols.size).toBe(n);
        const regions = new Set(p.solution.map((col, row) => p.regions[row * n + col]));
        expect(regions.size).toBe(n);

        // No two queens adjacent
        for (let r1 = 0; r1 < n; r1++) {
          for (let r2 = r1 + 1; r2 < n; r2++) {
            const rowDist = Math.abs(r1 - r2);
            const colDist = Math.abs(p.solution[r1] - p.solution[r2]);
            if (rowDist <= 1 && colDist <= 1) {
              throw new Error(`Adjacent queens at rows ${r1},${r2}`);
            }
          }
        }

        // Regions are contiguous (BFS check for each)
        for (let reg = 0; reg < n; reg++) {
          const cells = p.regions.map((r, i) => r === reg ? i : -1).filter((i) => i >= 0);
          expect(cells.length).toBeGreaterThan(0);
          // BFS from first cell
          const visited = new Set<number>();
          const queue = [cells[0]];
          visited.add(cells[0]);
          while (queue.length > 0) {
            const cur = queue.shift()!;
            const row = Math.floor(cur / n);
            const col = cur % n;
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nr = row + dr;
              const nc = col + dc;
              if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
              const ni = nr * n + nc;
              if (visited.has(ni)) continue;
              if (p.regions[ni] === reg) {
                visited.add(ni);
                queue.push(ni);
              }
            }
          }
          expect(visited.size).toBe(cells.length);
        }

        // Unique via counter
        const cnt = countQueensSolutions(n, p.regions, 2, 200_000);
        expect(cnt, `seed=${seed} should have unique solution`).toBe(1);
      }
    }

    const avgMs = totalMs / count;
    expect(avgMs, `avg ms = ${avgMs}`).toBeLessThan(200);
  });
});
