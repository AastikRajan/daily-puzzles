import { describe, it, expect } from 'vitest';
import { dailyMaze, solveMaze, canMove, step } from './maze';

const DATES = ['2026-06-08', '2026-06-10', '2026-06-13', '2026-07-04', '2026-09-21'];

describe('echo maze generation', () => {
  it('is deterministic per date and varies across dates', () => {
    expect(dailyMaze('2026-06-13')).toEqual(dailyMaze('2026-06-13'));
    expect(JSON.stringify(dailyMaze('2026-06-13'))).not.toBe(JSON.stringify(dailyMaze('2026-06-14')));
  });

  it('every daily maze is a solvable perfect maze', () => {
    for (const date of DATES) {
      const m = dailyMaze(date);
      const path = solveMaze(m);
      expect(path.length).toBeGreaterThan(m.size); // non-trivial route
      // walking the path reaches the exit through open walls only
      let cell = m.start;
      for (const dir of path) {
        expect(canMove(m, cell, dir)).toBe(true);
        cell = step(m, cell, dir);
      }
      expect(cell).toBe(m.exit);
      // perfect maze: exactly n-1 openings (spanning tree)
      const n = m.size * m.size;
      let openings = 0;
      for (const w of m.walls) openings += 4 - ((w & 1) + ((w >> 1) & 1) + ((w >> 2) & 1) + ((w >> 3) & 1));
      expect(openings / 2).toBe(n - 1);
    }
  });
});
