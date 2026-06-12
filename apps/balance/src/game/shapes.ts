import { Rng } from '@daily-logic/engine';

export type ShapeKind = 'rect' | 'circle' | 'poly';

export interface ShapeDef {
  kind: ShapeKind;
  /** rect: w/h. circle: r. poly: r + sides. Logical px. */
  w: number;
  h: number;
  r: number;
  sides: number;
  density: number;
  color: string;
  deep: string;
}

const PALETTE: [string, string][] = [
  ['#ff8fa3', '#e05c77'], // rose
  ['#ffc46b', '#e09a2e'], // amber
  ['#7ed9a7', '#3fae74'], // mint
  ['#8db8ff', '#5a85e0'], // sky
  ['#c79bff', '#9a66e0'], // lilac
  ['#ffe066', '#e0b62e'], // lemon
];

/**
 * The daily set: 8 wobbly-but-stackable shapes, identical worldwide.
 * Bounded sizes/densities keep every set physically solvable.
 */
export function dailyShapes(date: string): ShapeDef[] {
  const rng = new Rng(`balance:${date}`);
  const out: ShapeDef[] = [];
  for (let i = 0; i < 8; i++) {
    const kindRoll = rng.next();
    const [color, deep] = PALETTE[rng.int(PALETTE.length)]!;
    if (kindRoll < 0.45) {
      out.push({
        kind: 'rect',
        w: rng.intRange(46, 96),
        h: rng.intRange(22, 44),
        r: 0,
        sides: 0,
        density: 0.0012 + rng.next() * 0.0012,
        color,
        deep,
      });
    } else if (kindRoll < 0.72) {
      out.push({
        kind: 'circle',
        w: 0,
        h: 0,
        r: rng.intRange(16, 26),
        sides: 0,
        density: 0.0012 + rng.next() * 0.001,
        color,
        deep,
      });
    } else {
      out.push({
        kind: 'poly',
        w: 0,
        h: 0,
        r: rng.intRange(20, 30),
        sides: rng.intRange(3, 5),
        density: 0.0012 + rng.next() * 0.0012,
        color,
        deep,
      });
    }
  }
  return out;
}
