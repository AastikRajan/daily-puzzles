/**
 * Deterministic seeded PRNG for puzzle generation.
 * FNV-1a (32-bit) string hash expands a seed string into four 32-bit words
 * feeding sfc32. Portable: both algorithms are a handful of integer ops,
 * trivially re-implementable in Swift/Kotlin for native ports.
 *
 * The engine MUST NOT use the global random API anywhere (enforced by a
 * test) — all randomness flows through an Rng instance so identical seeds
 * yield identical puzzles.
 */

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
}

export class Rng {
  private next01: () => number;

  constructor(seed: string) {
    const a = fnv1a(seed + ':a');
    const b = fnv1a(seed + ':b');
    const c = fnv1a(seed + ':c');
    const d = fnv1a(seed + ':d');
    this.next01 = sfc32(a, b, c, d);
    // discard first few outputs to decorrelate from the hash
    for (let i = 0; i < 12; i++) this.next01();
  }

  /** Float in [0, 1). */
  next(): number {
    return this.next01();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next01() * n);
  }

  /** Integer in [lo, hi] inclusive. */
  intRange(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next01() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** In-place Fisher–Yates; returns the same array for chaining. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
}
