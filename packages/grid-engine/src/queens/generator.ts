/**
 * Queens puzzle generator.
 * n×n grid, n contiguous colored regions.
 * Place n queens: one per row, one per column, one per region, no two adjacent (incl. diagonal).
 *
 * Strategy:
 * 1. Generate random contiguous regions via randomized flood-fill (Voronoi-ish)
 * 2. Find all valid placements (capped at 2) - if exactly 1, we have a unique puzzle.
 * 3. Re-roll until we get uniqueness.
 *
 * This is much faster than growing from queen positions because we can generate
 * many varied region layouts quickly.
 */
import { Rng } from '@daily-logic/engine';
import type { Difficulty } from '@daily-logic/engine';

export interface QueensPuzzle {
  type: 'queens';
  seed: string;
  difficulty: Difficulty;
  n: number;
  /** n*n cells, each is a region index 0..n-1 */
  regions: number[];
  /** The unique solution: queens[row] = col */
  solution: number[];
}

export const QUEENS_SIZE: Record<Difficulty, number> = {
  easy: 7,
  medium: 8,
  hard: 9,
};

/** Count valid queen placements up to cap, with a node budget. */
export function countQueensSolutions(
  n: number,
  regions: number[],
  cap = 2,
  budget = 200_000,
): number {
  let nodes = 0;
  let count = 0;

  const colUsed = new Uint8Array(n);
  const regionUsed = new Uint8Array(n);
  const queens: number[] = [];

  function rec(row: number): boolean {
    if (++nodes > budget) return true; // abort
    if (row === n) {
      count++;
      return count >= cap;
    }
    for (let col = 0; col < n; col++) {
      if (colUsed[col]) continue;
      const reg = regions[row * n + col];
      if (regionUsed[reg]) continue;
      // no adjacent (including diagonal) to any previous queen
      let adj = false;
      for (let pr = 0; pr < queens.length; pr++) {
        const pc = queens[pr];
        if (Math.abs(row - pr) <= 1 && Math.abs(col - pc) <= 1) {
          adj = true;
          break;
        }
      }
      if (adj) continue;
      colUsed[col] = 1;
      regionUsed[reg] = 1;
      queens.push(col);
      if (rec(row + 1)) return true;
      queens.pop();
      colUsed[col] = 0;
      regionUsed[reg] = 0;
    }
    return false;
  }

  rec(0);
  if (nodes > budget) return -1;
  return count;
}

/** Find the unique queen placement for a given region map. Returns queens[row]=col. */
function findUniquePlacement(
  n: number,
  regions: number[],
  budget = 200_000,
): number[] | null {
  let nodes = 0;
  let count = 0;
  let found: number[] | null = null;

  const colUsed = new Uint8Array(n);
  const regionUsed = new Uint8Array(n);
  const queens: number[] = [];

  function rec(row: number): boolean {
    if (++nodes > budget) return true;
    if (row === n) {
      count++;
      if (count === 1) found = queens.slice();
      return count >= 2;
    }
    for (let col = 0; col < n; col++) {
      if (colUsed[col]) continue;
      const reg = regions[row * n + col];
      if (regionUsed[reg]) continue;
      let adj = false;
      for (let pr = 0; pr < queens.length; pr++) {
        const pc = queens[pr];
        if (Math.abs(row - pr) <= 1 && Math.abs(col - pc) <= 1) { adj = true; break; }
      }
      if (adj) continue;
      colUsed[col] = 1;
      regionUsed[reg] = 1;
      queens.push(col);
      if (rec(row + 1)) return true;
      queens.pop();
      colUsed[col] = 0;
      regionUsed[reg] = 0;
    }
    return false;
  }

  const budgetExceeded = rec(0);
  if (budgetExceeded && nodes > budget) return null;
  return count === 1 ? found : null;
}

/**
 * Generate n contiguous regions via Voronoi-seeded BFS.
 * Seeds are placed randomly, then expanded BFS until all cells assigned.
 */
function generateRegions(rng: Rng, n: number): number[] {
  const regions = new Int32Array(n * n).fill(-1);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

  // Pick n seed cells (random, unique positions)
  const positions = Array.from({ length: n * n }, (_, i) => i);
  rng.shuffle(positions);
  const seeds = positions.slice(0, n);

  for (let r = 0; r < n; r++) {
    regions[seeds[r]] = r;
  }

  // BFS frontier - randomized expansion
  const queue: number[] = [...seeds];
  rng.shuffle(queue);

  // Process with random dequeuing for organic shapes
  while (queue.length > 0) {
    const qi = rng.int(queue.length);
    const cell = queue[qi];
    queue.splice(qi, 1);

    const row = Math.floor(cell / n);
    const col = cell % n;
    const reg = regions[cell];

    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const ni = nr * n + nc;
      if (regions[ni] !== -1) continue;
      regions[ni] = reg;
      queue.push(ni);
    }
  }

  return Array.from(regions);
}

/**
 * Check that all n regions are contiguous (reachable via orthogonal adjacency).
 * Used in tests via export.
 */
export function regionsContiguous(n: number, regions: number[]): boolean {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (let reg = 0; reg < n; reg++) {
    const cells = regions.map((r, i) => r === reg ? i : -1).filter((i) => i >= 0);
    if (cells.length === 0) return false;
    const visited = new Set<number>();
    const queue = [cells[0]];
    visited.add(cells[0]);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      const row = Math.floor(cur / n);
      const col = cur % n;
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const ni = nr * n + nc;
        if (!visited.has(ni) && regions[ni] === reg) {
          visited.add(ni);
          queue.push(ni);
        }
      }
    }
    if (visited.size !== cells.length) return false;
  }
  return true;
}

export function generateQueens(seed: string, difficulty: Difficulty): QueensPuzzle {
  const n = QUEENS_SIZE[difficulty];

  for (let attempt = 0; attempt < 2000; attempt++) {
    const rng = new Rng(`queens:${seed}:${difficulty}:r${attempt}`);
    const regions = generateRegions(rng, n);

    // Verify all regions exist (each region index 0..n-1 appears)
    const regCounts = new Array<number>(n).fill(0);
    for (const r of regions) regCounts[r]++;
    if (regCounts.some((c) => c === 0)) continue;

    // Check that each region spans at least 2 rows or 2 cols (better constraint)
    let degenerate = false;
    for (let reg = 0; reg < n; reg++) {
      const cells = regions.map((r, i) => r === reg ? i : -1).filter((i) => i >= 0);
      const rows = new Set(cells.map((i) => Math.floor(i / n)));
      const cols = new Set(cells.map((i) => i % n));
      if (rows.size === 1 && cells.length > 1) { degenerate = true; break; }
      if (cols.size === 1 && cells.length > 1) { degenerate = true; break; }
    }
    if (degenerate) continue;

    const solution = findUniquePlacement(n, regions, 200_000);
    if (solution === null) continue;

    return { type: 'queens', seed, difficulty, n, regions, solution };
  }

  throw new Error(`queens generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function queensHint(
  puzzle: QueensPuzzle,
  state: ('empty' | 'x' | 'queen')[],
): { cell: number; value: 'queen' } | null {
  for (let row = 0; row < puzzle.n; row++) {
    const col = puzzle.solution[row];
    const idx = row * puzzle.n + col;
    if (state[idx] !== 'queen') {
      return { cell: idx, value: 'queen' };
    }
  }
  return null;
}
