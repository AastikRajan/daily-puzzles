export interface OrbTier {
  tier: number;          // 1–11
  radius: number;        // logical px
  color: string;         // main fill color
  colorLight: string;    // highlight color (lighter)
  colorDark: string;     // shadow color (darker)
  label: string;         // letter shown on face
  score: number;         // triangular number: tier*(tier+1)/2
}

// Radii: 18, 22, 27, 33, 40, 49, 60, 73, 89, 109, 133
// Score: 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66
const TIER_COLORS: Array<[string, string, string]> = [
  ['#ff6eb4', '#ffb3d9', '#cc3d7a'],  // 1 — pink
  ['#ff9a44', '#ffc88a', '#cc6600'],  // 2 — orange
  ['#ffd84d', '#ffe98a', '#cc9a00'],  // 3 — yellow
  ['#8fe26a', '#c2f5aa', '#4ea827'],  // 4 — lime
  ['#1fc77b', '#70efb0', '#0f8a52'],  // 5 — green
  ['#38c6ff', '#90e3ff', '#0090cc'],  // 6 — sky
  ['#4f7cff', '#a0b8ff', '#2448cc'],  // 7 — blue
  ['#a44cff', '#d0a0ff', '#6a1acc'],  // 8 — purple
  ['#ff6ec4', '#ffb0e4', '#cc2e8a'],  // 9 — hot pink
  ['#ff5e62', '#ff9ea0', '#cc1e22'],  // 10 — red
  ['#ffd84d', '#fff3a0', '#cc9a00'],  // 11 — gold (large!)
];

export const ORB_TIERS: OrbTier[] = Array.from({ length: 11 }, (_, i) => {
  const t = i + 1;
  const radius = Math.round(18 * Math.pow(1.22, i));
  const [color, colorLight, colorDark] = TIER_COLORS[i]!;
  return {
    tier: t,
    radius,
    color,
    colorLight,
    colorDark,
    label: String(t),
    score: (t * (t + 1)) / 2,
  };
});

/** Random spawn tier 1-5 */
export function randomSpawnTier(): number {
  return Math.floor(Math.random() * 5) + 1;
}

/** Get tier data (1-indexed, clamps to 11) */
export function getTier(tier: number): OrbTier {
  const clamped = Math.max(1, Math.min(11, tier));
  return ORB_TIERS[clamped - 1]!;
}
