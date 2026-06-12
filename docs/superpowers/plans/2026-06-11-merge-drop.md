# Merge Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Suika-style physics merge game ("Merge Drop") in `apps/drop` — a React + matter-js canvas app where players drop orbs that merge on collision to score points.

**Architecture:** Single-page React app with a fullscreen `<canvas>` managed by a `GameEngine` class (matter-js physics + custom 2D canvas renderer). React owns UI chrome (HUD, overlays, settings drawer); the canvas engine owns the game loop, physics bodies, and rendering. Communication flows via a stable `useGameEngine` hook and the `window.__mergeDrop` debug API.

**Tech Stack:** React 18, matter-js 0.20, canvas-confetti, zustand, vite + vite-plugin-pwa, TypeScript strict, Playwright (chromium/Pixel 7 only).

---

## File Map

| File | Responsibility |
|------|---------------|
| `apps/drop/index.html` | Entry HTML |
| `apps/drop/vite.config.ts` | Vite + PWA config, port 5176/4176 |
| `apps/drop/tsconfig.json` | TS config extending base |
| `apps/drop/playwright.config.ts` | E2E config, port 4176, Pixel 7 chromium |
| `apps/drop/scripts/gen-icons.mjs` | Glossy orb PWA icon generator |
| `apps/drop/src/styles/global.css` | Candy-palette Arcade Pop design system |
| `apps/drop/src/lib/storage.ts` | localStorage wrapper (copied pattern) |
| `apps/drop/src/lib/haptics.ts` | Vibration API wrapper (copied pattern) |
| `apps/drop/src/lib/audio.ts` | WebAudio synth blips (merge/land sounds) |
| `apps/drop/src/state/settings.ts` | Zustand settings store (theme/sound/motion) |
| `apps/drop/src/game/orbs.ts` | Orb tier definitions (11 tiers: radius, color, score) |
| `apps/drop/src/game/renderer.ts` | Canvas 2D renderer (glossy orbs, faces, particles, HUD) |
| `apps/drop/src/game/engine.ts` | GameEngine class: matter-js setup, merge logic, game-over detection, debug API |
| `apps/drop/src/components/GameCanvas.tsx` | React canvas wrapper, pointer events, resize observer |
| `apps/drop/src/components/GameOverlay.tsx` | Game-over overlay with score, best, Play Again btn |
| `apps/drop/src/components/SettingsDrawer.tsx` | Settings panel (theme/sound/motion) |
| `apps/drop/src/components/HUD.tsx` | Score/best score chips + settings button |
| `apps/drop/src/App.tsx` | Root component, theme application, layout |
| `apps/drop/src/main.tsx` | React entry point |
| `apps/drop/e2e/game.spec.ts` | Playwright E2E tests + screenshot captures |

---

### Task 1: Project scaffold — tsconfig, vite config, index.html

**Files:**
- Create: `apps/drop/tsconfig.json`
- Create: `apps/drop/vite.config.ts`
- Create: `apps/drop/index.html`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "noEmit": true
  },
  "include": ["src", "vite.config.ts", "e2e", "playwright.config.ts", "scripts"]
}
```

- [ ] **Step 2: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Merge Drop',
        short_name: 'Merge Drop',
        description: 'Drop and merge colorful orbs in this satisfying physics puzzle game.',
        theme_color: '#ff6eb4',
        background_color: '#fff0fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  base: './',
  server: { port: 5176 },
  preview: { port: 4176 },
  build: { target: 'es2022' },
});
```

- [ ] **Step 3: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#ff6eb4" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <title>Merge Drop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Verify TypeScript recognizes the config**

