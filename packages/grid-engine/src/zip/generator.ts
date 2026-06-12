/**
 * Zip puzzle generator.
 * n×n grid with numbered checkpoints 1..k.
 * One continuous orthogonal Hamiltonian path from 1 to k visiting every cell,
 * checkpoints in ascending order.
 *
 * Generation strategy:
 * 1. Build a Hamiltonian path via Warnsdorff heuristic + randomization
 * 2. Place k evenly-spaced checkpoints along the path (k from n+1 to n+6)
 * 3. Use a two-stage uniqueness check: quick (5k nodes) then full (2M nodes)
 * 4. Re-roll on a new sub-seed if no checkpoint count works
 */
import { Rng } from '@daily-logic/engine';
import type { Difficulty } from '@daily-logic/engine';

export interface ZipPuzzle {
  type: 'zip';
  seed: string;
  difficulty: Difficulty;
  n: number;
  /** n*n cells; 0 = no checkpoint, 1..k = checkpoint number */
  checkpoints: number[];
  /** The unique Hamiltonian path: solution[step] = flat cell index */
  solution: number[];
}

export const ZIP_SIZE: Record<Difficulty, number> = {
  easy: 5,
  medium: 6,
  hard: 7,
};

/** Max checkpoints = n + 6 (allows enough room for harder grids) */
export const ZIP_MAX_CHECKPOINTS: Record<Difficulty, number> = {
  easy: 9,    // 5 + 4
  medium: 10, // 6 + 4
  hard: 13,   // 7 + 6
};

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/** Generate a Hamiltonian path via Warnsdorff heuristic + randomization. */
function buildHamiltonianPath(rng: Rng, n: number): number[] | null {
  const cells = n * n;
  const starts = Array.from({ length: cells }, (_, i) => i);
  rng.shuffle(starts);

  for (let si = 0; si < Math.min(starts.length, 16); si++) {
    const start = starts[si];
    const vis = new Uint8Array(cells);
    vis[start] = 1;
    const path: number[] = [start];
    let pos = start;
    let ok = true;

    while (path.length < cells) {
      const row = Math.floor(pos / n);
      const col = pos % n;
      const nbrs: number[] = [];
      for (const [dr, dc] of DIRS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const ni = nr * n + nc;
        if (!vis[ni]) nbrs.push(ni);
      }
      if (!nbrs.length) { ok = false; break; }

      let minDeg = Infinity;
      for (const ni of nbrs) {
        vis[ni] = 1;
        let d = 0;
        const nr = Math.floor(ni / n);
        const nc = ni % n;
        for (const [dr2, dc2] of DIRS) {
          const r2 = nr + dr2;
          const c2 = nc + dc2;
          if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
          if (!vis[r2 * n + c2]) d++;
        }
        vis[ni] = 0;
        if (d < minDeg) minDeg = d;
      }

      const threshold = minDeg + (rng.chance(0.1) ? 1 : 0);
      const cands: number[] = [];
      for (const ni of nbrs) {
        vis[ni] = 1;
        let d = 0;
        const nr = Math.floor(ni / n);
        const nc = ni % n;
        for (const [dr2, dc2] of DIRS) {
          const r2 = nr + dr2;
          const c2 = nc + dc2;
          if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
          if (!vis[r2 * n + c2]) d++;
        }
        vis[ni] = 0;
        if (d <= threshold) cands.push(ni);
      }

      rng.shuffle(cands);
      const next = cands[0];
      vis[next] = 1;
      path.push(next);
      pos = next;
    }

    if (ok && path.length === cells) return path;
  }
  return null;
}

/**
 * Count zip solutions up to cap.
 * Returns count, or -1 if budget exceeded.
 */
