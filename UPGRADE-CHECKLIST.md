# Game-Feel Upgrade Checklist (apply to EVERY arcade game)

Canonical reference implementation: **apps/snake** (read its src/lib/sfx.ts,
src/game/game.ts ready-phase + hitstop + zoom, src/components/GameView.tsx
overlays, and the "overhaul" section of src/styles/global.css). Research basis:
RESEARCH.md digests #1 and #2 — numbers below are mandatory, not suggestions.

## 1. Title screen over the LIVE world (no menus)
- Game starts in phase `'ready'`: the world renders animated/idle behind a
  translucent overlay (radial dark gradient, NOT a solid panel).
- Overlay = game name in display font w/ gradient + glow, one-line tagline,
  2-3 how-to chips (emoji + 3 words max), big `.btn3d` PLAY with `start-glow`
  pulse (NEVER a transform animation — Playwright actionability breaks).
- First PLAY click is the audio unlock. Death → result card → "Play again"
  goes straight back to playing (<800ms loop), not to the title.

## 2. Full-screen presentation (desktop = first-class)
- Canvas is `position: fixed; inset: 0` at full viewport, resized on `resize`.
- Camera-world games (snake-like): zoom = `max(0.9, min(vw,vh)/800)` so desktop
  sees more world. Fixed-scene portrait games (smash/helixtwist/drop/paintrun/
  orbit/golf): scale the scene to fit HEIGHT, center it, and paint the side
  gutters with the scene's own background gradient + vignette + subtle pattern
  (decorated gutters — never dead black bars, never stretch).
- Desktop keyboard: arrows/WASD where they make sense; never use Escape.

## 3. Synth SFX, ON by default (copy apps/snake/src/lib/sfx.ts wholesale)
- Events: collect (rising chirp), big event (layered pop chord), combo
  (semitone ladder ×1.05946^n capped ×2), death (down sweep), start fanfare,
  UI click. Mute chip top-right persists via storage. No background music.

## 4. Juice numbers (from GDC cookbook)
- Hitstop: timeScale 0.05 for 40-50ms on medium, 70-100ms on heavy impacts
  (apply on the loop's accumulated dt, like snake).
- Screenshake: small 2-4px/100ms, medium 8-12px/250ms decaying; reduced-motion
  disables.
- Squash & stretch with volume preservation (land: Y70/X130, recover 150ms).
- Particles: 5-10 small, 20-30 medium, 100+ celebration. Float text drifts
  +50px over 800ms.
- Result screens: score counts up 0→N over ~900ms easeOutCubic; confetti +
  fanfare only on new best.

## 5. HUD conventions
- Score top-centre chips, mute top-right, hint-text bottom (hide during ready).
- All chips/cards/buttons use the established `.chip/.card/.btn3d` classes.

## 6. Verification gates (all mandatory before done)
- `npx tsc -p tsconfig.json --noEmit` clean; `npx vite build` green.
- Existing `npx playwright test` suite green — UPDATE specs for the new ready
  phase (click `start-btn` after load, like apps/snake/e2e).
- REAL-INPUT proof: extend the e2e with one test that plays via actual
  `page.mouse` gestures only (no debug API) and screenshots BOTH 1440×900
  desktop AND 390×844 mobile into artifacts/<game>/. LOOK at them with the
  Read tool (downscale >2000px images first) and fix what looks bad.
