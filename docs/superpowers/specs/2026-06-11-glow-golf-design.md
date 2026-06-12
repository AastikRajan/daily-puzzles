# Glow Golf — Design Spec
**Date:** 2026-06-11  
**App:** `apps/golf`  
**Status:** Ready for implementation

---

## Overview

Glow Golf is a daily neon-themed minigolf game. Every UTC day, a deterministic seeded course of 9 holes is generated — identical for all players worldwide. Players aim and shoot via pull-back-and-release touch/mouse input, then share their scorecard.

---

## Architecture

```
apps/golf/
  src/
    engine/           # pure TS, no DOM — course gen + physics sim
      course.ts       # hole archetypes, layout generation, completability check
      physics.ts      # ball simulation: velocity, friction, wall reflection, hole capture
      types.ts        # HoleDef, WallSegment, Bumper, SandPatch, Gate, BallState
    state/
      game.ts         # zustand store: current hole, strokes, scores, phase
      settings.ts     # theme, haptics, reducedMotion (mirrors web pattern)
    lib/
      storage.ts      # copy of apps/web pattern, namespace 'gg.v1.'
      share.ts        # buildGolfShare(), shareText()
      haptics.ts      # tap/win/holeInOne wrappers
      time.ts         # formatCountdown for next-puzzle timer
    components/
      GameCanvas.tsx   # React wrapper; owns rAF loop, pointer events, draws via 2D canvas API
      HoleBanner.tsx   # "Hole 3 · Par 3" slide-in overlay
      HoleHUD.tsx      # top bar: hole index, par, stroke count chips
      ScorecardOverlay.tsx  # full-screen after hole 9: table + share button + countdown
      SinkAnimation.tsx     # CSS: ball scales into hole with confetti burst
    styles/
      global.css       # dark neon palette — adapted from web/global.css
    main.tsx           # React entry, applyTheme()
    App.tsx            # phase router: playing | scorecard
  public/
    favicon.svg / pwa-*.png / maskable-512.png / apple-touch-icon.png
  scripts/
    gen-icons.mjs      # flag-in-hole mark on green→cyan gradient (adapted)
  vite.config.ts       # PWA, base './', port 5180
  tsconfig.json
  vitest.config.ts
  playwright.config.ts
  e2e/
    golf.spec.ts
  src/engine/
    course.test.ts
```

---

## Engine Layer (`src/engine/`)

### Types (`types.ts`)

```ts
interface WallSegment { x: number; y: number; w: number; h: number; }
interface Bumper      { cx: number; cy: number; r: number; }
interface SandPatch   { x: number; y: number; w: number; h: number; friction: number; }
interface Gate        { x: number; y: number; w: number; h: number; axis: 'x'|'y'; period: number; amplitude: number; phase: number; }
interface HoleDef {
  index: number;          // 0–8
  par: number;            // 2–4
  canvasW: number; canvasH: number;
  tee: { x: number; y: number };
  hole: { x: number; y: number; r: number };
  walls: WallSegment[];   // axis-aligned rectangles, include border walls
  bumpers: Bumper[];
  sand: SandPatch[];
  gate: Gate | null;      // null for holes 0–4, present on holes 5–8
}
```

### Course Generation (`course.ts`)

5 archetypes:
- **straight** — rectangular corridor, tee at one end, hole at other; par 2
- **L-bend** — two joined corridors at right angle; par 3
- **S-curve** — three corridor segments in S shape; par 3
- **island** — wide area with central obstacle block; par 3
- **diagonal-alley** — rectangular area with angled bumpers guiding ball diagonally; par 4