function countZipSolsInternal(
  n: number,
  checkpoints: number[],
  cap: number,
  budget: number,
): number {
  const cells = n * n;
  const k = Math.max(...checkpoints);
  if (k < 2) return 0;

  const cpCells = new Array<number>(k + 1).fill(-1);
  for (let i = 0; i < cells; i++) {
    if (checkpoints[i] > 0) cpCells[checkpoints[i]] = i;
  }
  for (let num = 1; num <= k; num++) {
    if (cpCells[num] === -1) return 0;
  }

  const start = cpCells[1];
  const end = cpCells[k];

  let nodes = 0;
  let count = 0;
  const vis = new Uint8Array(cells);
  vis[start] = 1;
  let nextCp = 2;

  function rec(pos: number, depth: number): boolean {
    if (++nodes > budget) return true;
    if (depth === cells) {
      if (pos === end && nextCp === k + 1) {
        count++;
        return count >= cap;
      }
      return false;
    }

    const row = Math.floor(pos / n);
    const col = pos % n;

    for (const [dr, dc] of DIRS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const ni = nr * n + nc;
      if (vis[ni]) continue;

      const cp = checkpoints[ni];
      if (cp > 0 && cp !== nextCp) continue;
      const advCp = cp > 0;

      vis[ni] = 1;
      if (advCp) nextCp++;

      if (rec(ni, depth + 1)) return true;

      if (advCp) nextCp--;
      vis[ni] = 0;
    }
    return false;
  }

  rec(start, 1);
  if (nodes > budget) return -1;
  return count;
}

/**
 * Public uniqueness counter (used by tests).
 */
export function countZipSolutions(
  n: number,
  checkpoints: number[],
  _solution: number[],
  cap = 2,
  budget = 500_000,
): number {
  return countZipSolsInternal(n, checkpoints, cap, budget);
}

export function generateZip(seed: string, difficulty: Difficulty): ZipPuzzle {
  const n = ZIP_SIZE[difficulty];
  const cells = n * n;
  const minK = n + 1;
  const maxK = ZIP_MAX_CHECKPOINTS[difficulty];

  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = new Rng(`zip:${seed}:${difficulty}:r${attempt}`);

    const solution = buildHamiltonianPath(rng, n);
    if (!solution || solution.length !== cells) continue;

    // Try evenly-spaced checkpoints from minK to maxK
    for (let k = minK; k <= maxK; k++) {
      const numWp = k - 2;
      const indices: number[] = [0];
      for (let w = 1; w <= numWp; w++) {
        indices.push(Math.round(w * (cells - 1) / (numWp + 1)));
      }
      indices.push(cells - 1);

      // Remove duplicates (can occur when numWp is large relative to cells)
      const ui = [...new Set(indices)].sort((a, b) => a - b);
      if (ui.length !== k) continue; // dedup changed count, skip

      const checkpoints = new Array<number>(cells).fill(0);
      for (let i = 0; i < ui.length; i++) {
        checkpoints[solution[ui[i]]] = i + 1;
      }

      // Quick rejection: tiny budget to fast-detect clearly non-unique cases
      const quick = countZipSolsInternal(n, checkpoints, 2, 5_000);
      if (quick === 2) continue; // definitely not unique

      const fullBudget = n <= 5 ? 800_000 : n <= 6 ? 1_200_000 : 1_600_000;

      if (quick === -1) {
        // Budget exceeded - could be unique or many solutions.
        // Only do full check for larger k (more constrained, more likely unique).
        if (k >= minK + 3) {
          const full = countZipSolsInternal(n, checkpoints, 2, fullBudget);
          if (full === 1) {
            return { type: 'zip', seed, difficulty, n, checkpoints, solution };
          }
        }
        continue;
      }

      if (quick === 1) {
        // Looks unique with small budget - confirm with large budget
        const full = countZipSolsInternal(n, checkpoints, 2, fullBudget);
        if (full === 1) {
          return { type: 'zip', seed, difficulty, n, checkpoints, solution };
        }
      }
    }
  }

  throw new Error(`zip generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function zipHint(
  puzzle: ZipPuzzle,
  drawnPath: number[],
): { cell: number; step: number } | null {
  const nextStep = drawnPath.length;
  if (nextStep >= puzzle.solution.length) return null;
  return { cell: puzzle.solution[nextStep], step: nextStep + 1 };
}
