# Daily Logic — Implementation Plan

> **For agentic workers:** Executed inline in-session (single autonomous builder). Phases are sequential; a phase ends only when its gate passes. Track progress in CHANGELOG.md.

**Goal:** A production-quality, fully client-side daily logic-puzzle PWA (Sudoku, Nonogram, Kakuro, Binairo, Killer Sudoku) with date-seeded deterministic puzzles, streaks/stats/share, offline play, and a Capacitor-ready architecture.

**Architecture:** npm-workspaces monorepo. `/packages/engine` is a pure, dependency-free TypeScript package containing all generators/solvers/graders and the seeded-daily logic (portable to native later). `/apps/web` is a React + Vite PWA that imports the engine and owns all UI, persistence (localStorage), and PWA concerns.

**Tech Stack:** TypeScript, React 18, Vite, vite-plugin-pwa (Workbox), zustand (state), Vitest (engine tests), Playwright (e2e), sharp (build-time icon rasterization), Capacitor (config scaffold only).

---

## File structure

```
/package.json                 # workspaces root, scripts
/tsconfig.base.json
/PLAN.md /RESEARCH.md /DECISIONS.md /CHANGELOG.md /README.md /PORTING.md /DEPLOY.md
/artifacts/                   # screenshots gallery
/packages/engine/
  src/core/rng.ts             # FNV-1a string hash → sfc32 PRNG; shuffle, int, pick
  src/core/daily.ts           # dailySeed(dateUTC, type), difficultyForDate
  src/core/types.ts           # shared Difficulty, Puzzle interfaces, Hint
  src/sudoku/{solver,generator,grader}.ts
  src/killer/{cages,solver,generator}.ts
  src/nonogram/{linesolver,generator}.ts
  src/kakuro/{layout,solver,generator}.ts
  src/binairo/{solver,generator}.ts
  src/index.ts                # engine registry: ENGINES[type].generate(seed, diff)
  test/*.test.ts              # per-type property suites + daily determinism
/apps/web/
  index.html  vite.config.ts  playwright.config.ts
  public/ (icons, favicon — generated)
  src/main.tsx  src/App.tsx   # router (hash-less, tiny view switch)
  src/state/  (zustand stores: progress, settings, stats)
  src/lib/    (storage, share, clipboard, time, haptics)
  src/views/  (Home, Puzzle, Stats, Settings, Archive)
  src/puzzles/ (SudokuBoard, KillerBoard, NonogramBoard, KakuroBoard, BinairoBoard + shared GridSVG helpers)
  src/components/ (Header, Card, Modal, Countdown, Keypad, Toolbar…)
  e2e/*.spec.ts
/capacitor.config.ts
```

## Phase 1 — Engine package (generators + solvers + graders)

Per type: deterministic `generate(seed, difficulty)` returning puzzle + unique solution.

- **Sudoku:** randomized-backtracking full grid → symmetric clue removal, keeping uniqueness (solution-counting solver with MRV + bitmask candidates, count capped at 2). Grade by solving-technique tier (singles only = easy; + locked candidates/pairs = medium; else hard) with clue-count fallback.
- **Killer Sudoku:** full grid via sudoku filler → random cage partition (sizes 2–5, orthogonally connected, no duplicate digit in cage) → uniqueness check with cage-aware solver (sum + partition pruning). Easy keeps some given cells; hard = no givens, larger cages.
- **Nonogram:** seeded random pattern at target density → clues → accept only if a pure line-solver (left/right block alignment intersection) completes the grid ⇒ unique AND human-solvable. Sizes: 10×10 easy, 15×15 medium/hard (hard = lower density/noisier pattern).
- **Kakuro:** curated wall-layout templates per difficulty → fill white cells with digits 1–9, unique within each run, via backtracking → clues = run sums → verify uniqueness by counting solutions (≤2 cap) with combination-table pruning. Reject/retry deterministically until unique.
- **Binairo:** full valid grid via backtracking (no triples, balanced rows/cols, unique rows/cols) → remove cells while rule-based solver still completes (⇒ unique). 6×6 easy, 8×8 medium, 10×10 hard.
- **Daily:** `dailySeed(date)` pure; difficulty by weekday (Mon–Tue easy, Wed–Fri medium, Sat–Sun hard).

**GATE 1:** Vitest suite green: for each of the 5 types, ≥200 generated puzzles across tiers assert (a) solvable, (b) exactly one solution (independent solver), (c) grading monotone/sane, (d) avg generation < 200 ms. Plus: same date string ⇒ byte-identical puzzle (run twice, deep-equal).

## Phase 2 — App shell + Sudoku end-to-end

Read frontend-design skill first. App shell: Home with 5 cards (type, difficulty, done-state, streak flame), date header, countdown. Sudoku view: SVG grid, keypad, pencil marks, undo/redo, error-check toggle, 3 hints/day, hideable timer, win animation + vibration. localStorage progress (resume mid-puzzle). Light/dark/auto themes via CSS custom properties.

**GATE 2:** Playwright plays today's sudoku to completion (with deliberate mistakes, hint use, undo) and asserts win state. Screenshots at 390×844 / 768×1024 / 1440×900, light+dark, reviewed by eye in /artifacts; iterate until clean.

## Phase 3 — Remaining four boards

Killer (cage outlines + sums, same keypad), Nonogram (tap/drag fill + X marks, clue strike-through), Kakuro (sum triangles, keypad), Binairo (cycle 0/1/blank). All on a shared PuzzleShell (toolbar, timer, hints, undo) so behavior is uniform.

**GATE 3:** Playwright completes one full puzzle of each type; per-type screenshot review as in Gate 2.

## Phase 4 — Daily / streak / share / stats

UTC-date puzzle identity; local-midnight countdown; yesterday playable; deeper archive behind Premium stub UI. Streak per type + overall (computed from completion log). Emoji share grids per type + combined daily card; clipboard + Web Share API. Stats view: streaks, best/avg times, completion calendar heatmap. Settings: theme (incl. 2 premium-stub themes), reduced motion, sound.

**GATE 4:** Vitest unit tests for streak math & share-string formatting; Playwright: complete puzzle → share text matches expected emoji pattern; streak increments; countdown renders; archive gate blocks.

## Phase 5 — PWA + performance

vite-plugin-pwa: precache app shell, offline play, installable (custom install button via beforeinstallprompt + iOS instructions sheet). Generated icon set (geometric/typographic mark, script-rasterized). Maskable icons, theme-color, splash. Code-split per puzzle view. Lighthouse mobile run.

**GATE 5:** Lighthouse PWA installability checks pass and performance ≥95 (mobile profile, production build, repeated until true). Offline reload works in Playwright (context.setOffline).

## Phase 6 — Polish + porting + docs

Screenshot-driven polish pass across all views/sizes/themes. PORTING.md (exact Mac-day Capacitor iOS steps + App Store metadata draft with ASO title/subtitle/keywords EN + HI/ES/DE/JA translation files in /apps/web/store-metadata/). README.md, DEPLOY.md (GitHub Pages or Vercel, exact commands). Final CHANGELOG + artifacts gallery.

**GATE 6:** All tests green from clean install (`npm ci && npm test && npm run e2e`); docs complete; final screenshot review.
