# Changelog

## Phase 2 — App shell + Sudoku (in progress)
- React/Vite app shell: editorial-newsprint design system (Fraunces + Schibsted Grotesk, paper/ink tokens, per-type accents), light/dark/sepia/midnight themes.
- Home: masthead with date, five puzzle cards (accent glyphs, difficulty dots, streak flame, solved state), live countdown to next puzzles.
- Sudoku end-to-end: SVG board, selection/peer/same-digit highlights, keypad with remaining counts, pencil marks, undo/redo, erase, error-check toggle, shared 3-hints/day, hideable timer, win overlay + cell wave animation + haptics.
- Session persistence (resume mid-puzzle after reload), completion log, streak math.
- Stats / Settings / Archive (yesterday free, premium-stub gate) views.
- Playwright: full sudoku playthrough (mistake → undo → pencil → hint → solve → win → home state) and persistence test, both green on Chromium mobile profile.
- Screenshot gallery in `artifacts/screens` (3 sizes × light/dark); fixed keypad overflow found in review.

## Phase 1 — Engine package ✅
- Pure TS engine `@daily-logic/engine`: zero deps, no Math.random (test-enforced), sfc32 + FNV-1a seeded determinism, daily seed (`daily-logic:{date}:{type}`) + weekday difficulty rhythm.
- **Sudoku**: bitmask MRV counting solver; technique grader (singles / locked candidates+pairs / beyond); symmetric clue removal targeting exact tier. ~9ms avg.
- **Killer**: cage partition (no in-cage repeats), magic-block sum pruning solver with node budget, seed givens + reveal-repair to uniqueness; difficulty = given count + cage size. ~100ms avg.
- **Nonogram**: memoized line-solver; accept only line-solvable patterns ⇒ unique + human-solvable; smoothing pass for easy/medium; independent row-DFS counter for tests. ~7ms avg.
- **Kakuro**: carved symmetric layouts (run 2-9 + connectivity validation), low/high personality digit fill for magic sums, reveal-repair givens; independent counting solver. ~4ms avg.
- **Binairo**: backtracking full grid; rule-based solver (pairs/gaps/counts/line-completion) for dig-while-solvable; independent row-pattern counter. 6/8/10 sizes.
- Quick suite (42/type) + daily determinism + full gate (200/type) via `npm run test:full`.