Run from `apps/drop`:
```
npx tsc --noEmit
```
Expected: error about missing `src/main.tsx` (not a config error — that's fine at this stage).

---

### Task 2: Design system CSS — candy Arcade Pop palette

**Files:**
- Create: `apps/drop/src/styles/global.css`

- [ ] **Step 1: Create global.css with candy palette**

```css
/* ————— Merge Drop design system: CANDY POP —————
   Candy-sweet physics game UI: vivid pink-to-orange gradient,
   glassy raised panels, Duolingo-style 3D buttons, springy micro-interactions. */

:root {
  /* stage */
  --bg-a: #fff0fa;
  --bg-b: #ffe8f5;
  --bg-c: #fff4e8;
  --surface: rgba(255, 255, 255, 0.88);
  --surface-solid: #ffffff;
  --surface-edge: rgba(255, 255, 255, 0.7);
  --ink: #2d1a2e;
  --ink-soft: rgba(45, 26, 46, 0.64);
  --ink-faint: rgba(45, 26, 46, 0.4);
  --line: rgba(45, 26, 46, 0.1);
  --line-strong: rgba(45, 26, 46, 0.45);
  --card-shadow:
    0 2px 6px rgba(220, 80, 140, 0.08),
    0 12px 32px rgba(220, 80, 140, 0.14);
  --edge-shadow: rgba(200, 60, 120, 0.22);

  /* candy accent */
  --c-brand: #ff6eb4;
  --c-brand-deep: #d94d8c;
  --c-brand-soft: rgba(255, 110, 180, 0.14);
  --g-brand: linear-gradient(135deg, #ff6eb4, #ff9a44);

  --c-orange: #ff9a44;
  --c-orange-deep: #d97020;

  --good: #1fc77b;
  --bad: #ff5e62;

  --font-display: 'Baloo 2 Variable', 'Comic Sans MS', cursive;
  --font-ui: 'Nunito Variable', 'Segoe UI', sans-serif;

  --radius: 22px;
  --radius-small: 14px;

  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);

  color-scheme: light;
}

[data-theme='dark'] {
  --bg-a: #1a0a1e;
  --bg-b: #2a0f2e;
  --bg-c: #1e0f10;
  --surface: rgba(42, 18, 50, 0.85);
  --surface-solid: #2a1232;
  --surface-edge: rgba(255, 255, 255, 0.08);
  --ink: #ffe8f8;
  --ink-soft: rgba(255, 232, 248, 0.66);
  --ink-faint: rgba(255, 232, 248, 0.4);
  --line: rgba(255, 232, 248, 0.12);
  --line-strong: rgba(255, 232, 248, 0.5);
  --card-shadow:
    0 2px 6px rgba(0, 0, 0, 0.3),
    0 14px 36px rgba(0, 0, 0, 0.4);
  --edge-shadow: rgba(0, 0, 0, 0.55);

  --c-brand: #ff8fcb;
  --c-brand-deep: #d96098;
  --c-brand-soft: rgba(255, 143, 203, 0.2);
  --g-brand: linear-gradient(135deg, #ff8fcb, #ffb060);

  --good: #3ddd92;
  --bad: #ff7a76;

  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg-a: #1a0a1e;
    --bg-b: #2a0f2e;
    --bg-c: #1e0f10;
    --surface: rgba(42, 18, 50, 0.85);
    --surface-solid: #2a1232;
    --surface-edge: rgba(255, 255, 255, 0.08);
    --ink: #ffe8f8;
    --ink-soft: rgba(255, 232, 248, 0.66);
    --ink-faint: rgba(255, 232, 248, 0.4);
    --line: rgba(255, 232, 248, 0.12);
    --line-strong: rgba(255, 232, 248, 0.5);
    --card-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 14px 36px rgba(0,0,0,0.4);
    --edge-shadow: rgba(0,0,0,0.55);
    --c-brand: #ff8fcb;
    --c-brand-deep: #d96098;
    --c-brand-soft: rgba(255,143,203,0.2);
    --g-brand: linear-gradient(135deg, #ff8fcb, #ffb060);
    --good: #3ddd92;
    --bad: #ff7a76;
    color-scheme: dark;
  }
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html { height: 100%; }

body {
  margin: 0;
  min-height: 100%;
  background: var(--bg-a);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overscroll-behavior-y: none;
  user-select: none;
  -webkit-user-select: none;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(38% 30% at 12% 8%, var(--bg-b) 0%, transparent 70%),
    radial-gradient(45% 36% at 88% 16%, var(--bg-c) 0%, transparent 72%),
    radial-gradient(50% 42% at 50% 100%, var(--bg-b) 0%, transparent 75%),
    var(--bg-a);
}

#root {
  max-width: 500px;
  margin: 0 auto;
  padding: var(--safe-top) 0 var(--safe-bottom);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

button:focus-visible {
  outline: 3px solid var(--c-brand);
  outline-offset: 2px;
  border-radius: 8px;
}

h1, h2, h3 { margin: 0; font-weight: inherit; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

[data-motion='off'] *, [data-motion='off'] *::before, [data-motion='off'] *::after {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}

/* ————— shared tactile primitives ————— */

.panel {
  background: var(--surface);
  border: 1px solid var(--surface-edge);
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.btn3d {
  --btn: var(--c-brand);
  --btn-deep: var(--c-brand-deep);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--btn);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.02em;
  padding: 14px 26px;
  border-radius: 18px;
  box-shadow: 0 5px 0 var(--btn-deep), 0 10px 18px rgba(0,0,0,0.18);
  transition: transform 110ms ease, box-shadow 110ms ease;
  user-select: none;
  -webkit-user-select: none;
}

.btn3d:active {
  transform: translateY(5px);
  box-shadow: 0 0 0 var(--btn-deep), 0 2px 6px rgba(0,0,0,0.15);
}

.btn3d.ghost {
  background: var(--surface-solid);
  color: var(--ink);
  box-shadow: 0 5px 0 var(--edge-shadow), 0 10px 18px rgba(0,0,0,0.1);
}

.btn3d.ghost:active {
  box-shadow: 0 0 0 var(--edge-shadow), 0 2px 6px rgba(0,0,0,0.1);
}

.hairline {
  border: none;
  border-top: 1px solid var(--line);
  margin: 0;
}
```

- [ ] **Step 2: No test needed for CSS — continue to next task.**

---

### Task 3: Utility libs — storage, haptics, audio

**Files:**
- Create: `apps/drop/src/lib/storage.ts`
- Create: `apps/drop/src/lib/haptics.ts`
- Create: `apps/drop/src/lib/audio.ts`

- [ ] **Step 1: Create storage.ts (identical pattern to apps/web)**

```ts
const PREFIX = 'md.v1.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or privacy mode — app keeps working in-memory
  }
}
```

- [ ] **Step 2: Create haptics.ts**

```ts
export function tap(): void {
  try { navigator.vibrate?.(10); } catch { /* unsupported */ }
}

export function pop(): void {
  try { navigator.vibrate?.([15, 20, 15]); } catch { /* unsupported */ }
}
```

- [ ] **Step 3: Create audio.ts**

```ts
/** Tiny WebAudio synth — blips on merge/land. Silently no-ops when AudioContext unavailable. */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, duration: number, gain: number): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();
    osc.connect(gainNode);
    gainNode.connect(ac.destination);
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ac.currentTime + duration);
    gainNode.gain.setValueAtTime(gain, ac.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch {
    // AudioContext suspended or unavailable
  }
}

/** Called when two orbs merge — pitch scales with tier. */
export function playMerge(tier: number): void {
  // tier 1-11 maps to 300-1200 Hz
  const freq = 300 + (tier - 1) * 90;
  blip(freq, 0.12, 0.18);
}

/** Called when an orb lands on the stack. */
export function playLand(): void {
  blip(180, 0.08, 0.1);
}
```

- [ ] **Step 4: No isolated unit tests for these libs — they're thin wrappers. Continue.**

---

### Task 4: Settings store

**Files:**
- Create: `apps/drop/src/state/settings.ts`

- [ ] **Step 1: Create settings.ts**

```ts
import { create } from 'zustand';
import { load, save } from '../lib/storage';

export type ThemeChoice = 'auto' | 'light' | 'dark';

interface SettingsState {
  theme: ThemeChoice;
  reducedMotion: boolean;
  sound: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const stored = load<Partial<SettingsState>>('settings', {});

export const useSettings = create<SettingsState>((set, get) => ({
  theme: stored.theme ?? 'auto',
  reducedMotion: stored.reducedMotion ?? false,
  sound: stored.sound ?? false,  // default OFF per spec
  set: (patch) => {
    set(patch);
    const { theme, reducedMotion, sound } = get();
    save('settings', { theme, reducedMotion, sound });
  },
}));

export function applyTheme(theme: ThemeChoice, reducedMotion: boolean): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.motion = reducedMotion ? 'off' : 'on';
}
```

- [ ] **Step 2: No isolated test needed — behavior covered by E2E.**

---

### Task 5: Orb tier definitions

**Files:**
- Create: `apps/drop/src/game/orbs.ts`

- [ ] **Step 1: Create orbs.ts with 11 tiers**

Radius grows by ×1.22 per tier. Base radius (tier 1) = 18px (logical). Each tier gets a distinct vivid candy color.

```ts
export interface OrbTier {
  tier: number;          // 1–11
  radius: number;        // logical px
  color: string;         // main fill color
  colorLight: string;    // highlight color (lighter)
  colorDark: string;     // shadow color (darker)
  label: string;         // emoji/letter shown on face (for debugging)
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
```

- [ ] **Step 2: No isolated test — orb values covered by E2E integration.**

---

### Task 6: Canvas renderer

**Files:**
- Create: `apps/drop/src/game/renderer.ts`

- [ ] **Step 1: Create renderer.ts**

```ts
import type { OrbTier } from './orbs';
import { getTier } from './orbs';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  color: string;
  life: number;   // 0-1, decreasing
}

export interface FloatText {
  x: number; y: number;
  text: string;
  color: string;
  vy: number;
  life: number;  // 0-1
}

export interface OrbVisual {
  id: number;
  x: number;
  y: number;
  r: number;         // actual radius
  tier: number;
  scaleAnim: number; // 1 = normal, >1 = pop-in, <1 = squash
  angle: number;     // for subtle rotation
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
  }

  resize(cssW: number, cssH: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = cssW * dpr;
    this.canvas.height = cssH * dpr;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  /** CSS pixels → canvas pixels */
  private s(n: number): number { return n * this.dpr; }

  clear(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  drawOrb(orb: OrbVisual): void {
    const { ctx } = this;
    const tierData: OrbTier = getTier(orb.tier);
    const cx = this.s(orb.x);
    const cy = this.s(orb.y);
    const r = this.s(orb.r * orb.scaleAnim);

    ctx.save();
    ctx.translate(cx, cy);

    // Main radial gradient (shaded orb)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
    grad.addColorStop(0, tierData.colorLight);
    grad.addColorStop(0.45, tierData.color);
    grad.addColorStop(1, tierData.colorDark);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glossy highlight (upper-left crescent)
    const highlight = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.02, -r * 0.18, -r * 0.22, r * 0.55);
    highlight.addColorStop(0, 'rgba(255,255,255,0.72)');
    highlight.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    // Face: two dot eyes + smile arc (only if radius > 12px)
    if (r >= this.s(12)) {
      const eyeR = Math.max(this.s(1.5), r * 0.1);
      const eyeOff = r * 0.28;
      const eyeY = -r * 0.18;

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(-eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOff, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = Math.max(this.s(1), r * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.32, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawDangerLine(y: number, containerLeft: number, containerRight: number, pulse: boolean): void {
    const { ctx } = this;
    const cy = this.s(y);
    const cl = this.s(containerLeft);
    const cr = this.s(containerRight);

    ctx.save();
    ctx.strokeStyle = pulse ? '#ff5e62' : 'rgba(255,94,98,0.45)';
    ctx.lineWidth = this.s(pulse ? 2.5 : 1.5);
    ctx.setLineDash([this.s(8), this.s(6)]);
    if (pulse) {
      ctx.shadowColor = '#ff5e62';
      ctx.shadowBlur = this.s(6);
    }
    ctx.beginPath();
    ctx.moveTo(cl, cy);
    ctx.lineTo(cr, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawGhostOrb(x: number, y: number, r: number, tier: number): void {
    const { ctx } = this;
    const tierData: OrbTier = getTier(tier);
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.arc(this.s(x), this.s(y), this.s(r), 0, Math.PI * 2);
    ctx.fillStyle = tierData.color;
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = tierData.colorLight;
    ctx.lineWidth = this.s(1.5);
    ctx.stroke();
    ctx.restore();
  }

  drawDropLine(x: number, fromY: number, toY: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = this.s(1);
    ctx.setLineDash([this.s(4), this.s(4)]);
    ctx.beginPath();
    ctx.moveTo(this.s(x), this.s(fromY));
    ctx.lineTo(this.s(x), this.s(toY));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawParticles(particles: Particle[]): void {
    const { ctx } = this;
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(this.s(p.x), this.s(p.y), this.s(p.r), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  drawFloatTexts(texts: FloatText[]): void {
    const { ctx } = this;
    for (const ft of texts) {
      ctx.save();
      ctx.globalAlpha = ft.life;
      ctx.font = `bold ${this.s(16)}px var(--font-display, 'Baloo 2 Variable', cursive)`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, this.s(ft.x), this.s(ft.y));
      ctx.restore();
    }
  }

  /** Draw the glassy container walls/floor (cosmetic — physics walls are matter bodies) */
  drawContainer(left: number, right: number, top: number, bottom: number, wallW: number): void {
    const { ctx } = this;
    const l = this.s(left);
    const r = this.s(right);
    const t = this.s(top);
    const b = this.s(bottom);
    const w = this.s(wallW);

    // Glassy wall overlay — left
    const lgLeft = ctx.createLinearGradient(l - w, 0, l, 0);
    lgLeft.addColorStop(0, 'rgba(255,200,240,0.18)');
    lgLeft.addColorStop(1, 'rgba(255,200,240,0.05)');
    ctx.fillStyle = lgLeft;
    ctx.fillRect(l - w, t, w, b - t);

    // Right wall
    const lgRight = ctx.createLinearGradient(r, 0, r + w, 0);
    lgRight.addColorStop(0, 'rgba(255,200,240,0.05)');
    lgRight.addColorStop(1, 'rgba(255,200,240,0.18)');
    ctx.fillStyle = lgRight;
    ctx.fillRect(r, t, w, b - t);

    // Floor
    const lgFloor = ctx.createLinearGradient(0, b, 0, b + w);
    lgFloor.addColorStop(0, 'rgba(255,200,240,0.22)');
    lgFloor.addColorStop(1, 'rgba(255,200,240,0.05)');
    ctx.fillStyle = lgFloor;
    ctx.fillRect(l - w, b, (r - l) + w * 2, w);

    // Bright inner edge lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = this.s(1.5);
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l, b);
    ctx.lineTo(r, b);
    ctx.lineTo(r, t);
    ctx.stroke();
    ctx.restore();
  }
}
```

- [ ] **Step 2: No isolated renderer test — covered visually by screenshots in E2E.**

---

### Task 7: Game engine

**Files:**
- Create: `apps/drop/src/game/engine.ts`

This is the largest file. It owns matter-js setup, the game loop, collision/merge logic, danger-line timer, score, combo, and the `window.__mergeDrop` debug API.

- [ ] **Step 1: Create engine.ts**

```ts
import Matter from 'matter-js';
import confetti from 'canvas-confetti';
import { ORB_TIERS, getTier, randomSpawnTier } from './orbs';
import { Renderer, type Particle, type FloatText, type OrbVisual } from './renderer';
import { tap, pop } from '../lib/haptics';
import { playMerge, playLand } from '../lib/audio';

export type GamePhase = 'playing' | 'over';

export interface GameState {
  score: number;
  best: number;
  phase: GamePhase;
  currentTier: number;
  nextTier: number;
}

interface OrbBody extends Matter.Body {
  orbTier: number;
  orbId: number;
  landedAt: number | null;
  scaleAnim: number;
  squashUntil: number;
}

const WALL_W = 24;           // logical px — thickness of static walls
const DANGER_Y_FRAC = 0.15;  // danger line = 15% from top of container
const DANGER_GRACE = 1500;   // ms before game-over triggers
const DROP_COOLDOWN = 400;   // ms between drops
const COMBO_WINDOW = 1200;   // ms for combo chain

// Confetti colors per high tier (tiers 9-11)
const HIGH_TIER_CONFETTI: Record<number, string[]> = {
  9:  ['#ff6ec4', '#ffd84d', '#ffffff'],
  10: ['#ff5e62', '#ff9a44', '#ffffff'],
  11: ['#ffd84d', '#ffb030', '#ff6eb4', '#ffffff'],
};

export class GameEngine {
  private engine: Matter.Engine;
  private runner: Matter.Runner;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;

  // Container bounds in logical CSS px
  private contLeft = 0;
  private contRight = 0;
  private contTop = 0;
  private contBottom = 0;

  // Walls/floor bodies (recreated on resize)
  private walls: Matter.Body[] = [];

  // Active orb bodies map id → OrbBody
  private orbBodies = new Map<number, OrbBody>();
  private nextOrbId = 1;

  // Game state
  private score = 0;
  private best = 0;
  private phase: GamePhase = 'playing';
  private currentTier: number;
  private nextTier: number;

  // Input state
  private aimX: number | null = null;
  private lastDropTime = 0;

  // Danger line
  private dangerStartTime: number | null = null;

  // Combo
  private comboCount = 0;
  private lastMergeTime = 0;

  // Particles + float texts
  private particles: Particle[] = [];
  private floatTexts: FloatText[] = [];

  // Pop-in anim queue: id → { startTime, duration }
  private popAnims = new Map<number, { startTime: number; duration: number }>();

  // Confetti tiers already celebrated
  private celebrated = new Set<number>();

  // Sound flag (updated from outside)
  private soundEnabled = false;

  // Animation loop
  private rafId = 0;
  private lastFrameTime = 0;

  // State-change callback (React re-render trigger)
  private onStateChange: ((s: GameState) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, best: number) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.best = best;
    this.currentTier = randomSpawnTier();
    this.nextTier = randomSpawnTier();

    this.engine = Matter.Engine.create({ gravity: { y: 1.8 } });
    this.runner = Matter.Runner.create();

    this.setupCollisionHandler();
    this.setupDebugAPI();
    this.start();
  }

  // ——— Public API ———

  setSoundEnabled(v: boolean): void { this.soundEnabled = v; }
  setOnStateChange(cb: (s: GameState) => void): void { this.onStateChange = cb; }

  getState(): GameState {
    return {
      score: this.score,
      best: this.best,
      phase: this.phase,
      currentTier: this.currentTier,
      nextTier: this.nextTier,
    };
  }

  resize(cssW: number, cssH: number): void {
    this.renderer.resize(cssW, cssH);

    const pad = WALL_W;
    this.contLeft = pad;
    this.contRight = cssW - pad;
    this.contTop = 0;
    this.contBottom = cssH;

    this.rebuildWalls(cssW, cssH);
  }

  setAimX(cssX: number): void {
    const r = getTier(this.currentTier).radius;
    this.aimX = Math.max(this.contLeft + r, Math.min(this.contRight - r, cssX));
  }

  clearAim(): void { this.aimX = null; }

  drop(cssX: number): void {
    if (this.phase !== 'playing') return;
    const now = Date.now();
    if (now - this.lastDropTime < DROP_COOLDOWN) return;
    this.lastDropTime = now;

    const tier = this.currentTier;
    const tierData = getTier(tier);
    const r = tierData.radius;
    const clampedX = Math.max(this.contLeft + r, Math.min(this.contRight - r, cssX));
    const spawnY = this.contTop + r + 4;

    this.spawnOrb(tier, clampedX, spawnY);

    this.currentTier = this.nextTier;
    this.nextTier = randomSpawnTier();
    this.aimX = null;
    this.emitState();
  }

  restart(): void {
    // Remove all orb bodies
    const bodies = [...this.orbBodies.values()];
    Matter.World.remove(this.engine.world, bodies);
    this.orbBodies.clear();

    // Reset state
    this.score = 0;
    this.phase = 'playing';
    this.currentTier = randomSpawnTier();
    this.nextTier = randomSpawnTier();
    this.aimX = null;
    this.lastDropTime = 0;
    this.dangerStartTime = null;
    this.comboCount = 0;
    this.lastMergeTime = 0;
    this.particles = [];
    this.floatTexts = [];
    this.popAnims.clear();
    this.celebrated.clear();

    this.emitState();
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    Matter.Runner.stop(this.runner);
    Matter.Engine.clear(this.engine);
    // Clean up debug API
    delete (window as unknown as Record<string, unknown>)['__mergeDrop'];
  }

  // ——— Private: setup ———

  private rebuildWalls(cssW: number, cssH: number): void {
    if (this.walls.length) Matter.World.remove(this.engine.world, this.walls);

    const opts = { isStatic: true, restitution: 0.1, friction: 0.3 };
    const halfW = WALL_W / 2;
    const leftWall  = Matter.Bodies.rectangle(halfW,           cssH / 2, WALL_W, cssH * 2, opts);
    const rightWall = Matter.Bodies.rectangle(cssW - halfW,    cssH / 2, WALL_W, cssH * 2, opts);
    const floor     = Matter.Bodies.rectangle(cssW / 2,        cssH + halfW, cssW * 2, WALL_W, opts);

    this.walls = [leftWall, rightWall, floor];
    Matter.World.add(this.engine.world, this.walls);
  }

  private spawnOrb(tier: number, x: number, y: number): OrbBody {
    const tierData = getTier(tier);
    const r = tierData.radius;
    const id = this.nextOrbId++;

    const body = Matter.Bodies.circle(x, y, r, {
      restitution: 0.1,
      friction: 0.5,
      frictionAir: 0.008,
      density: 0.004 * tier,   // heavier tiers sink faster
    }) as OrbBody;

    body.orbTier = tier;
    body.orbId = id;
    body.landedAt = null;
    body.scaleAnim = 1;
    body.squashUntil = 0;

    Matter.World.add(this.engine.world, body);
    this.orbBodies.set(id, body);

    // Pop-in animation
    this.popAnims.set(id, { startTime: Date.now(), duration: 220 });

    return body;
  }

  private setupCollisionHandler(): void {
    Matter.Events.on(this.engine, 'collisionStart', (evt) => {
      const now = Date.now();
      const processed = new Set<number>();

      for (const pair of evt.pairs) {
        const a = pair.bodyA as OrbBody;
        const b = pair.bodyB as OrbBody;

        if (!a.orbId || !b.orbId) {
          // One of them is a wall/floor — play land sound
          if (a.orbId || b.orbId) {
            const orb = (a.orbId ? a : b);
            if (!orb.landedAt) {
              orb.landedAt = now;
              if (this.soundEnabled) playLand();
              orb.squashUntil = now + 120;
            }
          }
          continue;
        }

        if (processed.has(a.orbId) || processed.has(b.orbId)) continue;
        if (a.orbTier !== b.orbTier) continue;

        const tier = a.orbTier;
        if (tier >= 11) continue;  // max tier — no merge

        processed.add(a.orbId);
        processed.add(b.orbId);

        const mx = (a.position.x + b.position.x) / 2;
        const my = (a.position.y + b.position.y) / 2;

        // Remove both bodies (schedule to avoid physics re-entrant issues)
        Matter.World.remove(this.engine.world, [a, b]);
        this.orbBodies.delete(a.orbId);
        this.orbBodies.delete(b.orbId);

        const newTier = tier + 1;
        this.spawnOrb(newTier, mx, my);

        // Score + combo
        const comboExpired = (now - this.lastMergeTime) > COMBO_WINDOW;
        if (comboExpired) this.comboCount = 0;
        this.comboCount++;
        this.lastMergeTime = now;

        const baseScore = getTier(newTier).score;
        const combo = this.comboCount > 1 ? this.comboCount : 1;
        const earned = baseScore * combo;
        this.score += earned;
        if (this.score > this.best) this.best = this.score;

        // Particles
        this.spawnParticles(mx, my, getTier(newTier).color, 14);

        // Float text
        const label = combo > 1 ? `+${earned} ×${combo}` : `+${earned}`;
        this.floatTexts.push({
          x: mx, y: my - getTier(newTier).radius - 8,
          text: label,
          color: getTier(newTier).colorLight,
          vy: -1.4,
          life: 1,
        });

        // Haptics + audio
        tap();
        if (this.soundEnabled) playMerge(newTier);

        // Confetti for tiers 9-11 (first time each)
        if (newTier >= 9 && !this.celebrated.has(newTier)) {
          this.celebrated.add(newTier);
          const colors = HIGH_TIER_CONFETTI[newTier] ?? ['#ffd84d'];
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors, scalar: 0.9 });
        }

        this.emitState();
      }
    });
  }

  private setupDebugAPI(): void {
    (window as unknown as Record<string, unknown>)['__mergeDrop'] = {
      score: () => this.score,
      forceGameOver: () => this.triggerGameOver(),
      dropAt: (xFrac: number) => {
        const x = this.contLeft + xFrac * (this.contRight - this.contLeft);
        this.drop(x);
      },
    };
  }

  // ——— Private: game loop ———

  private start(): void {
    Matter.Runner.run(this.runner, this.engine);
    const loop = (time: number) => {
      const dt = Math.min(time - this.lastFrameTime, 50);
      this.lastFrameTime = time;
      this.tick(dt, time);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame((t) => {
      this.lastFrameTime = t;
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private tick(dt: number, now: number): void {
    if (this.phase === 'over') {
      this.renderFrame(now);
      return;
    }

    this.updateParticles(dt);
    this.updateFloatTexts(dt);
    this.checkDangerLine(now);
    this.renderFrame(now);
  }

  private checkDangerLine(now: number): void {
    const dangerY = this.contTop + (this.contBottom - this.contTop) * DANGER_Y_FRAC;
    let anyAbove = false;

    for (const body of this.orbBodies.values()) {
      const topOfOrb = body.position.y - getTier(body.orbTier).radius;
      // "resting above" = orb top is above danger line AND body is mostly still
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (topOfOrb < dangerY && speed < 0.5) {
        anyAbove = true;
        break;
      }
    }

    if (anyAbove) {
      if (this.dangerStartTime === null) this.dangerStartTime = now;
      else if (now - this.dangerStartTime > DANGER_GRACE) {
        this.triggerGameOver();
      }
    } else {
      this.dangerStartTime = null;
    }
  }

  private triggerGameOver(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    Matter.Runner.stop(this.runner);
    pop();
    this.emitState();
  }

  private renderFrame(now: number): void {
    this.renderer.clear();

    const dangerY = this.contTop + (this.contBottom - this.contTop) * DANGER_Y_FRAC;
    const dangerPulse = this.dangerStartTime !== null && ((now - this.dangerStartTime) % 600) < 300;

    // Container walls (cosmetic)
    this.renderer.drawContainer(
      this.contLeft, this.contRight,
      this.contTop, this.contBottom,
      WALL_W,
    );

    // Danger line
    this.renderer.drawDangerLine(dangerY, this.contLeft, this.contRight, dangerPulse);

    // Ghost + drop line
    if (this.aimX !== null && this.phase === 'playing') {
      const r = getTier(this.currentTier).radius;
      const ghostY = this.contTop + r + 4;
      this.renderer.drawDropLine(this.aimX, ghostY + r, this.contBottom);
      this.renderer.drawGhostOrb(this.aimX, ghostY, r, this.currentTier);
    }

    // Orbs
    const orbVisuals: OrbVisual[] = [];
    for (const body of this.orbBodies.values()) {
      const anim = this.popAnims.get(body.orbId);
      let scale = 1;
      if (anim) {
        const t = Math.min(1, (now - anim.startTime) / anim.duration);
        if (t >= 1) {
          this.popAnims.delete(body.orbId);
        } else {
          // Overshoot spring: scale 0 → 1.18 → 1
          scale = t < 0.6
            ? (t / 0.6) * 1.18
            : 1.18 - (((t - 0.6) / 0.4) * 0.18);
        }
      }
      // Squash on land
      if (body.squashUntil > now) {
        const t = 1 - (body.squashUntil - now) / 120;
        scale *= 1 - Math.sin(t * Math.PI) * 0.12;
      }

      orbVisuals.push({
        id: body.orbId,
        x: body.position.x,
        y: body.position.y,
        r: getTier(body.orbTier).radius,
        tier: body.orbTier,
        scaleAnim: scale,
        angle: body.angle,
      });
    }

    // Sort back-to-front by tier (larger orbs behind smaller)
    orbVisuals.sort((a, b) => b.tier - a.tier);
    for (const ov of orbVisuals) this.renderer.drawOrb(ov);

    // Particles + float texts
    this.renderer.drawParticles(this.particles);
    this.renderer.drawFloatTexts(this.floatTexts);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 3,
        color,
        life: 1,
      });
    }
  }

  private updateParticles(dt: number): void {
    const decay = dt * 0.002;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;  // gravity on particles
      p.life -= decay;
      return p.life > 0;
    });
  }

  private updateFloatTexts(dt: number): void {
    const decay = dt * 0.0018;
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.y += ft.vy;
      ft.life -= decay;
      return ft.life > 0;
    });
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }
}
```

- [ ] **Step 2: No isolated unit test — covered by E2E.**

---

### Task 8: React components — GameCanvas, HUD, overlays, App

**Files:**
- Create: `apps/drop/src/components/GameCanvas.tsx`
- Create: `apps/drop/src/components/HUD.tsx`
- Create: `apps/drop/src/components/GameOverlay.tsx`
- Create: `apps/drop/src/components/SettingsDrawer.tsx`
- Create: `apps/drop/src/App.tsx`
- Create: `apps/drop/src/main.tsx`

- [ ] **Step 1: Create GameCanvas.tsx**

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, type GameState } from '../game/engine';
import { load, save } from '../lib/storage';

