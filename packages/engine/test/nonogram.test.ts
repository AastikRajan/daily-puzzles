import { describe, it, expect } from 'vitest';
import { generateNonogram, gradeNonogram } from '../src/nonogram/generator';
import { countNonogramSolutions, cluesForLine } from '../src/nonogram/linesolver';
import type { Difficulty } from '../src/core/types';

const FULL = !!process.env.ENGINE_FULL;
const N = FULL ? 67 : 14;
const TIERS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('nonogram generator', () => {
  it(`generates ${N}/tier valid, unique puzzles fast enough`, () => {
    let totalMs = 0;
    let count = 0;
    for (const diff of TIERS) {
      for (let k = 0; k < N; k++) {
        const seed = `test-${diff}-${k}`;
        const t0 = performance.now();
        const p = generateNonogram(seed, diff);
        totalMs += performance.now() - t0;
        count++;
        // (a) solution matches its own clues
        for (let r = 0; r < p.height; r++) {
          const line = p.solution.slice(r * p.width, (r + 1) * p.width);
          expect(cluesForLine(line), `row ${r} seed=${seed}`).toEqual(p.rowClues[r]);
        }
        for (let c = 0; c < p.width; c++) {
          const line: number[] = [];
          for (let r = 0; r < p.height; r++) line.push(p.solution[r * p.width + c]);
          expect(cluesForLine(line), `col ${c} seed=${seed}`).toEqual(p.colClues[c]);
        }
        // (b) exactly one solution — independent row-DFS counter
        expect(
          countNonogramSolutions(p.rowClues, p.colClues, p.width, p.height, 2),
          `seed=${seed}`,
        ).toBe(1);
        // (c) grading consistent with requested difficulty
        expect(gradeNonogram(p), `seed=${seed}`).toBe(diff);
      }
    }
    expect(totalMs / count, `avg ms = ${totalMs / count}`).toBeLessThan(200);
  });

  it('is deterministic', () => {
    expect(generateNonogram('det', 'medium')).toEqual(generateNonogram('det', 'medium'));
  });
});
