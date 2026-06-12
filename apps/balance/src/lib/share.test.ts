import { describe, it, expect } from 'vitest';
import { buildBalanceShare, attemptRow } from './share';
import { dailyShapes } from '../game/shapes';

describe('balance share + daily determinism', () => {
  it('attempt rows encode topple position and success', () => {
    expect(attemptRow(-1)).toBe('🟩');
    expect(attemptRow(0)).toBe('🟥');
    expect(attemptRow(3)).toBe('🟦🟦🟦🟥');
  });

  it('share card formats win and loss', () => {
    const win = buildBalanceShare('2026-06-13', [3, -1], true, 4);
    expect(win).toContain('solved in 2/5');
    expect(win).toContain('🟦🟦🟦🟥');
    expect(win).toContain('🟩');
    expect(win).toContain('🔥 4-day streak');
    const loss = buildBalanceShare('2026-06-13', [1, 2, 0, 4, 5], false, 1);
    expect(loss).toContain('X/5');
    expect(loss).not.toContain('🔥');
  });

  it('daily shapes are deterministic per date and vary across dates', () => {
    const a = dailyShapes('2026-06-13');
    const b = dailyShapes('2026-06-13');
    expect(a).toEqual(b);
    expect(a).toHaveLength(8);
    const c = dailyShapes('2026-06-14');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
});
