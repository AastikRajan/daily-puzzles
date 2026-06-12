import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'helixtwist');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __helix: {
      depth: () => number;
      score: () => number;
      phase: () => string;
      rotate: (rad: number) => void;
      alignGap: () => void;
      alignDanger: () => void;
      restart: (next: boolean) => void;
    };
  }
}

test('aligned gaps drop the ball; danger kills; restart works', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__helix !== 'undefined');

  // keep the gap aligned → ball should pass several rings
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.__helix.alignGap());
    await page.waitForTimeout(220);
  }
  const depth = await page.evaluate(() => window.__helix.depth());
  expect(depth).toBeGreaterThanOrEqual(3);
  const score = await page.evaluate(() => window.__helix.score());
  expect(score).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // now park on a danger segment until death (combo must be < 3 after a bounce)
  for (let i = 0; i < 30; i++) {
    const phase = await page.evaluate(() => window.__helix.phase());
    if (phase === 'dead') break;
    await page.evaluate(() => window.__helix.alignDanger());
    await page.waitForTimeout(220);
  }
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'death-mobile-dark.png') });

  await page.getByTestId('continue-btn').click();
  await expect(page.getByTestId('result-overlay')).not.toBeVisible();
  const d2 = await page.evaluate(() => window.__helix.depth());
  expect(d2).toBe(0);
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__helix !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