interface Props {
  onStateChange: (s: GameState) => void;
  soundEnabled: boolean;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

export default function GameCanvas({ onStateChange, soundEnabled, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const best = load<number>('best', 0);
    const engine = new GameEngine(canvas, best);
    engineRef.current = engine;
    engine.setSoundEnabled(soundEnabled);
    engine.setOnStateChange((s) => {
      if (s.score > load<number>('best', 0)) save('best', s.score);
      onStateChange(s);
    });

    const ro = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      engine.resize(parent.clientWidth, parent.clientHeight);
    });
    ro.observe(canvas.parentElement!);

    // Initial size
    const parent = canvas.parentElement!;
    engine.resize(parent.clientWidth, parent.clientHeight);

    // Pause when tab hidden
    const onVis = () => {
      // Matter.js runner handles its own timing; no explicit pause needed
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      engine.destroy();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sound flag without recreating engine
  useEffect(() => {
    engineRef.current?.setSoundEnabled(soundEnabled);
  }, [soundEnabled, engineRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.setAimX(e.clientX - rect.left);
  }, [engineRef]);

  const onPointerLeave = useCallback(() => {
    engineRef.current?.clearAim();
  }, [engineRef]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.drop(e.clientX - rect.left);
  }, [engineRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    />
  );
}
```

- [ ] **Step 2: Create HUD.tsx**

```tsx
import type { GameState } from '../game/engine';
import { getTier } from '../game/orbs';

interface Props {
  state: GameState;
  onSettings: () => void;
}

export default function HUD({ state, onSettings }: Props) {
  const nextData = getTier(state.nextTier);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px 6px',
      width: '100%',
      flexShrink: 0,
    }}>
      {/* Score chip */}
      <div className="panel" style={{ padding: '6px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score</div>
        <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{state.score}</div>
      </div>

      {/* Next orb preview */}
      <div className="panel" style={{ padding: '6px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next</div>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${nextData.colorLight}, ${nextData.color} 55%, ${nextData.colorDark})`,
          boxShadow: `0 2px 6px ${nextData.colorDark}55`,
        }} />
      </div>

      {/* Best + settings */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div className="panel" style={{ padding: '6px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Best</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{state.best}</div>
        </div>
        <button
          onClick={onSettings}
          aria-label="Settings"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--surface-edge)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}
        >⚙️</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create GameOverlay.tsx**

```tsx
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { GameState } from '../game/engine';
import { useSettings } from '../state/settings';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverlay({ state, onRestart }: Props) {
  const reducedMotion = useSettings(s => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    confetti({ particleCount: 60, spread: 80, origin: { y: 0.5 },
      colors: ['#ff6eb4', '#ff9a44', '#ffd84d', '#ffffff'], scalar: 0.85 });
  }, [reducedMotion]);

  return (
    <div
      data-testid="game-over-overlay"
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(20,5,24,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
        animation: 'fadeIn 300ms ease',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
      <div className="panel" style={{ padding: '32px 28px', textAlign: 'center', maxWidth: 280, width: '100%' }}>
        <div style={{ fontSize: 40, marginBottom: 4 }}>🍬</div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 28, color: 'var(--ink)', marginBottom: 8,
        }}>Game Over</h2>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: 15 }}>
          Your stack reached the top!
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
          <div className="panel" style={{ padding: '10px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Score</div>
            <div data-testid="final-score" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{state.score}</div>
          </div>
          <div className="panel" style={{ padding: '10px 20px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Best</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--c-brand)' }}>{state.best}</div>
          </div>
        </div>

        <button
          data-testid="play-again-btn"
          className="btn3d"
          style={{ width: '100%', '--btn': 'var(--c-brand)', '--btn-deep': 'var(--c-brand-deep)' } as React.CSSProperties}
          onClick={onRestart}
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create SettingsDrawer.tsx**

```tsx
import { useSettings, applyTheme, type ThemeChoice } from '../state/settings';

interface Props {
  onClose: () => void;
}

export default function SettingsDrawer({ onClose }: Props) {
  const { theme, sound, reducedMotion, set } = useSettings();

  const setTheme = (t: ThemeChoice) => {
    set({ theme: t });
    applyTheme(t, reducedMotion);
  };

  const THEMES: ThemeChoice[] = ['auto', 'light', 'dark'];

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(10,0,14,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 20,
    }} onClick={onClose}>
      <div
        className="panel"
        style={{ width: '100%', padding: '24px 20px 32px', borderRadius: '24px 24px 0 0', maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>Settings</h2>
          <button onClick={onClose} style={{ fontSize: 22, lineHeight: 1 }} aria-label="Close settings">✕</button>
        </div>

        <hr className="hairline" style={{ marginBottom: 18 }} />

        {/* Theme */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>Theme</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEMES.map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 12,
                  background: theme === t ? 'var(--c-brand)' : 'var(--surface)',
                  color: theme === t ? '#fff' : 'var(--ink)',
                  border: `1px solid ${theme === t ? 'transparent' : 'var(--surface-edge)'}`,
                  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Sound */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}>Sound effects</span>
          <button
            role="switch"
            aria-checked={sound}
            onClick={() => set({ sound: !sound })}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: sound ? 'var(--c-brand)' : 'var(--line-strong)',
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: sound ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left 200ms',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>

        {/* Reduced motion */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontFamily: 'var(--font-ui)', color: 'var(--ink)' }}>Reduced motion</span>
          <button
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => {
              const next = !reducedMotion;
              set({ reducedMotion: next });
              applyTheme(theme, next);
            }}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: reducedMotion ? 'var(--c-brand)' : 'var(--line-strong)',
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: reducedMotion ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left 200ms',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create App.tsx**

```tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import './styles/global.css';
import { GameEngine, type GameState } from './game/engine';
import { useSettings, applyTheme } from './state/settings';
import { load } from './lib/storage';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import GameOverlay from './components/GameOverlay';
import SettingsDrawer from './components/SettingsDrawer';

const INIT_STATE: GameState = {
  score: 0,
  best: load<number>('best', 0),
  phase: 'playing',
  currentTier: 1,
  nextTier: 2,
};

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(INIT_STATE);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, reducedMotion, sound } = useSettings();

  // Apply theme on mount + changes
  useEffect(() => {
    applyTheme(theme, reducedMotion);
  }, [theme, reducedMotion]);

  // Also apply on system preference change
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, reducedMotion);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, reducedMotion]);

  const handleRestart = useCallback(() => {
    engineRef.current?.restart();
    setGameState(s => ({ ...s, score: 0, phase: 'playing' }));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100dvh', maxWidth: 500, position: 'relative' }}>
      <HUD state={gameState} onSettings={() => setShowSettings(true)} />

      {/* Game container — fills remaining space */}
      <div style={{
        flex: 1,
        position: 'relative',
        margin: '0 12px 12px',
        borderRadius: 20,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,240,250,0.6) 0%, rgba(255,248,240,0.6) 100%)',
        boxShadow: '0 4px 24px rgba(220,80,140,0.15), inset 0 0 0 1.5px rgba(255,255,255,0.4)',
      }}>
        <GameCanvas
          onStateChange={setGameState}
          soundEnabled={sound}
          engineRef={engineRef}
        />
        {gameState.phase === 'over' && (
          <GameOverlay state={gameState} onRestart={handleRestart} />
        )}
      </div>

      {showSettings && <SettingsDrawer onClose={() => setShowSettings(false)} />}
    </div>
  );
}
```

- [ ] **Step 6: Create main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

### Task 9: PWA icon generator script

**Files:**
- Create: `apps/drop/scripts/gen-icons.mjs`
- Create: `apps/drop/public/.gitkeep` (ensure public dir exists)

- [ ] **Step 1: Create gen-icons.mjs with glossy orb mark on pink→orange gradient**

```mjs
/**
 * Generates all PWA icons — glossy candy orb mark on pink→orange gradient.
 * Run: node scripts/gen-icons.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');
mkdirSync(pub, { recursive: true });

/** Glossy orb SVG mark */
const mark = (inset, rx = 24) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff6eb4"/>
        <stop offset="0.55" stop-color="#ff8a50"/>
        <stop offset="1" stop-color="#ff9a44"/>
      </linearGradient>
      <radialGradient id="orb" cx="38%" cy="35%" r="55%">
        <stop offset="0" stop-color="#fff8fc" stop-opacity="1"/>
        <stop offset="0.4" stop-color="#ff6eb4" stop-opacity="1"/>
        <stop offset="1" stop-color="#cc3d7a" stop-opacity="1"/>
      </radialGradient>
      <radialGradient id="gloss" cx="38%" cy="28%" r="42%">
        <stop offset="0" stop-color="rgba(255,255,255,0.75)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <!-- Main orb -->
      <circle cx="50" cy="52" r="34" fill="url(#orb)"/>
      <!-- Gloss overlay -->
      <circle cx="50" cy="52" r="34" fill="url(#gloss)"/>
      <!-- Cute face: eyes -->
      <circle cx="42" cy="48" r="3.5" fill="rgba(0,0,0,0.5)"/>
      <circle cx="58" cy="48" r="3.5" fill="rgba(0,0,0,0.5)"/>
      <!-- Smile -->
      <path d="M42 57 Q50 64 58 57" stroke="rgba(0,0,0,0.45)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;

writeFileSync(join(pub, 'favicon.svg'), mark(0).trim());

const targets = [
  { file: 'pwa-192.png', size: 192, inset: 0, rx: 24, transparent: true },
  { file: 'pwa-512.png', size: 512, inset: 0, rx: 24, transparent: true },
  { file: 'maskable-512.png', size: 512, inset: 10, rx: 0, transparent: false },
  { file: 'apple-touch-icon.png', size: 180, inset: 0, rx: 0, transparent: false },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${mark(t.inset, t.rx)}`,
  );
  const buf = await page.screenshot({ omitBackground: t.transparent });
  writeFileSync(join(pub, t.file), buf);
  console.log('wrote', t.file);
}
await browser.close();
console.log('icons done');
```

- [ ] **Step 2: Ensure public dir exists**

Create `apps/drop/public/.gitkeep` (empty file — git won't track empty dirs).

---

### Task 10: Playwright E2E config + tests

**Files:**
- Create: `apps/drop/playwright.config.ts`
- Create: `apps/drop/e2e/game.spec.ts`

- [ ] **Step 1: Create playwright.config.ts**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4176',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:test && npm run preview -- --port 4176 --strictPort',
    url: 'http://localhost:4176',
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
});
```

- [ ] **Step 2: Create e2e/game.spec.ts**

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS = path.join(__dirname, '..', '..', '..', 'artifacts', 'drop');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

test('game loads and canvas is visible', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // HUD score chip is present
  await expect(page.getByText('Score')).toBeVisible();
});

