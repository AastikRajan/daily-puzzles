# PORTING.md — iOS App Store wrap (Capacitor)

The web app is architected for this from day one: pure-TS engine (no DOM/Node APIs), relative
asset base (`base: './'`), localStorage persistence, no backend. The native shell just hosts
`apps/web/dist`.

## Mac-day checklist (exact steps)

Prereqs on the Mac: Xcode 15+, Node 20+, CocoaPods (`sudo gem install cocoapods`), an Apple
Developer account ($99/yr).

```bash
# 1. clone + install + verify everything still passes
git clone <repo> daily-logic && cd daily-logic
npm ci
npm test && npm run test:full
npm run build              # produces apps/web/dist

# 2. add Capacitor (config is already committed at /capacitor.config.ts)
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap add ios            # generates /ios (gitignored until this day)

# 3. sync the web build into the native project
npx cap sync ios

# 4. open Xcode, set signing, run on device
npx cap open ios
#   → Targets ▸ App ▸ Signing & Capabilities ▸ select your Team
#   → set Bundle Identifier to app.dailylogic.puzzles (must match capacitor.config.ts)
#   → Product ▸ Run on a real device; play one puzzle of each type
```

### Native niceties (recommended, ~1h)

```bash
npm install @capacitor/haptics @capacitor/splash-screen @capacitor/status-bar
npx cap sync ios
```

- **Haptics**: in `apps/web/src/lib/haptics.ts`, branch on `Capacitor.isNativePlatform()` and
  call `Haptics.impact({ style: ImpactStyle.Light })` instead of `navigator.vibrate` (which iOS
  WebView ignores). The file is the single haptics chokepoint — nothing else changes.
- **Status bar**: `StatusBar.setStyle` to match the active theme (hook into `applyTheme` in
  `apps/web/src/state/settings.ts`).
- **Splash**: generate with `npx @capacitor/assets generate --ios` from `apps/web/public/pwa-512.png`.

### App Store submission

1. Xcode ▸ Product ▸ Archive → Distribute → App Store Connect.
2. In App Store Connect create the app (bundle id `app.dailylogic.puzzles`).
3. Paste metadata from `store-metadata/` (EN + HI/ES/DE/JA localizations ready below).
4. Screenshots: 6.7" (1290×2796) and 5.5" (1242×2208) — capture from Simulator with
   `Cmd+S`; the artifacts/screens gallery shows which screens present best (home, sudoku,
   nonogram, stats).
5. Review notes: fully offline, no accounts, no tracking, no third-party SDKs.

### Privacy
- Data collection: **none** (everything in localStorage on-device). App Privacy: "Data Not
  Collected".

## Store metadata

See `store-metadata/en.json` (ASO-optimized title/subtitle/keywords) with translations in
`hi.json`, `es.json`, `de.json`, `ja.json`. Keyword research targets: sudoku, nonogram,
picross, kakuro, daily puzzle, brain games, logic puzzles, binairo, killer sudoku.

## Android later
`npx cap add android`, same sync flow; the web app already handles back-gesture-free
navigation and safe-area insets.
