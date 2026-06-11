/**
 * Rule-based binairo (takuzu) solver. Cells: -1 unknown, 0, 1.
 * Rules: no three identical adjacent; each row/col has equal 0s and 1s;
 * all rows distinct; all columns distinct.
 *
 * Deductions used (all sound):
 *  - pairs/gaps: XX_ / _XX / X_X force the blank
 *  - count: a line with n/2 of one value fills the rest with the other
 *  - line completion: for lines with â‰¤ LINE_ENUM_MAX unknowns, enumerate all
 *    legal completions (count + no-triples + uniqueness vs completed lines)
 *    and fix cells where every completion agrees.
 * If these complete the grid, every step was forced â‡’ the solution is unique.
 */

const LINE_ENUM_MAX = 6;

export function solveBinairo(cells: number[], size: number): number[] | null {
  const g = cells.slice();

  const getRow = (r: number) => {
    const line = new Array<number>(size);
    for (let c = 0; c < size; c++) line[c] = g[r * size + c];
    return line;
  };
  const getCol = (c: number) => {
    const line = new Array<number>(size);
    for (let r = 0; r < size; r++) line[r] = g[r * size + c];
    return line;
  };
  const setRow = (r: number, line: number[]) => {
    for (let c = 0; c < size; c++) g[r * size + c] = line[c];
  };
  const setCol = (c: number, line: number[]) => {
    for (let r = 0; r < size; r++) g[r * size + c] = line[r];
  };

  function lineValid(line: number[]): boolean {
    let z = 0;
    let o = 0;
    for (let i = 0; i < size; i++) {
      if (line[i] === 0) z++;
      else if (line[i] === 1) o++;
      if (i >= 2 && line[i] !== -1 && line[i] === line[i - 1] && line[i] === line[i - 2]) {
        return false;
      }
    }
    return z <= size / 2 && o <= size / 2;
  }

  /** All legal completions of a line (assumes â‰¤ LINE_ENUM_MAX unknowns). */
  function completions(line: number[], otherComplete: number[][]): number[][] {
    const blanks: number[] = [];
    for (let i = 0; i < size; i++) if (line[i] === -1) blanks.push(i);
    const out: number[][] = [];
    const total = 1 << blanks.length;
    for (let m = 0; m < total; m++) {
      const cand = line.slice();
      for (let b = 0; b < blanks.length; b++) cand[blanks[b]] = (m >> b) & 1;
      if (!lineValid(cand)) continue;
      let z = 0;
      for (const v of cand) if (v === 0) z++;
      if (z !== size / 2) continue;
      if (otherComplete.some((oc) => oc.every((v, i) => v === cand[i]))) continue;
      out.push(cand);
    }
    return out;
  }

  function pass(): boolean | 'stuck' {
    let progress = false;
    // pairs / gaps / counts on rows and cols
    for (let axis = 0; axis < 2; axis++) {
      for (let idx = 0; idx < size; idx++) {
        const line = axis === 0 ? getRow(idx) : getCol(idx);
        let changed = false;
        for (let i = 0; i < size; i++) {
          if (line[i] !== -1) continue;
          if (i >= 2 && line[i - 1] !== -1 && line[i - 1] === line[i - 2]) {
            line[i] = 1 - line[i - 1]; changed = true;
          } else if (i + 2 < size && line[i + 1] !== -1 && line[i + 1] === line[i + 2]) {
            line[i] = 1 - line[i + 1]; changed = true;
          } else if (i >= 1 && i + 1 < size && line[i - 1] !== -1 && line[i - 1] === line[i + 1]) {
            line[i] = 1 - line[i - 1]; changed = true;
          }
        }
        let z = 0; let o = 0;
        for (const v of line) { if (v === 0) z++; else if (v === 1) o++; }
        if (z === size / 2 && o < size / 2) {
          for (let i = 0; i < size; i++) if (line[i] === -1) { line[i] = 1; changed = true; }
        } else if (o === size / 2 && z < size / 2) {
          for (let i = 0; i < size; i++) if (line[i] === -1) { line[i] = 0; changed = true; }
        }
        if (changed) {
          if (!lineValid(line)) return 'stuck';
          if (axis === 0) setRow(idx, line); else setCol(idx, line);
          progress = true;
        }
      }
    }
    if (progress) return true;

    // line-completion intersection
    for (let axis = 0; axis < 2; axis++) {
      const completed: number[][] = [];
      for (let idx = 0; idx < size; idx++) {
        const line = axis === 0 ? getRow(idx) : getCol(idx);
        if (line.every((v) => v !== -1)) completed.push(line);
      }
      for (let idx = 0; idx < size; idx++) {
        const line = axis === 0 ? getRow(idx) : getCol(idx);
        const unknowns = line.filter((v) => v === -1).length;
        if (unknowns === 0 || unknowns > LINE_ENUM_MAX) continue;
        const comps = completions(line, completed);
        if (comps.length === 0) return 'stuck';
        let changed = false;
        for (let i = 0; i < size; i++) {
          if (line[i] !== -1) continue;
          const v0 = comps[0][i];
          if (comps.every((c) => c[i] === v0)) { line[i] = v0; changed = true; }
        }
        if (changed) {
          if (axis === 0) setRow(idx, line); else setCol(idx, line);
          return true;
        }
      }
    }
    return false;
  }

  for (;;) {
    if (g.every((v) => v !== -1)) return g;
    const r = pass();
    if (r === 'stuck' || r === false) return null;
  }
}

