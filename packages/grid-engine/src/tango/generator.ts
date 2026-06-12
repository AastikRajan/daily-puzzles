/**
 * Tango puzzle generator.
 * 6×6 grid of ☀/☾.
 * Rules: each row/col exactly 3 each; no 3 identical adjacent.
 * '=' signs between adjacent pairs (same), '×' signs (differ).
 */
import { Rng } from '@daily-logic/engine';
import type { Difficulty } from '@daily-logic/engine';

export type CellValue = 0 | 1; // 0=sun, 1=moon

export interface TangoSign {
  /** flat index of the first cell */
  a: number;
  /** flat index of the second cell (adjacent, right or down) */
  b: number;
  /** '=' means same, 'x' means different */
  type: '=' | 'x';
}

export interface TangoPuzzle {
  type: 'tango';
  seed: string;
  difficulty: Difficulty;
  /** 6×6 grid, -1 unknown, 0 sun, 1 moon */
  givens: number[];
  /** signs between adjacent pairs */
  signs: TangoSign[];
  /** The unique solution: 36 cells */
  solution: CellValue[];
}

const SIZE = 6;
const HALF = 3;


/** Generate a random valid 6×6 tango grid. */
function fillTango(rng: Rng): CellValue[] | null {
  const g = new Array<number>(SIZE * SIZE).fill(-1);

  function ok(i: number): boolean {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const v = g[i];
    if (c >= 2 && g[i - 1] === v && g[i - 2] === v) return false;
    if (r >= 2 && g[i - SIZE] === v && g[i - 2 * SIZE] === v) return false;
    let rowCount = 0;
    for (let cc = 0; cc <= c; cc++) if (g[r * SIZE + cc] === v) rowCount++;
    if (rowCount > HALF) return false;
    if (c === SIZE - 1) {
      let s = 0;
      for (let cc = 0; cc < SIZE; cc++) s += g[r * SIZE + cc];
      if (s !== HALF) return false;
    }
    let colCount = 0;
    for (let rr = 0; rr <= r; rr++) if (g[rr * SIZE + c] === v) colCount++;
    if (colCount > HALF) return false;
    return true;
  }

  function rec(i: number): boolean {
    if (i === SIZE * SIZE) return true;
    const first = rng.int(2);
    for (const v of [first, 1 - first]) {
      g[i] = v;
      if (ok(i) && rec(i + 1)) return true;
    }
    g[i] = -1;
    return false;
  }

  return rec(0) ? (g as CellValue[]) : null;
}

/**
 * Rule-based solver for tango.
 * Returns solved grid or null if stuck.
 */
