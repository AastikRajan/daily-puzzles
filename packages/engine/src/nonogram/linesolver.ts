/**
 * Nonogram line solver. Cells: -1 unknown, 0 empty, 1 filled.
 *
 * For one line: memoized feasibility DP over (position, block index); during
 * the DP, mark which cells can be filled / can be empty across all valid
 * placements. Cells possible in only one state are forced. A grid finished by
 * iterating this rule alone has a unique solution (every deduction is forced).
 */

export interface LineFixResult {
  changed: boolean;
  contradiction: boolean;
}

export function fixLine(line: number[], blocks: number[]): LineFixResult {
  const n = line.length;
  const k = blocks.length;
  const memo = new Int8Array((n + 1) * (k + 1)); // 0 unknown, 1 yes, 2 no
  const canFill = new Array<boolean>(n).fill(false);
  const canEmpty = new Array<boolean>(n).fill(false);

  function F(i: number, b: number): boolean {
    const key = i * (k + 1) + b;
    if (memo[key]) return memo[key] === 1;
    let res = false;
    if (b === k) {
      let ok = true;
      for (let j = i; j < n; j++) {
        if (line[j] === 1) { ok = false; break; }
      }
      if (ok) for (let j = i; j < n; j++) canEmpty[j] = true;
      res = ok;
    } else {
      // leave cell i empty
      if (i < n && line[i] !== 1 && F(i + 1, b)) {
        canEmpty[i] = true;
        res = true;
      }
      // place block b at position i
      const L = blocks[b];
      if (i + L <= n) {
        let fits = true;
        for (let j = i; j < i + L; j++) {
          if (line[j] === 0) { fits = false; break; }
        }
        if (fits) {
          if (i + L === n) {
            if (b === k - 1) {
              for (let j = i; j < i + L; j++) canFill[j] = true;
              res = true;
            }
          } else if (line[i + L] !== 1 && F(i + L + 1, b + 1)) {
            for (let j = i; j < i + L; j++) canFill[j] = true;
            canEmpty[i + L] = true;
            res = true;
          }
        }
      }
    }
    memo[key] = res ? 1 : 2;
    return res;
  }

  if (!F(0, 0)) return { changed: false, contradiction: true };

  let changed = false;
  for (let i = 0; i < n; i++) {
    if (line[i] !== -1) continue;
    if (canFill[i] && !canEmpty[i]) { line[i] = 1; changed = true; }
    else if (!canFill[i] && canEmpty[i]) { line[i] = 0; changed = true; }
  }
  return { changed, contradiction: false };
}

export interface NonogramSolveResult {
  /** null if the line solver stalls or hits a contradiction. */
  grid: number[] | null;
  /** Full sweeps over all lines until completion (difficulty signal). */
  sweeps: number;
}

export function solveNonogram(
  rowClues: number[][],
  colClues: number[][],
  width: number,
  height: number,
): NonogramSolveResult {
  const g = new Array<number>(width * height).fill(-1);
  let sweeps = 0;
  for (;;) {
    sweeps++;
    let changed = false;
    for (let r = 0; r < height; r++) {
      const line = new Array<number>(width);
      for (let c = 0; c < width; c++) line[c] = g[r * width + c];
      const res = fixLine(line, rowClues[r]);
      if (res.contradiction) return { grid: null, sweeps };
      if (res.changed) {
        changed = true;
        for (let c = 0; c < width; c++) g[r * width + c] = line[c];
      }
    }
    for (let c = 0; c < width; c++) {
      const line = new Array<number>(height);
      for (let r = 0; r < height; r++) line[r] = g[r * width + c];
      const res = fixLine(line, colClues[c]);
      if (res.contradiction) return { grid: null, sweeps };
      if (res.changed) {
        changed = true;
        for (let r = 0; r < height; r++) g[r * width + c] = line[r];
      }
    }
    if (g.every((v) => v !== -1)) return { grid: g, sweeps };
    if (!changed) return { grid: null, sweeps };
  }
}

export function cluesForLine(line: number[]): number[] {
  const blocks: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v === 1) run++;
    else if (run > 0) { blocks.push(run); run = 0; }
  }
  if (run > 0) blocks.push(run);
  return blocks;
}

/**
 * Independent solution counter for tests: enumerate row placements row by
 * row, pruning with incremental column run-state, cap at `cap`.
 */
export function countNonogramSolutions(
  rowClues: number[][],
  colClues: number[][],
  width: number,
  height: number,
  cap = 2,
): number {
  // all placements (as 0/1 arrays) per row
  function placements(blocks: number[], n: number): number[][] {
    const out: number[][] = [];
    const cur = new Array<number>(n).fill(0);
    function rec(pos: number, b: number): void {
      if (b === blocks.length) {
        out.push(cur.slice());
        return;
      }
      const remaining = blocks.slice(b + 1).reduce((s, x) => s + x + 1, 0);
      for (let i = pos; i + blocks[b] + remaining <= n; i++) {
        for (let j = i; j < i + blocks[b]; j++) cur[j] = 1;
        rec(i + blocks[b] + 1, b + 1);
        for (let j = i; j < i + blocks[b]; j++) cur[j] = 0;
      }
    }
    rec(0, 0);
    return out;
  }

  const rowPlacements = rowClues.map((rc) => placements(rc, width));
  // column run state: blockIdx + current run length per column
  const blockIdx = new Array<number>(width).fill(0);
  const runLen = new Array<number>(width).fill(0);
  let count = 0;

  function rec(r: number): boolean {
    if (r === height) {
      for (let c = 0; c < width; c++) {
        const bc = colClues[c];
        let bi = blockIdx[c];
        if (runLen[c] > 0) {
          if (bc[bi] !== runLen[c]) return false;
          bi++;
        }
        if (bi !== bc.length) return false;
      }
      count++;
      return count >= cap;
    }
    outer: for (const p of rowPlacements[r]) {
      const savedBi = blockIdx.slice();
      const savedRun = runLen.slice();
      for (let c = 0; c < width; c++) {
        const bc = colClues[c];
        if (p[c] === 1) {
          if (blockIdx[c] >= bc.length) { restore(savedBi, savedRun, c); continue outer; }
          runLen[c]++;
          if (runLen[c] > bc[blockIdx[c]]) { restore(savedBi, savedRun, c); continue outer; }
        } else if (runLen[c] > 0) {
          if (runLen[c] !== bc[blockIdx[c]]) { restore(savedBi, savedRun, c); continue outer; }
          blockIdx[c]++;
          runLen[c] = 0;
        }
        // feasibility: remaining rows must fit remaining blocks
        const remainingRows = height - r - 1;
        let need = 0;
        for (let bi = blockIdx[c]; bi < bc.length; bi++) need += bc[bi] + 1;
        if (runLen[c] > 0) need -= runLen[c] + 1;
        else if (need > 0) need -= 1; // first block needs no leading gap
        if (need > remainingRows) { restore(savedBi, savedRun, c); continue outer; }
      }
      const abort = rec(r + 1);
      for (let c = 0; c < width; c++) { blockIdx[c] = savedBi[c]; runLen[c] = savedRun[c]; }
      if (abort) return true;
    }
    return false;

    function restore(bi: number[], rl: number[], upto: number): void {
      for (let c = 0; c <= upto; c++) { blockIdx[c] = bi[c]; runLen[c] = rl[c]; }
    }
  }

  rec(0);
  return count;
}