test('drop orbs and score increases', async ({ page }) => {
  await page.goto('./');

  // Wait for game engine to expose debug API
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)['__mergeDrop'] !== 'undefined');

  const initialScore = await page.evaluate(() => (window as unknown as Record<string, {score: () => number}>>)['__mergeDrop'].score());
  expect(initialScore).toBe(0);

  // Drop 8 orbs at varied x positions
  const drops = [0.2, 0.35, 0.5, 0.65, 0.8, 0.3, 0.55, 0.45];
  for (const xFrac of drops) {
    await page.evaluate((x) => {
      (window as unknown as Record<string, {dropAt: (x: number) => void}>>)['__mergeDrop'].dropAt(x);
    }, xFrac);
    await page.waitForTimeout(500); // let physics settle between drops
  }

  // Wait extra for merges to settle
  await page.waitForTimeout(2000);

  const score = await page.evaluate(() => (window as unknown as Record<string, {score: () => number}>>)['__mergeDrop'].score());
  expect(score).toBeGreaterThan(0);
});

test('forceGameOver shows overlay and restart resets score', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)['__mergeDrop'] !== 'undefined');

  // Drop a few orbs first so score > 0
  for (const xFrac of [0.3, 0.5, 0.7]) {
    await page.evaluate((x) => {
      (window as unknown as Record<string, {dropAt: (x: number) => void}>>)['__mergeDrop'].dropAt(x);
    }, xFrac);
    await page.waitForTimeout(450);
  }

  // Force game over
  await page.evaluate(() => {
    (window as unknown as Record<string, {forceGameOver: () => void}>>)['__mergeDrop'].forceGameOver();
  });

  // Overlay must appear
  const overlay = page.locator('[data-testid="game-over-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 5000 });

  // Play Again button must be present
  const playAgain = page.locator('[data-testid="play-again-btn"]');
  await expect(playAgain).toBeVisible();

  // Click Play Again and verify score resets to 0
  await playAgain.click();
  await page.waitForTimeout(200);

  const scoreAfterRestart = await page.evaluate(() => (window as unknown as Record<string, {score: () => number}>>)['__mergeDrop'].score());
  expect(scoreAfterRestart).toBe(0);

  // Overlay should be gone
  await expect(overlay).not.toBeVisible();
});

