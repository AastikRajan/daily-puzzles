import { test, expect } from '@playwright/test';
import { generateDaily, utcDateString, type SudokuPuzzle } from '@daily-logic/engine';

test.describe('sudoku end-to-end', () => {
  test('full game: mistakes, undo, hint, completion, home state', async ({ page }) => {
    const date = utcDateString();
    const puzzle = generateDaily(date, 'sudoku') as SudokuPuzzle;

    await page.goto('/');
    await expect(page.getByTestId('countdown')).toBeVisible();
    await page.getByTestId('card-sudoku').click();
    await expect(page.getByTestId('sudoku-grid')).toBeVisible();

    // pick the first empty cell and make a deliberate mistake
    const firstEmpty = puzzle.givens.findIndex((v) => v === 0);
    const correct = puzzle.solution[firstEmpty];
    const wrong = (correct % 9) + 1; // guaranteed ≠ correct
    await page.getByTestId(`cell-${firstEmpty}`).click();
    await page.getByTestId(`key-${wrong}`).click();
    // error check (on by default) paints the wrong digit red
    const wrongText = page.getByTestId(`cell-${firstEmpty}`).locator('text');
    await expect(wrongText).toHaveAttribute('fill', 'var(--bad)');

    // undo clears the mistake
    await page.getByTestId('undo').click();
    await expect(page.getByTestId(`cell-${firstEmpty}`).locator('text')).toHaveCount(0);

    // pencil mark, then overwrite with a real digit
    await page.getByTestId('pencil').click();
    await page.getByTestId(`cell-${firstEmpty}`).click();
    await page.getByTestId(`key-${correct}`).click();
    await expect(page.getByTestId(`cell-${firstEmpty}`).locator('text')).toHaveCount(1);
    await page.getByTestId('pencil').click(); // back to ink

    // hint solves one cell (consumes 1 of 3 daily hints)
    await page.getByTestId('hint').click();

    // solve the rest via keyboard
    for (let i = 0; i < 81; i++) {
      if (puzzle.givens[i] !== 0) continue;
      await page.getByTestId(`cell-${i}`).click();
      await page.keyboard.press(String(puzzle.solution[i]));
    }

    await expect(page.getByTestId('win-overlay')).toBeVisible();
    await expect(page.getByTestId('win-time')).toContainText(':');
    await page.getByTestId('win-home').click();

    // home reflects completion + streak
    await expect(page.getByTestId('card-sudoku')).toContainText('Solved');
    await expect(page.getByTestId('card-sudoku')).toContainText('1');
  });

  test('progress persists across reload', async ({ page }) => {
    const date = utcDateString();
    const puzzle = generateDaily(date, 'sudoku') as SudokuPuzzle;
    const firstEmpty = puzzle.givens.findIndex((v) => v === 0);

    await page.goto('/');
    await page.getByTestId('card-sudoku').click();
    await page.getByTestId(`cell-${firstEmpty}`).click();
    await page.getByTestId(`key-${puzzle.solution[firstEmpty]}`).click();

    await page.reload();
    await page.getByTestId('card-sudoku').click();
    await expect(page.getByTestId(`cell-${firstEmpty}`).locator('text')).toHaveText(
      String(puzzle.solution[firstEmpty]),
    );
  });
});
