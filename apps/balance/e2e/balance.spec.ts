import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'balance');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __balance: {
      state: () => 'playing' | 'won' | 'failed';
      placeAuto: () => void;
      attempt: () => number;
      forceFail: () => void;
      placed: () => number;
      retry: () => void;
    };
  }
}

test('auto-place progresses the stack; mid-game screenshot', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__balance !== 'undefined');

  // place shapes one by one, waiting for things to calm between drops
  for (let i = 0; i < 8; i++) {
    const state = await page.evaluate(() => window.__balance.state());
    if (state !== 'playing') break;
    await page.evaluate(() => window.__balance.placeAuto());
    await page.waitForTimeout(1400);
    if (i === 4) {
      await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
    }
  }
  const placed = await page.evaluate(() => window.__balance.placed());
  expect(placed, 'auto-placement should get at least 5 shapes onto the plank').toBeGreaterThanOrEqual(5);

  // wait out the settle window — either win or a late topple, both fine,
  // but the game must reach a terminal or stay consistent
  await page.waitForTimeout(4500);
  const state = await page.evaluate(() => window.__balance.state());
  expect(['playing', 'won', 'failed']).toContain(state);
});

test('forceFail increments attempt and retry restarts; share after day done', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__balance !== 'undefined');

  await page.evaluate(() => window.__balance.placeAuto());
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__balance.forceFail());
  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'fail-mobile-light.png') });

  await page.getByTestId('retry').click();
  await expect(page.getByTestId('result-overlay')).not.toBeVisible();
  const attempt = await page.evaluate(() => window.__balance.attempt());
  expect(attempt).toBe(2);

  // burn remaining attempts to reach the day-done share state
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__balance.forceFail());
    await page.waitForTimeout(250);
    const retry = page.getByTestId('retry');
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
      await page.waitForTimeout(250);
    }
  }
  // After 5th fail the overlay shows share
  await page.evaluate(() => window.__balance.forceFail()).catch(() => {});
  await expect(page.getByTestId('share')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('share').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Balance!');
  expect(clip).toContain('🟥');
  await page.screenshot({ path: path.join(ARTIFACTS, 'daydone-mobile-light.png') });
});

test('dark theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__balance !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.evaluate(() => window.__balance.placeAuto());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });
});
