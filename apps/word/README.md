# Daily Word

Three fresh word puzzles every day — same puzzles for everyone worldwide, seeded from UTC date.

## Modes

| Mode | Description |
|------|-------------|
| **Guess** | Wordle-style — find the 5-letter word in 6 tries |
| **Anagrams** | Build words from a 7-letter rack, score points by length |
| **Word Hunt** | Drag-to-find 6 hidden words in an 8×8 letter grid |

## Data Sources

- **GUESSES** (14,855 valid 5-letter words): https://raw.githubusercontent.com/tabatkins/wordle-list/main/words
- **ANSWERS** (~2,315 common 5-letter words): derived from GUESSES (NYT source was unavailable; original: https://gist.github.com/cfreshman/a7b776506c73284511034e63af1017ee)
- **POPULAR** (17,906 common English words, 3–8 letters): https://raw.githubusercontent.com/dolph/dictionary/master/popular.txt

Word data is fetched by `packages/word-engine/scripts/fetch-words.mjs` and committed as TypeScript data modules.

## Dev

```
npm run dev      # port 5174
npm run build    # production build (tsc + vite)
npm run e2e      # Playwright e2e (Chromium/Pixel 7)
```
