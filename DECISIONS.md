# Decisions Log

Decisions made autonomously, with rationale. Newest at bottom.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | npm workspaces (no pnpm/turbo) | Zero extra tooling for a 2-package repo; works everywhere incl. CI and the future Mac day. |
| 2 | PRNG = sfc32 seeded by FNV-1a hash of `daily-logic:{date}:{type}:{difficulty}` | Tiny, fast, statistically solid, trivially portable to Swift/Kotlin for native port. No `Math.random` allowed in engine. |
| 3 | Difficulty schedule by weekday: Mon–Tue easy, Wed–Fri medium, Sat–Sun hard | NYT-crossword-style weekly rhythm; predictable for players, exercises all grader tiers daily-ish. |
| 4 | All boards rendered as **SVG** (not canvas) | Grids are ≤ 15×15 = trivial node counts; SVG gives crisp DPI-independent lines, CSS-themeable colors, per-cell DOM events, and accessibility hooks. Canvas would only pay off at much larger element counts. |
| 5 | Nonogram uniqueness via "line-solvable only" acceptance | Guarantees unique AND logic-only-solvable puzzles in one check; standard practice (see RESEARCH.md). |
| 6 | Kakuro layouts from curated templates per difficulty | Free-form layout generation is the slowest, least controllable part; templates keep generation deterministic & <200 ms while digit fill + uniqueness stays seeded per day. |
| 7 | zustand for app state | ~1 kB, no boilerplate, selector-based renders keep grid interactions at 60 fps; context+reducer would re-render whole trees. |
| 8 | Plain seed-loop property tests (no fast-check) | The property space is "N seeds × tiers"; fast-check's shrinking adds nothing for deterministic seeded generation and would obscure failing seeds. Failing seed is printed directly. |
| 9 | Test volume: full 200/type gate behind `ENGINE_FULL=1`, 40/type in default `npm test` | Keeps dev loop fast; gate run executed and recorded in CHANGELOG before phase close. |
| 10 | Streak model: per-type streak + overall daily streak (any-puzzle and all-five tracked separately) | Matches spec's per-type streaks while enabling a strong "completed all 5" meta-goal for retention. |
| 11 | Hints: 3/day shared across all puzzles (not per puzzle) | Spec says "3 hints/day"; shared pool creates a real economy and matches the daily-ritual framing. |
| 12 | Timer counts up, hideable, pauses when tab hidden | Standard daily-puzzle behavior; hidden-tab pause keeps shared times honest. |
| 13 | Vite + React 18 + TS strict; engine compiled by Vite directly via workspace source import | No separate build step for engine during dev; `tsc` still typechecks engine independently. |
| 14 | Killer Sudoku: easy tier keeps ~10 given digits, medium ~4, hard 0 | Pure-cage killer is brutal for casual players; givens are the standard difficulty lever alongside cage size. |
| 15 | Archive: yesterday free, older dates show Premium stub modal | Per spec; gating implemented in date-routing so it also covers deep links. |
| 16 | **Design pivot → "Arcade Pop"** (overrides the original NYT-restraint direction) | User reviewed phase-2 screenshots and explicitly asked for a modern, game-like, 3D/tactile look. New system: per-game gradient accents, glass panels, Duolingo-style 3D edge buttons (box-shadow + translateY), Baloo 2 display + Nunito body, springy entrances, confetti wins. Real WebGL 3D rejected: hurts Lighthouse ≥95 gate and adds nothing to grid play; depth comes from CSS (cheap, Capacitor-safe). |
| 17 | canvas-confetti for win celebration | 5 kB, canvas-based (no DOM thrash), respects reduced-motion via our gate. |
