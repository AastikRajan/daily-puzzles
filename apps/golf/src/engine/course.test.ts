import { describe, it, expect } from 'vitest';
import { generateCourse } from './course';
import { BALL_RADIUS, HOLE_RADIUS } from './physics';

const DATES = ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14',
  '2026-07-01', '2026-07-02', '2026-08-15', '2026-09-30', '2026-12-25'];

describe('glow golf course generation', () => {
  it('is deterministic per date and varies across dates', () => {
    const a = generateCourse('2026-06-13');
    const b = generateCourse('2026-06-13');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = generateCourse('2026-06-14');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('every hole across 10 dates is sane: 9 holes, par 2-4, tee/hole in bounds and clear of walls', () => {
    for (const date of DATES) {
      const holes = generateCourse(date);
      expect(holes).toHaveLength(9);
      for (const h of holes) {
        expect(h.par).toBeGreaterThanOrEqual(2);
        expect(h.par).toBeLessThanOrEqual(4);
        // in bounds
        for (const p of [h.tee, { x: h.hole.x, y: h.hole.y }]) {
          expect(p.x).toBeGreaterThan(BALL_RADIUS);
          expect(p.y).toBeGreaterThan(BALL_RADIUS);
          expect(p.x).toBeLessThan(h.canvasW - BALL_RADIUS);
          expect(p.y).toBeLessThan(h.canvasH - BALL_RADIUS);
        }
        // tee and cup not inside any wall
        for (const w of h.walls) {
          const inside = (px: number, py: number, pad: number) =>
            px + pad > w.x && px - pad < w.x + w.w && py + pad > w.y && py - pad < w.y + w.h;
          expect(inside(h.tee.x, h.tee.y, BALL_RADIUS), `${date} tee in wall`).toBe(false);
          expect(inside(h.hole.x, h.hole.y, HOLE_RADIUS * 0.5), `${date} cup in wall`).toBe(false);
        }
        // tee and cup reasonably separated
        const d = Math.hypot(h.tee.x - h.hole.x, h.tee.y - h.hole.y);
        expect(d).toBeGreaterThan(80);
      }
    }
  });
});