/**
 * Independent solution counter for tests: enumerate all valid row patterns
 * (balanced, no triples), DFS over rows compatible with the givens while
 * pruning column counts/triples, check column constraints at the leaf.
 */
export function countBinairoSolutions(cells: number[], size: number, cap = 2): number {
  // all balanced, triple-free rows of length `size`
  const patterns: number[][] = [];
  const row = new Array<number>(size);
  (function gen(i: number, zeros: number): void {
    if (zeros > size / 2 || i - zeros > size / 2) return;
    if (i === size) {
      patterns.push(row.slice());
      return;
    }
    for (const v of [0, 1]) {
      if (i >= 2 && row[i - 1] === v && row[i - 2] === v) continue;
      row[i] = v;
      gen(i + 1, zeros + (v === 0 ? 1 : 0));
    }
  })(0, 0);

  // per-row candidate patterns matching givens
  const rowCands: number[][][] = [];
  for (let r = 0; r < size; r++) {
    const cands = patterns.filter((p) => {
      for (let c = 0; c < size; c++) {
        const v = cells[r * size + c];
        if (v !== -1 && p[c] !== v) return false;
      }
      return true;
    });
    if (cands.length === 0) return 0;
    rowCands.push(cands);
  }

  const chosen: number[][] = [];
  const colZeros = new Array(size).fill(0);
  let count = 0;

  function rec(r: number): boolean {
    if (r === size) {
      // distinct columns + exact balance + column triples
      for (let a = 0; a < size; a++) {
        if (colZeros[a] !== size / 2) return false; // unbalanced: not a solution
      }
      for (let a = 0; a < size; a++) {
        for (let b = a + 1; b < size; b++) {
          let same = true;
          for (let k = 0; k < size; k++) {
            if (chosen[k][a] !== chosen[k][b]) { same = false; break; }
          }
          if (same) return false;
        }
      }
      count++;
      return count >= cap;
    }
    outer: for (const p of rowCands[r]) {
      // distinct rows
      for (let k = 0; k < r; k++) {
        let same = true;
        for (let c = 0; c < size; c++) {
          if (chosen[k][c] !== p[c]) { same = false; break; }
        }
        if (same) continue outer;
      }
      // column count + triple pruning
      for (let c = 0; c < size; c++) {
        const z = colZeros[c] + (p[c] === 0 ? 1 : 0);
        const o = r + 1 - z;
        if (z > size / 2 || o > size / 2) continue outer;
        if (r >= 2 && chosen[r - 1][c] === p[c] && chosen[r - 2][c] === p[c]) continue outer;
      }
      chosen.push(p);
      for (let c = 0; c < size; c++) if (p[c] === 0) colZeros[c]++;
      const abort = rec(r + 1);
      chosen.pop();
      for (let c = 0; c < size; c++) if (p[c] === 0) colZeros[c]--;
      if (abort) return true;
    }
    return false;
  }

  rec(0);
  return count;
}

