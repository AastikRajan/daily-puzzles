import { test, expect } from '@playwright/test';
import { generateDaily, utcDateString, type SudokuPuzzle } from '@daily-logic/engine';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('share, streak, countdown and archive gate', async ({ page }) => {
  const date = utcDateString();
  const puzzle = generateDaily(date, 'sudoku') as SudokuPuzzle;

  await page.goto('/');
  // countdown renders as HH:MM:SS
  await expect(page.getByTestId('countdown')).toContainText(/\d{2}:\d{2}:\d{2}/);

  // solve sudoku cleanly
  await page.getByTestId('card-sudoku').click();
  for (let i = 0; i < 81; i++) {
    if (puzzle.givens[i] !== 0) continue;
    await page.getByTestId(`cell-${i}`).click();
    await page.keyboard.press(String(puzzle.solution[i]));
  }
  await expect(page.getByTestId('win-overlay')).toBeVisible();

  // share → clipboard contains the spoiler-free card
  await page.getByTestId('win-share').click();
  await expect(page.getByTestId('win-share')).toContainText(/Copied!|Shared!/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Daily Logic · Sudoku');
  expect(clip).toContain('🟦🟦🟦🟦🟦 flawless');
  expect(clip).toMatch(/⏱️ \d+:\d{2}/);

  // back home: card solved, streak flame = 1
  await page.getByTestId('win-home').click();
  await expect(page.getByTestId('card-sudoku')).toContainText('Solved');
  await expect(page.getByTestId('card-sudoku').locator('.streak')).toHaveText('1');

  // archive: yesterday free, older gated behind premium stub
  await page.getByTestId('nav-archive').click();
  await expect(page.getByTestId('archive-yesterday')).toContainText('Free');
  await page.getByTestId('archive-locked').first().click();
  await expect(page.getByText('Premium', { exact: true })).toBeVisible();
  await page.getByTestId('premium-close').click();

  // yesterday loads as playable archive day
  await page.getByTestId('archive-yesterday').click();
  await expect(page.getByText('archive')).toBeVisible();
  await expect(page.getByTestId('card-sudoku')).toBeVisible();
});
