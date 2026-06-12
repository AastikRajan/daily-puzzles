import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'swing');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __swing: {
      distance: () => number;
      stars: () => number;
      phase: () => string;
      attach: () => void;
      release: () => void;
      attached: () => boolean;
      restart: () => void;
    };
  }
}

test('swinging makes progress; falling dies; restart works', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__swing !== 'undefined');

  // rhythmic swings: attach, ride the pendulum, release on the upswing
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__swing.attach());
    await page.waitForTimeout(620);
    if (i === 2) {
      await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });
    }
    await page.evaluate(() => window.__swing.release());
    await page.waitForTimeout(260);
    if ((await page.evaluate(() => window.__swing.phase())) === 'dead') break;
  }

  // either we made distance or died trying — but distance must have advanced
  const dist = await page.evaluate(() => window.__swing.distance());
  expect(dist).toBeGreaterThan(3);

  // let gravity finish the job for the death overlay
  for (let i = 0; i < 20; i++) {
    const phase = await page.evaluate(() => window.__swing.phase());
    if (phase === 'dead') break;
    await page.evaluate(() => window.__swing.release());
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('game-over-overlay')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-dark.png') });

  await page.getByTestId('play-again-btn').click();
  await expect(page.getByTestId('game-over-overlay')).not.toBeVisible();
  const d2 = await page.evaluate(() => window.__swing.distance());
  expect(d2).toBeLessThan(5);
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__swing !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.evaluate(() => window.__swing.attach());
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
