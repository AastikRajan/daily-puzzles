# Research Notes

Findings gathered before/while building. Sources cited inline.

## PWA install prompts (2026)

- Chromium (Chrome/Edge, desktop + Android) fires `beforeinstallprompt` when installability criteria pass; best practice is to suppress the mini-infobar (`e.preventDefault()`), stash the event, and surface a custom install affordance at a moment of engagement (e.g., after first puzzle win) rather than on load. ([web.dev installation prompt](https://web.dev/learn/pwa/installation-prompt), [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable))
- iOS Safari still has **no** `beforeinstallprompt` and no programmatic prompt in 2026; install is manual via Share → "Add to Home Screen". Chrome/Edge on iOS cannot install PWAs at all. Correct pattern: detect iOS Safari standalone-capable browser mode and show a short instruction sheet instead of an install button. ([MagicBell PWA iOS guide 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [MobiLoud PWA on iOS 2026](https://www.mobiloud.com/blog/progressive-web-apps-ios))
- Consequence for this app: `InstallPrompt` component with two paths (captured BIP event → native prompt; iOS → instructions sheet). PWA still fully works offline on iOS once added.

## Capacitor

- Current Capacitor uses `capacitor.config.ts` (typed via `@capacitor/cli`): `appId`, `appName`, `webDir` (Vite ⇒ `dist`). iOS platform is generated with `npx cap add ios` and synced with `npx cap sync ios`; Xcode opened via `npx cap open ios`. The native project is generated on the Mac later — committing `capacitor.config.ts` + deps now is sufficient. ([Capacitor config docs](https://capacitorjs.com/docs/config), [Getting started](https://capacitorjs.com/docs/getting-started))

## Puzzle generation & uniqueness

- **Nonogram:** NP-hard in general, but the practical approach is an iterative **line solver** (per-line constraint intersection: compute all legal block placements consistent with current cells; fix cells common to all). Generating a random picture and *accepting only puzzles the line solver completes* guarantees both uniqueness and human (logic-only) solvability; uniquely solvable instances occur at high rate near sensible densities. ([Wikipedia: Nonogram](https://en.wikipedia.org/wiki/Nonogram), [Solving Hard Instances of Nonograms](https://medium.com/smith-hcv/solving-hard-instances-of-nonograms-35c68e4a26df), [arXiv 2507.07283 — phase transition behavior](https://arxiv.org/pdf/2507.07283))
- **Kakuro:** no shortcut for uniqueness — must count solutions with backtracking; key prunings are node/arc consistency over the "magic block" sum-partition tables (which digit sets can form sum S in N cells) and forward checking. ([enjoysudoku forum on kakuro uniqueness](http://forum.enjoysudoku.com/how-to-check-for-unique-solution-in-a-kakuro-puzzle-t33617.html), [Kakuro solving via combinatorial search](https://studylib.net/doc/10623364/solving-the-kakuro-puzzle))
- **Sudoku:** classic pipeline — randomized backtracking to fill, then clue removal with a solution-counting solver (cap count at 2). Bitmask candidates + MRV cell choice is fast enough that DLX is unnecessary for 9×9 at our volumes (confirmed by benchmark in Gate 1: avg generation ≈ well under 200 ms). Technique-tier grading (singles / locked candidates / pairs) matches perceived difficulty better than clue count alone.
- **Binairo/Takuzu:** generate a full grid satisfying (no three in a row, equal 0/1 per line, all rows/cols distinct) by backtracking; dig holes while a *rule-based* solver still finishes ⇒ unique and logic-solvable.
- **Killer Sudoku:** fill grid, partition into connected cages (2–5 cells, no repeated digit), uniqueness via cage-aware counting solver (cage sum + remaining-cells min/max pruning). Retry with new partition if non-unique.

## Determinism

- Seed: FNV-1a 32-bit hash of `"daily-logic:{ISO date}:{type}:{difficulty}"` feeding **sfc32** (good statistical quality, trivially portable to Swift later — relevant for Capacitor/native port). All generation randomness flows through this single PRNG instance; no `Math.random` anywhere in the engine (enforced by test grep).

## Tooling

- vite-plugin-pwa (Workbox `generateSW`) is still the standard Vite PWA path; precache the built assets, `registerType: 'autoUpdate'`. Verified against current npm release at install time.
- Playwright official `@playwright/test` with `webServer` config pointing at `vite preview` for e2e + screenshots; emulate devices via viewport + `colorScheme`.

## Deep-research digest #1 — modern web-game architecture (Gemini, 2026-06)
Actionable findings adopted: (1) PointerEvents + `touch-action:none` as the only input path;
(2) decorated-gutter letterboxing — fixed internal aspect, `object-fit: contain`, full-bleed
blurred/stylized backdrop behind the canvas for desktop; (3) audio unlock wired to the first
UI gesture (our start buttons) — validates the tap-to-play screen; (4) visibility-change pause
to avoid delta explosions; (5) procedural synth SFX (zzfx-style) over audio files; (6) fixed
timestep accumulator for physics determinism. Roadmap (v2): Rapier WASM physics w/ CCD,
idb-keyval over localStorage, Three.js MeshToonMaterial + hemisphere/directional rig +
planar shadows + InstancedMesh for true low-poly 3D titles; CC0 assets (Kenney/Quaternius/
Poly Pizza); GSAP now MIT. Perf budget: <100 draw calls, zero allocations in the loop.

## Deep-research digest #2 — design/UX/juice cookbook (Gemini, 2026-06)
THE numbers to apply everywhere: tap-to-start overlay over the LIVE world (no menus);
easeOutBack cubic-bezier(.34,1.56,.64,1) for pop-ins, easeOut for slides; screenshake
amp = impactVelocity x 0.0025 (small 2-4px/100ms, med 8-12px/250ms, large 20-30px/500ms
damped); hitstop 16-33ms light / 66-100ms heavy at 3-5% timescale (never full pause);
squash&stretch with volume preservation (land Y70%/X130%, recover ~150ms easeOutBack);
particles 5-10 small / 20-30 medium / 100+ big; floating text drifts +50px over 800ms;
haptics 10ms light / 30ms heavy with 50ms cooldown; combo SFX pitch = base x 1.05946^n
capped at 2.0; no BGM (percussive SFX symphony); result screens: score counts up 800-1200ms
easeOutCubic, stars stamp 200ms apart w/ rising pitch, confetti+fanfare on new best;
fail->retry loop <800ms; HUD: score top-centre, settings top-right, currency top-left;
desktop: 16:9 lock, decorated blurred gutters, WASD+arrows, never Escape, "Click" not
"Tap" via pointer detection; streaks = loss aversion + Day-7 variable reward + freezes.
Art recipes: snake=flat neon on near-black grid; hole-eater=pastel ground + white blocks +
rim-lit hole; tower-smash=glossy candy plastic on matte pillar; word=minimalist flat tiles.
10 new game concepts logged (suika-word, rhythm paper.io, ghost-runner, queens-cartography...).