test('screenshots — light gameplay', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)['__mergeDrop'] !== 'undefined');

  for (const xFrac of [0.25, 0.5, 0.6, 0.4, 0.7, 0.35]) {
    await page.evaluate((x) => {
      (window as unknown as Record<string, {dropAt: (x: number) => void}>>)['__mergeDrop'].dropAt(x);
    }, xFrac);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png'), fullPage: false });
});

test('screenshots — dark gameplay', async ({ page }) => {
  await page.goto('./');
  // Force dark theme
  await page.evaluate(() => document.documentElement.dataset['theme'] = 'dark');

  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)['__mergeDrop'] !== 'undefined');

  for (const xFrac of [0.3, 0.55, 0.45, 0.65, 0.25, 0.5]) {
    await page.evaluate((x) => {
      (window as unknown as Record<string, {dropAt: (x: number) => void}>>)['__mergeDrop'].dropAt(x);
    }, xFrac);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png'), fullPage: false });
});

test('screenshots — game over screen', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)['__mergeDrop'] !== 'undefined');

  for (const xFrac of [0.3, 0.5, 0.7]) {
    await page.evaluate((x) => {
      (window as unknown as Record<string, {dropAt: (x: number) => void}>>)['__mergeDrop'].dropAt(x);
    }, xFrac);
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => {
    (window as unknown as Record<string, {forceGameOver: () => void}>>)['__mergeDrop'].forceGameOver();
  });

  await page.locator('[data-testid="game-over-overlay"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400); // let overlay animate in

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-light.png'), fullPage: false });
});
```

---

### Task 11: Generate icons + run all gates

- [ ] **Step 1: From apps/drop, generate PWA icons**

```
node scripts/gen-icons.mjs
```
Expected: writes `public/favicon.svg`, `pwa-192.png`, `pwa-512.png`, `maskable-512.png`, `apple-touch-icon.png`.

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Run build**

```
npx vite build
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Run E2E tests**

