# Waves 2-4 — the 10-game studio plan (orchestrated build)

Full roster: 1 Daily Logic (shipped) · 2 Daily Word · 3 Daily Grid · 4 Merge Drop ·
5 Snake Pop (snake whose body is a match-3 board) · 6 Balance! (daily physics stacking,
Wordle-style share) · 7 Glow Golf (daily seeded 9-hole neon minigolf) · 8 Flock! (boids
herding) · 9 Echo Maze (memory maze with echo pulses) · 10 Orbit Hop (orbit-ring hopping
with gravity slingshot). Waves run ≤6 agents concurrently to keep Playwright gates reliable;
Flock/Maze/Orbit (ports 5178/5181/5182, previews 4178/4181/4182) launch as slots free up.


Orchestrator: Fable (research/plan/verify only). Engineers: Sonnet subagents, one per game.
All three live in this monorepo and REUSE: `@daily-logic/engine` (Rng, daily seeds, utc date),
the Arcade Pop design system (`apps/web/src/styles/global.css`), the session/progress/share
patterns from `apps/web`, and the test/gate discipline from PLAN.md.

| App | Game | Engine pkg | Dev port | Preview port | Screenshots |
|---|---|---|---|---|---|
| `apps/word` | **Daily Word** — Guess (Wordle-style), Anagrams (7-letter rack), Word Hunt (8×8 search) | `packages/word-engine` | 5174 | 4174 | `artifacts/word/` |
| `apps/grid` | **Daily Grid** — Queens (region n-queens), Tango (sun/moon with =/✕ signs), Zip (numbered Hamiltonian path) | `packages/grid-engine` | 5175 | 4175 | `artifacts/grid/` |
| `apps/drop` | **Merge Drop** — Suika-style physics merge, one-finger, local highscore | — (matter-js in-app) | 5176 | 4176 | `artifacts/drop/` |

## Shared rules for all agents
- Pure-TS engines, zero new deps, no `Math.random` in engines (import `Rng` from `@daily-logic/engine`).
- Daily games: same UTC date ⇒ identical puzzle (vitest-verified), unique solution proven by an independent solver/counter where applicable.
- Gates per app: `tsc --noEmit` clean → engine vitest green → `vite build` green → Playwright e2e (play each mode to completion) green → screenshots (mobile 390×844 light+dark) reviewed and fixed.
- Leverage: word lists fetched from GitHub (tabatkins/wordle-list + dwyl/english-words or dolph/dictionary popular.txt) and committed as data files; matter-js for physics; cite sources in each app's README.
- Do NOT touch root package.json / lockfile / other apps. Deps are pre-installed.

## Verification (orchestrator)
After each agent reports: I run their gates myself, look at their screenshots, and send
fix-it feedback until I'd ship it.
