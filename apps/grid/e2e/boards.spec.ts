/**
 * Functional e2e tests: verify each puzzle type can be played to completion.
 * Uses the deterministic daily seed to drive pre-computed solutions.
 */
import { test, expect } from '@playwright/test';
import { generateGridDaily, type QueensPuzzle, type TangoPuzzle, type ZipPuzzle } from '@daily-logic/grid-engine';
import { utcDateString } from '@daily-logic/engine';

const date = utcDateString();

async function expectWin(page: import('@playwright/test').Page, type: string) {
  await expect(page.getByTestId('win-overlay')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('win-home').click();
  await expect(page.getByTestId(`card-${type}`)).toContainText('Solved');
}

test('queens: full playthrough', async ({ page }) => {
  const puzzle = generateGridDaily(date, 'queens') as QueensPuzzle;
  await page.goto('/');
  await page.getByTestId('card-queens').click();
  await expect(page.getByTestId('queens-grid')).toBeVisible({ timeout: 10_000 });

  // solution[row] = col; tap each correct cell twice (empty→x→queen)
  for (let row = 0; row < puzzle.n; row++) {
    const col = puzzle.solution[row];
    const cell = page.getByTestId(`cell-${row}-${col}`);
    await cell.click(); // → x
    await cell.click(); // → queen
  }
  await expectWin(page, 'queens');
});

test('tango: full playthrough', async ({ page }) => {
  const puzzle = generateGridDaily(date, 'tango') as TangoPuzzle;
  await page.goto('/');
  await page.getByTestId('card-tango').click();
  await expect(page.getByTestId('tango-grid')).toBeVisible({ timeout: 10_000 });

  const n = 6;
  // solution 0=sun,1=moon; cells 1=sun,2=moon (cycle empty→sun→moon)
  for (let i = 0; i < n * n; i++) {
    if (puzzle.givens[i] !== -1) continue; // pre-filled
    const row = Math.floor(i / n);
    const col = i % n;
    const cell = page.getByTestId(`cell-${row}-${col}`);
    const needed = puzzle.solution[i]; // 0=sun(1 click), 1=moon(2 clicks)
    const clicks = needed === 0 ? 1 : 2;
    for (let k = 0; k < clicks; k++) {
      await cell.click();
    }
  }
  await expectWin(page, 'tango');
});

test('zip: full playthrough via hint button', async ({ page }) => {
  const puzzle = generateGridDaily(date, 'zip') as ZipPuzzle;
  await page.goto('/');
  await page.getByTestId('card-zip').click();
  await expect(page.getByTestId('zip-grid')).toBeVisible({ timeout: 10_000 });

  // Use hint button to fill the entire solution one step at a time.
  // We have 3 hints by default, then use keyboard-driven solution.
  // Instead: click each cell in solution order (click starts from cell if not yet in path)
  const { n, solution } = puzzle;
  const svg = page.getByTestId('zip-grid');
  const svgBox = await svg.boundingBox();
  if (!svgBox) throw new Error('zip-grid bounding box unavailable');

  const CELL = svgBox.width / n;

  // Build sequence of pointer events to drag through all cells
  // Start at solution[0], drag through all
  const cellCenter = (idx: number) => {
    const row = Math.floor(idx / n);
    const col = idx % n;
    return {
      x: svgBox.x + (col + 0.5) * CELL,
      y: svgBox.y + (row + 0.5) * CELL,
    };
  };

  const first = cellCenter(solution[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let s = 1; s < solution.length; s++) {
    const { x, y } = cellCenter(solution[s]);
    await page.mouse.move(x, y);
  }
  await page.mouse.up();

  await expectWin(page, 'zip');
});
