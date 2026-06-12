# Changelog

## Phase 6 — Polish + docs (in progress)
- capacitor.config.ts committed; PORTING.md with exact Mac-day iOS steps + App Store metadata (EN with ASO keywords + HI/ES/DE/JA translations in /store-metadata).
- README, DEPLOY.md (Vercel + GitHub Pages with ready Actions workflow).
- Engine hardening from full-gate run: kakuro counting solver gained a node budget + reveal-on-timeout repair (a rare hard-layout seed could previously hang generation).

## Phase 5 — PWA + performance ✅
- vite-plugin-pwa: Workbox precache (fonts/css/js/html/icons), autoUpdate SW, full manifest.
- Programmatic icon set from the brand mark (favicon.svg, 192/512, maskable, apple-touch) via scripts/gen-icons.mjs — no binary assets in the design pipeline.
- Install UX: captured beforeinstallprompt → in-app Install button; iOS Safari instruction sheet; standalone detection.
- e2e: manifest + SW control, full offline reload-and-play test.
- **Lighthouse mobile (production build): performance 96, PWA 100, accessibility 100, best practices 100.** (Speed-index fix: the masthead bob animation no longer loops infinitely.)

## Phase 4 — Daily / streak / share / stats ✅
- Spoiler-free emoji share cards: per-puzzle (performance row — mistakes burn 🟥 left→right, hints ⬜ right→left) + combined day card; Web Share API with clipboard fallback; share buttons in win overlay + home (all-five-done).
- GitHub-style 12-week completion heatmap in Stats.
- Unit tests (13) for share formatting + streak math; e2e for clipboard share content, streak increment, countdown, archive premium gate.

## Phase 3 — All five boards ✅
- Killer: dashed cage outlines + accent sums, pencil marks, digit keypad with remaining counts.
- Nonogram: drag-paint fill/X with one-undo-per-stroke, clue strike-out, 5-block tinting, mistake detection on wrong fills.
- Kakuro: ink wall tiles with sum clues, run highlighting, locked given digits.
- Binairo: tap-cycle ○/● discs with pop animation, given tiles, balance dots.
- Playwright full playthroughs for every type, all green; screenshot review pass (killer cage color softened).

## Phase 2.5 — "Arcade Pop" redesign ✅ (user-directed pivot)
- From editorial-flat to tactile hypercasual: vivid per-game gradient accents, glassy raised panels, Duolingo-style 3D edge buttons/keys/cards, gradient stage with radial color blobs, Baloo 2 + Nunito, springy staggered entrances, confetti win bursts, checkerboard box shading on sudoku boards.

## Phase 2 — App shell + Sudoku ✅
- Home (masthead, five cards with difficulty dots/streak flame/solved state, countdown), Sudoku board (selection/peer/same-digit highlights, pencil, undo/redo, erase, error-check, 3 shared hints/day, hideable timer, win overlay + cell wave + haptics), session persistence, Stats/Settings/Archive views.
- Playwright: full game e2e (mistake → undo → pencil → hint → solve → win → home), persistence test, screenshot gallery at 3 sizes × 2 themes.

## Phase 1 — Engine package ✅ (full gate: 201 puzzles/type)
- Pure TS engine, zero deps, no Math.random (test-enforced); sfc32 + FNV-1a determinism; daily seed + weekday difficulty rhythm.
- Sudoku ~9ms avg · Killer ~100ms · Nonogram ~7ms · Kakuro ~4ms · Binairo (6/8/10) — all with proven-unique solutions via independent counting solvers; killer/kakuro use seed-givens + reveal-repair against domino-swap ambiguity (see DECISIONS.md #16-18, RESEARCH.md).