Each archetype guarantees completability **by construction**: every archetype places tee and hole in a position reachable via a clear axis-aligned or single-bounce corridor. A completability verify step runs after generation to double-check: simulate ~200 shot angles/powers (uniform grid) with ≤6 strokes using the physics engine; if zero sink, log a warning and fall back to `straight` archetype for that hole. (This is the "fallback guarantee" — in practice never triggered since archetype construction ensures solvability, but it's a safety net.)

Seeding: `new Rng(\`golf:${date}:${holeIndex}\`)` — one Rng per hole, deterministic.

Gate moves sinusoidally: `pos = base + amplitude * Math.sin(2π * t / period + phase)` where `t` is elapsed game time in seconds.

### Physics (`physics.ts`)

```
FRICTION = 0.985            // per frame at 60fps baseline
RESTITUTION = 0.8           // wall bounce energy retention  
STOP_SPEED = 0.5            // px/s below this → ball stops
CAPTURE_SPEED = 80          // ball sinks if within hole.r AND speed < CAPTURE_SPEED
CAPTURE_RADIUS_MULT = 1.2   // capture zone slightly larger than visual hole
MAX_POWER_PX = 120          // drag distance → px/frame velocity scale
```

Each frame (dt in seconds):
1. Compute friction factor: `f = FRICTION^(dt*60)`
2. Apply velocity: `pos += vel * dt * 60`
3. Decay: `vel *= f`
4. Check sand: if in sand patch, extra friction `vel *= sandPatch.friction`
5. Check bumper collisions (circle vs circle); reflect velocity along normal
6. Check wall collisions (AABB); reflect velocity on penetrated axis, push ball out
7. Check gate collision same as walls (gate is a moving WallSegment)
8. Check hole capture: if `dist(ball, hole) < hole.r * CAPTURE_RADIUS_MULT && speed < CAPTURE_SPEED` → sink
9. If `speed < STOP_SPEED` → stopped

Shot: `vel = { x: cos(angle)*power, y: sin(angle)*power }` where `power = clamp(dragPx/MAX_POWER_PX, 0, 1) * MAX_SHOT_SPEED`.

`MAX_SHOT_SPEED = 18` (px/frame at 60fps, so ~1080 px/s).

---

## Rendering (`GameCanvas.tsx`)

Canvas 2D API, rAF loop. Canvas fills available viewport height minus HUD (~80px).

**Visual language (dark neon):**
- Background: `#0a0a1a` (dark felt)
- Walls: fill `#1a1a3e`, outer glow via `ctx.shadowBlur=18, shadowColor=#00ffcc`
- Sand patches: dotted texture — draw dots every 8px in a lighter sand tone `#3a2800` with slight glow `#ffaa00`
- Hole: `#000` circle, pulsing cyan ring (`shadowBlur` animated 8–24px, `#00ffcc`)
- Ball: gradient fill `#ffffff`→`#88ffee`, glow `shadowBlur=20, shadowColor=#00ffff`; motion trail: last 8 positions, decreasing alpha cyan dots
- Bumpers: stroke `#ff00aa`, fill `rgba(255,0,170,0.15)`, glow `shadowBlur=14, #ff00aa`
- Aim drag arrow: cyan dashed line from ball, dotted predicted path (single bounce), power indicator at ball

---

## Input (`GameCanvas.tsx` pointer events)

- `pointerdown` anywhere on canvas: begin drag, record start point
- `pointermove`: update drag vector → compute angle and power, show aim preview
- `pointerup`: if dragging, fire shot
- Drag direction is *opposite* of shot (pull-back metaphor): shot angle = atan2(start - current)

---

## Game State (`state/game.ts`)

Zustand store:
```ts
{ 
  date: string;
  holes: HoleDef[9];          // generated once on load
  holeIndex: number;           // 0–8
  strokes: number[9];          // strokes per hole (initialized to 0)
  phase: 'banner'|'playing'|'sinking'|'scorecard';
  ballState: BallState;
  gateT: number;               // elapsed time for gate animation
}
```

Actions: `startHole()`, `shoot(angle, power)`, `advanceHole()`, `skipHole()`, `resetToday()`

Max strokes = 8; on 8th stroke without sink, record 8 and advance.

---

## Flow

1. App load → generate 9 holes → `phase = 'banner'` for hole 0
2. Banner auto-dismisses after 1.8s (or tap) → `phase = 'playing'`
3. User shoots → physics loop runs until ball stops or sinks
4. Sink → confetti (scaled: hole-in-one = big, eagle = medium, rest = small) + haptic → `phase = 'sinking'` (400ms sink animation) → advance hole
5. After hole 9 → `phase = 'scorecard'`
6. Scorecard: table of 9 holes with stroke vs par, total vs par string (`-2 🔥`), share button, countdown to next UTC midnight

---

## Share Format

```
Glow Golf · Jun 13 · -2 ⛳
🌟⚪🟢🟠⚪⚪🟢⚪🔴
🔥 3-day streak · Best: -3
https://glow-golf.app
```

Emoji per hole: 🌟 hole-in-one, 🟢 under par, ⚪ par, 🟠 +1, 🔴 ≥+2.

---

## PWA / Vite Config

- `base: './'`, port 5180 (dev), 4180 (preview/e2e)
- PWA manifest: dark neon `theme_color: '#0a0a1a'`
- Icons: gen-icons.mjs with flag-in-hole SVG mark on green→cyan gradient

---

## Persistence (`lib/storage.ts`)

Namespace `gg.v1.`. Keys:
- `gg.v1.scores.YYYY-MM-DD` → `number[]` (9 strokes)
- `gg.v1.stats` → `{ daysPlayed: number; bestVsPar: number; streak: number; lastDate: string }`

---

## `window.__golf` Test API

```ts
window.__golf = {
  hole: () => number,            // current hole index 0-8
  strokes: () => number[],       // strokes per completed hole
  shoot: (angleRad, power01) => void,
  ballAt: () => { x: number; y: number },
  holeAt: () => { x: number; y: number },
  skipHole: () => void,
}
```

---

## Tests

### Vitest (`src/engine/course.test.ts`)
1. Determinism: same date → `deepEqual` 9 holes; two different dates differ
2. Bounds: every hole's tee and hole position inside canvas area and not inside any wall
3. Par values all in [2, 4]
4. Completability: for 10 different dates × 9 holes, the physics sim finds a sink in ≤6 shots

### Playwright (`e2e/golf.spec.ts`)
1. Page loads, hole() === 0
2. Aim at hole via shoot(), repeat ≤8 shots; hole() increments to 1
3. skipHole() × 8 more → scorecard overlay appears with 9 rows
4. Share button copies text containing 'Glow Golf'
5. Screenshots: hole gameplay (aim visible), scorecard — 390×844 dark and light → `artifacts/golf/`

---

## Completability Approach

**By construction (primary):** Each archetype places a clear corridor from tee to hole that is unobstructed by walls. Obstacles (bumpers, sand) are placed off the main corridor. A single straight shot along the corridor always reaches the hole.

**Runtime fallback (secondary):** After generation, run a quick sim: sample 36 angles × 6 power levels = 216 shots, simulate up to 6 strokes greedy (each shot aimed at remaining distance to hole). If none sink, replace with `straight` archetype. Document in console.warn.

This means every hole is always completable in at most 2 shots (straight line), and typically more interesting routes yield lower scores.

---

## Physics Tuning Values (initial, tune via play)

| Parameter | Value | Notes |
|---|---|---|
| FRICTION | 0.985/frame | At 60fps: ~40% speed remaining after 2s |
| RESTITUTION | 0.8 | Loses 20% speed per wall bounce |
| MAX_SHOT_SPEED | 18 px/frame | ~1080 px/s at 60fps |
| MAX_POWER_PX | 120 | Drag px to max power |
| STOP_SPEED | 0.5 px/frame | Ball considered stopped |
| CAPTURE_SPEED | 6 px/frame | Must slow to enter hole |
| HOLE_RADIUS | 14 | Visual hole radius in px |
| BALL_RADIUS | 10 | Ball radius in px |
| CANVAS_W | 390 | Match Pixel 7 viewport width |
| CANVAS_H | 600 | Height after HUD |