function solveTango(givens: number[], signs: TangoSign[]): number[] | null {
  const g = givens.slice();

  // Build sign lookup: cell pair → type
  const signMap = new Map<string, '=' | 'x'>();
  for (const s of signs) {
    signMap.set(`${s.a},${s.b}`, s.type);
    signMap.set(`${s.b},${s.a}`, s.type);
  }

  function setCell(i: number, v: number): boolean {
    if (g[i] !== -1) return g[i] === v;
    g[i] = v;
    return true;
  }

  function pass(): boolean {
    let changed = false;

    // Propagate signs
    for (const sign of signs) {
      const va = g[sign.a];
      const vb = g[sign.b];
      if (va === -1 && vb === -1) continue;
      if (va !== -1 && vb === -1) {
        const need = sign.type === '=' ? va : 1 - va;
        if (!setCell(sign.b, need)) return false;
        changed = true;
      } else if (vb !== -1 && va === -1) {
        const need = sign.type === '=' ? vb : 1 - vb;
        if (!setCell(sign.a, need)) return false;
        changed = true;
      }
    }

    // Row/col deductions
    for (let axis = 0; axis < 2; axis++) {
      for (let idx = 0; idx < SIZE; idx++) {
        const line: number[] = [];
        for (let k = 0; k < SIZE; k++) {
          line.push(axis === 0 ? g[idx * SIZE + k] : g[k * SIZE + idx]);
        }
        // count
        const zeros = line.filter((v) => v === 0).length;
        const ones = line.filter((v) => v === 1).length;
        if (zeros === HALF) {
          for (let k = 0; k < SIZE; k++) {
            if (line[k] === -1) {
              const i = axis === 0 ? idx * SIZE + k : k * SIZE + idx;
              if (!setCell(i, 1)) return false;
              changed = true;
            }
          }
        } else if (ones === HALF) {
          for (let k = 0; k < SIZE; k++) {
            if (line[k] === -1) {
              const i = axis === 0 ? idx * SIZE + k : k * SIZE + idx;
              if (!setCell(i, 0)) return false;
              changed = true;
            }
          }
        }
        // triple prevention: XX_ or _XX or X_X
        for (let k = 0; k < SIZE; k++) {
          if (line[k] !== -1) continue;
          const i = axis === 0 ? idx * SIZE + k : k * SIZE + idx;
          // prev prev, prev
          if (k >= 2 && line[k - 1] !== -1 && line[k - 1] === line[k - 2]) {
            if (!setCell(i, 1 - line[k - 1])) return false;
            changed = true;
          }
          // next, next next
          if (k + 2 < SIZE && line[k + 1] !== -1 && line[k + 1] === line[k + 2]) {
            if (!setCell(i, 1 - line[k + 1])) return false;
            changed = true;
          }
          // sandwich: prev, _, next where prev === next
          if (k >= 1 && k + 1 < SIZE && line[k - 1] !== -1 && line[k - 1] === line[k + 1]) {
            if (!setCell(i, 1 - line[k - 1])) return false;
            changed = true;
          }
        }
        // line-completion enumeration for short unknowns
        const blanks: number[] = [];
        for (let k = 0; k < SIZE; k++) if (line[k] === -1) blanks.push(k);
        if (blanks.length > 0 && blanks.length <= 4) {
          const completions: number[][] = [];
          const total = 1 << blanks.length;
          for (let m = 0; m < total; m++) {
            const cand = line.slice();
            for (let b = 0; b < blanks.length; b++) cand[blanks[b]] = (m >> b) & 1;
            // check valid
            let valid = true;
            const z = cand.filter((v) => v === 0).length;
            if (z !== HALF) { valid = false; }
            if (valid) {
              for (let k = 0; k + 2 < SIZE; k++) {
                if (cand[k] === cand[k + 1] && cand[k] === cand[k + 2]) { valid = false; break; }
              }
            }
            // check sign consistency for this line's positions
            if (valid) {
              for (const s of signs) {
                const ra = Math.floor(s.a / SIZE);
                const ca = s.a % SIZE;
                const rb = Math.floor(s.b / SIZE);
                const cb = s.b % SIZE;
                // both in this line?
                let ka = -1, kb = -1;
                if (axis === 0 && ra === idx && rb === idx) { ka = ca; kb = cb; }
                else if (axis === 1 && ca === idx && cb === idx) { ka = ra; kb = rb; }
                if (ka === -1) continue;
                const expect = s.type === '=' ? cand[ka] === cand[kb] : cand[ka] !== cand[kb];
                if (!expect) { valid = false; break; }
              }
            }
            if (valid) completions.push(cand);
          }
          if (completions.length === 0) return false;
          for (const k of blanks) {
            const v0 = completions[0][k];
            if (completions.every((c) => c[k] === v0)) {
              const i = axis === 0 ? idx * SIZE + k : k * SIZE + idx;
              if (!setCell(i, v0)) return false;
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }

  for (let iter = 0; iter < 200; iter++) {
    if (g.every((v) => v !== -1)) return g;
    const r = pass();
    if (r === false) return null;
  }
  return g.every((v) => v !== -1) ? g : null;
}

/**
 * Count tango solutions using brute-force row-pattern enumeration.
 * Adapted from countBinairoSolutions but without distinct-line constraint,
 * and adding sign checks.
 */
export function countTangoSolutions(
  givens: number[],
  signs: TangoSign[],
  cap = 2,
): number {
  // Generate all balanced, triple-free rows of length 6
  const patterns: number[][] = [];
  const row = new Array<number>(SIZE);
  (function gen(i: number, zeros: number): void {
    if (zeros > HALF || i - zeros > HALF) return;
    if (i === SIZE) { patterns.push(row.slice()); return; }
    for (const v of [0, 1]) {
      if (i >= 2 && row[i - 1] === v && row[i - 2] === v) continue;
      row[i] = v;
      gen(i + 1, zeros + (v === 0 ? 1 : 0));
    }
  })(0, 0);

  // Per-row candidates matching givens + row-internal sign constraints
  const rowCands: number[][][] = [];
  for (let r = 0; r < SIZE; r++) {
    const cands = patterns.filter((p) => {
      for (let c = 0; c < SIZE; c++) {
        const v = givens[r * SIZE + c];
        if (v !== -1 && p[c] !== v) return false;
      }
      // horizontal sign constraints
      for (const s of signs) {
        const ra = Math.floor(s.a / SIZE);
        const ca = s.a % SIZE;
        const rb = Math.floor(s.b / SIZE);
        const cb = s.b % SIZE;
        if (ra === r && rb === r) {
          const ok = s.type === '=' ? p[ca] === p[cb] : p[ca] !== p[cb];
          if (!ok) return false;
        }
      }
      return true;
    });
    if (cands.length === 0) return 0;
    rowCands.push(cands);
  }

  const chosen: number[][] = [];
  const colZeros = new Array(SIZE).fill(0);
  let count = 0;

  function rec(r: number): boolean {
    if (r === SIZE) {
      // check col balance + col triples + vertical sign constraints
      for (let c = 0; c < SIZE; c++) {
        if (colZeros[c] !== HALF) return false;
        for (let k = 0; k + 2 < SIZE; k++) {
          if (chosen[k][c] === chosen[k + 1][c] && chosen[k][c] === chosen[k + 2][c]) return false;
        }
      }
      // vertical signs
      for (const s of signs) {
        const ra = Math.floor(s.a / SIZE);
        const ca = s.a % SIZE;
        const rb = Math.floor(s.b / SIZE);
        const cb = s.b % SIZE;
        if (ca === cb && Math.abs(ra - rb) === 1) {
          const va = chosen[ra][ca];
          const vb = chosen[rb][cb];
          const ok = s.type === '=' ? va === vb : va !== vb;
          if (!ok) return false;
        }
      }
      count++;
      return count >= cap;
    }
    for (const p of rowCands[r]) {
      // column count + vertical triple pruning
      let ok2 = true;
      for (let c = 0; c < SIZE; c++) {
        const z = colZeros[c] + (p[c] === 0 ? 1 : 0);
        const o = r + 1 - z;
        if (z > HALF || o > HALF) { ok2 = false; break; }
        if (r >= 2 && chosen[r - 1][c] === p[c] && chosen[r - 2][c] === p[c]) { ok2 = false; break; }
        // vertical sign check for this row with prev row
        if (r > 0) {
          // check sign between row r-1 col c and row r col c
          const ia = (r - 1) * SIZE + c;
          const ib = r * SIZE + c;
          for (const s of signs) {
            if ((s.a === ia && s.b === ib) || (s.a === ib && s.b === ia)) {
              const va = chosen[r - 1][c];
              const vb = p[c];
              const ok3 = s.type === '=' ? va === vb : va !== vb;
              if (!ok3) { ok2 = false; break; }
            }
          }
          if (!ok2) break;
        }
      }
      if (!ok2) continue;

      chosen.push(p);
      for (let c = 0; c < SIZE; c++) if (p[c] === 0) colZeros[c]++;
      const done = rec(r + 1);
      chosen.pop();
      for (let c = 0; c < SIZE; c++) if (p[c] === 0) colZeros[c]--;
      if (done) return true;
    }
    return false;
  }

  rec(0);
  return count;
}

export function generateTango(seed: string, difficulty: Difficulty): TangoPuzzle {
  const rng = new Rng(`tango:${seed}:${difficulty}`);

  for (let attempt = 0; attempt < 50; attempt++) {
    const solution = fillTango(rng);
    if (!solution) continue;

    // Build candidate signs: choose adjacent pairs and assign = or × based on solution
    const allPairs: Array<{ a: number; b: number }> = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (c + 1 < SIZE) allPairs.push({ a: r * SIZE + c, b: r * SIZE + c + 1 });
        if (r + 1 < SIZE) allPairs.push({ a: r * SIZE + c, b: (r + 1) * SIZE + c });
      }
    }
    rng.shuffle(allPairs);

    const signs: TangoSign[] = [];
    const givens = new Array<number>(SIZE * SIZE).fill(-1);

    // Choose signs that are informative (not all neutral)
    const numSigns = rng.intRange(8, 14);
    for (let k = 0; k < Math.min(numSigns, allPairs.length); k++) {
      const { a, b } = allPairs[k];
      signs.push({
        a, b,
        type: solution[a] === solution[b] ? '=' : 'x',
      });
    }

    // Try to make it uniquely solvable via signs alone first
    const solvedWithSignsOnly = solveTango(givens, signs);
    if (solvedWithSignsOnly && solvedWithSignsOnly.every((v, i) => v === solution[i])) {
      const count = countTangoSolutions(givens, signs, 2);
      if (count === 1) {
        return { type: 'tango', seed, difficulty, givens, signs, solution };
      }
    }

    // Add givens incrementally until rule-solver succeeds
    const workGivens = new Array<number>(SIZE * SIZE).fill(-1);
    const order2 = rng.shuffle(Array.from({ length: SIZE * SIZE }, (_, i) => i));
    let ok = false;
    for (const idx of order2) {
      workGivens[idx] = solution[idx];
      const solved = solveTango(workGivens, signs);
      if (solved && solved.every((v, i) => v === solution[i])) {
        // check uniqueness
        const cnt = countTangoSolutions(workGivens, signs, 2);
        if (cnt === 1) {
          ok = true;
          // dig back: remove previously added givens
          break;
        }
      }
    }
    if (!ok) continue;

    // Now try to dig (remove givens while still uniquely solvable)
    const finalGivens = workGivens.slice();
    const addedOrder = order2.filter((i) => finalGivens[i] !== -1);
    for (const idx of addedOrder) {
      const save = finalGivens[idx];
      finalGivens[idx] = -1;
      const solved = solveTango(finalGivens, signs);
      if (!solved || !solved.every((v, i) => v === solution[i])) {
        finalGivens[idx] = save; // can't remove
      }
    }

    const finalCount = countTangoSolutions(finalGivens, signs, 2);
    if (finalCount !== 1) continue;

    return { type: 'tango', seed, difficulty, givens: finalGivens, signs, solution };
  }

  throw new Error(`tango generation failed for seed=${seed} difficulty=${difficulty}`);
}

export function tangoHint(
  puzzle: TangoPuzzle,
  state: number[],
): { cell: number; value: number } | null {
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== -1 && state[i] !== puzzle.solution[i]) {
      return { cell: i, value: puzzle.solution[i] };
    }
  }
  for (let i = 0; i < state.length; i++) {
    if (state[i] === -1) return { cell: i, value: puzzle.solution[i] };
  }
  return null;
}
