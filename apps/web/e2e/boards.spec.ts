import { test, expect, type Page } from '@playwright/test';
import {
  generateDaily,
  utcDateString,
  type KillerPuzzle,
  type NonogramPuzzle,
  type KakuroPuzzle,
  type BinairoPuzzle,
} from '@daily-logic/engine';

const date = utcDateString();

async function expectWin(page: Page, type: string) {
  await expect(page.getByTestId('win-overlay')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('win-home').click();
  await expect(page.getByTestId(`card-${type}`)).toContainText('Solved');
}

test('killer sudoku: full playthrough with mistake + hint', async ({ page }) => {
  const puzzle = generateDaily(date, 'killer') as KillerPuzzle;
  await page.goto('/');
  await page.getByTestId('card-killer').click();
  await expect(page.getByTestId('killer-grid')).toBeVisible();

  const firstEmpty = puzzle.givens.findIndex((v) => v === 0);
  const wrong = (puzzle.solution[firstEmpty] % 9) + 1;
  await page.getByTestId(`cell-${firstEmpty}`).click();
  await page.getByTestId(`key-${wrong}`).click();
  await page.getByTestId('undo').click();
  await page.getByTestId('hint').click();

  for (let i = 0; i < 81; i++) {
    if (puzzle.givens[i] !== 0) continue;
    await page.getByTestId(`cell-${i}`).click();
    await page.keyboard.press(String(puzzle.solution[i]));
  }
  await expectWin(page, 'killer');
});

test('binairo: full playthrough', async ({ page }) => {
  const puzzle = generateDaily(date, 'binairo') as BinairoPuzzle;
  await page.goto('/');
  await page.getByTestId('card-binairo').click();
  await expect(page.getByTestId('binairo-grid')).toBeVisible();

  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    if (puzzle.givens[i] !== -1) continue;
    const clicks = puzzle.solution[i] === 0 ? 1 : 2;
    for (let k = 0; k < clicks; k++) {
      await page.getByTestId(`cell-${i}`).click();
    }
  }
  await expectWin(page, 'binairo');
});

test('kakuro: full playthrough with hint', async ({ page }) => {
  const puzzle = generateDaily(date, 'kakuro') as KakuroPuzzle;
  await page.goto('/');
  await page.getByTestId('card-kakuro').click();
  await expect(page.getByTestId('kakuro-grid')).toBeVisible();

  await page.getByTestId('hint').click();
  for (const i of puzzle.whiteCells) {
    if (puzzle.givens[i] !== undefined) continue;
    await page.getByTestId(`cell-${i}`).click();
    await page.keyboard.press(String(puzzle.solution[i]));
  }
  await expectWin(page, 'kakuro');
});

test('nonogram: full playthrough via tap-fill', async ({ page }) => {
  const puzzle = generateDaily(date, 'nonogram') as NonogramPuzzle;
  await page.goto('/');
  await page.getByTestId('card-nonogram').click();
  await expect(page.getByTestId('nonogram-grid')).toBeVisible();

  // make one deliberate wrong fill then undo
  const wrongCell = puzzle.solution.findIndex((v) => v === 0);
  await page.getByTestId(`cell-${wrongCell}`).click();
  await page.getByTestId('undo').click();

  for (let i = 0; i < puzzle.solution.length; i++) {
    if (puzzle.solution[i] !== 1) continue;
    await page.getByTestId(`cell-${i}`).click();
  }
  await expectWin(page, 'nonogram');
});
