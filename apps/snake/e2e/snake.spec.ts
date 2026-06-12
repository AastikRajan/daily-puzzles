import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'snake');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __snakePop: {
      score: () => number;
      length: () => number;
      die: () => void;
      eatColor: (c: number) => void;
    };
  }
}

test('match-3 pop: eating 3 same colors pops them and scores', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__snakePop !== 'undefined');

  const len0 = await page.evaluate(() => window.__snakePop.length());
  await page.evaluate(() => {
    window.__snakePop.eatColor(1);
    window.__snakePop.eatColor(1);
    window.__snakePop.eatColor(1);
  });
  // pop resolves after the pulse warning (~300ms)
  await page.waitForFunction(
    (l0) => window.__snakePop.length() <= l0,
    len0,
    { timeout: 4000 },
  );
  const score = await page.evaluate(() => window.__snakePop.score());
  expect(score).toBeGreaterThan(0);
});

test('death overlay and restart', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__snakePop !== 'undefined');
  await page.evaluate(() => {
    window.__snakePop.eatColor(2);
    window.__snakePop.eatColor(2);
    window.__snakePop.eatColor(2);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__snakePop.die());

  await expect(page.getByTestId('game-over-overlay')).toBeVisible();
  const final = await page.getByTestId('final-score').textContent();
  expect(Number(final)).toBeGreaterThan(0);

  await page.getByTestId('play-again-btn').click();
  await expect(page.getByTestId('game-over-overlay')).not.toBeVisible();
  const score = await page.evaluate(() => window.__snakePop.score());
  expect(score).toBe(0);
});

test('screenshots: colorful gameplay + game over, dark and light', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__snakePop !== 'undefined');
  // grow a long colorful snake without triggering pops (alternate colors)
  await page.evaluate(() => {
    const seq = [0, 1, 2, 3, 4, 0, 2, 1, 3, 0, 4, 2];
    for (const c of seq) window.__snakePop.eatColor(c);
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
  await page.getByTestId('theme-toggle').click();

  await page.evaluate(() => window.__snakePop.die());
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-dark.png') });
});