```
npx playwright test
```
Expected: all tests pass; screenshots written to `D:\Code\first game\artifacts\drop\`.

- [ ] **Step 5: Read and visually verify screenshots**

Open each screenshot:
- `artifacts/drop/gameplay-mobile-light.png` — glossy orbs, readable HUD, pink container, no canvas blur
- `artifacts/drop/gameplay-mobile-dark.png` — dark theme, same quality
- `artifacts/drop/gameover-mobile-light.png` — overlay visible, Play Again button present

If orbs look flat/blurry: check DPR handling in `renderer.ts` `resize()` and `s()` methods. If container proportions wrong: adjust flex layout in `App.tsx`.

- [ ] **Step 6: Commit everything**

```bash
git add apps/drop/
git add artifacts/drop/
git commit -m "feat(drop): Merge Drop — Suika-style physics merge game"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| matter-js physics, canvas 2D renderer | Task 6, 7 |
| 11 orb tiers, radial gradient glossy orbs, cute faces | Task 5, 6 |
| Spawn queue tiers 1-5, ghost orb, next preview | Task 7, 8 |
| Pointer move/release input, clamped, touch + mouse | Task 8 |
| Merge on same-tier collision, pop animation, particles | Task 7 |
| Score += tier value (triangular), combo multiplier 1.2s | Task 7 |
| Haptics tap on merge | Task 7 |
| Confetti tiers 9-11 first time | Task 7 |
| Danger line 1.5s → game over | Task 7 |
| Game over overlay, score/best, Play Again btn | Task 8 |
| localStorage best score | Task 3, 8 |
| window.__mergeDrop debug API | Task 7 |
| Settings: sound/motion/theme | Task 4, 8 |
| PWA, vite-plugin-pwa, icons | Task 1, 9 |
| Dev port 5176, preview 4176 | Task 1 |
| TypeScript clean, vite build green, playwright pass | Task 11 |
| Screenshots to artifacts/drop/ | Task 10 |

All requirements covered. No placeholders found. Types are consistent across tasks (`GameState`, `OrbVisual`, `Particle`, `FloatText` defined in Tasks 6/7 and used correctly in Tasks 8+).

