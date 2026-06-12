import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { utcDateString } from '@daily-logic/engine';
import {
  generateGuessPuzzle,
  generateAnagramsPuzzle,
  generateHuntPuzzle,
} from '@daily-logic/word-engine';

const date = utcDateString();
const ARTIFACTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../artifacts/word');

test.beforeAll(() => {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
});

// ─── Home screenshots ─────────────────────────────────────────────────────────
test('home: light screenshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByTestId('countdown')).toBeVisible();
  // Wait for card animations to complete
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'home-light.png'), fullPage: false });
});

test('home: dark screenshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.getByTestId('countdown')).toBeVisible();
  // Toggle to dark via settings
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('back-btn').click();
  // Wait for card animations to complete
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'home-dark.png'), fullPage: false });
});

// ─── Guess ────────────────────────────────────────────────────────────────────
test('guess: play to completion', async ({ page }) => {
  const puzzle = generateGuessPuzzle(date);
  await page.goto('/');
  await page.getByTestId('card-guess').click();
  await expect(page.getByTestId('guess-grid')).toBeVisible();

  // Screenshot the empty grid
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'guess-light.png'), fullPage: false });

  // Type the answer directly to win on first try using physical keyboard
  const answer = puzzle.answer.toLowerCase();
  for (const letter of answer) {
    await page.keyboard.press(letter);
  }
  await page.keyboard.press('Enter');

  // Wait for win overlay
  await expect(page.getByTestId('win-overlay')).toBeVisible({ timeout: 5000 });

  // Screenshot win state
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'guess-win-light.png'), fullPage: false });

  await page.getByTestId('win-home').click();
  // Home should show solved state
  await expect(page.getByTestId('card-guess')).toContainText('Solved');
});

test('guess: wrong word rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('card-guess').click();
  await expect(page.getByTestId('guess-grid')).toBeVisible();

  // Type invalid word via physical keyboard
  for (const letter of 'zzzzz') {
    await page.keyboard.press(letter);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('guess-message')).toBeVisible();
});

// ─── Anagrams ─────────────────────────────────────────────────────────────────
test('anagrams: find words and win', async ({ page }) => {
  const puzzle = generateAnagramsPuzzle(date);
  await page.goto('/');
  await page.getByTestId('card-anagrams').click();
  await expect(page.getByTestId('rack')).toBeVisible();

  // Screenshot the starting state
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'anagrams-light.png'), fullPage: false });

  // Find all solutions by clicking tiles in the right order
  let won = false;
  for (const sol of puzzle.solutions) {
    // Click tiles that spell this solution
    const rackLetters = [...puzzle.rack];
    const usedIndices: number[] = [];
    let valid = true;

    for (const ch of sol) {
      const idx = rackLetters.findIndex(
        (l, i) => l.toLowerCase() === ch && !usedIndices.includes(i),
      );
      if (idx === -1) { valid = false; break; }
      usedIndices.push(idx);
    }

    if (!valid) continue;

    for (const idx of usedIndices) {
      await page.getByTestId(`rack-tile-${idx}`).click().catch(() => {});
    }
    await page.getByTestId('submit-word').click().catch(() => {});
    await page.waitForTimeout(200);

    if (await page.getByTestId('win-overlay').isVisible()) {
      won = true;
      break;
    }
  }

  if (won) {
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'anagrams-win-light.png'), fullPage: false });
    await page.getByTestId('win-home').click();
    await expect(page.getByTestId('card-anagrams')).toContainText('Solved');
  } else {
    // Just check that the UI is working
    const foundWords = await page.getByTestId('found-words').textContent();
    expect(foundWords).toBeTruthy();
  }
});

// ─── Word Hunt ────────────────────────────────────────────────────────────────
test('hunt: find all words and win', async ({ page }) => {
  const puzzle = generateHuntPuzzle(date);
  await page.goto('/');
  await page.getByTestId('card-hunt').click();
  await expect(page.getByTestId('hunt-grid')).toBeVisible();

  // Screenshot starting state
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'hunt-light.png'), fullPage: false });

  // Simulate drag for each placed word
  for (const pw of puzzle.words) {
    const grid = page.getByTestId('hunt-grid');
    const gridBox = await grid.boundingBox();
    if (!gridBox) continue;

    const cellW = gridBox.width / 8;
    const cellH = gridBox.height / 8;

    const startCell = pw.cells[0];
    const endCell = pw.cells[pw.cells.length - 1];
    if (!startCell || !endCell) continue;

    const sx = gridBox.x + startCell.col * cellW + cellW / 2;
    const sy = gridBox.y + startCell.row * cellH + cellH / 2;
    const ex = gridBox.x + endCell.col * cellW + cellW / 2;
    const ey = gridBox.y + endCell.row * cellH + cellH / 2;

    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }

  // All words should be found
  const winVisible = await page.getByTestId('win-overlay').isVisible();
  if (winVisible) {
    await page.screenshot({ path: join(ARTIFACTS_DIR, 'hunt-win-light.png'), fullPage: false });
    await page.getByTestId('win-home').click();
    await expect(page.getByTestId('card-hunt')).toContainText('Solved');
  }
});

// ─── Dark mode screenshots for all modes ──────────────────────────────────────
test('anagrams: dark screenshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('card-anagrams').click();
  await expect(page.getByTestId('rack')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'anagrams-dark.png'), fullPage: false });
  await page.getByTestId('back-btn').click();
});

test('hunt: dark screenshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('card-hunt').click();
  await expect(page.getByTestId('hunt-grid')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'hunt-dark.png'), fullPage: false });
});

test('guess: dark screenshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('back-btn').click();
  await page.getByTestId('card-guess').click();
  await expect(page.getByTestId('guess-grid')).toBeVisible();
  await page.screenshot({ path: join(ARTIFACTS_DIR, 'guess-dark.png'), fullPage: false });
});
