import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'bankshot');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __bankshot: {
      level: () => number;
      stars: () => number;
      shoot: (angleRad: number) => void;
      targetsLeft: () => number;
      targets: () => { x: number; y: number }[];
      turret: () => { x: number; y: number };
      skipLevel: () => void;
      restart: () => void;
    };
  }
}

test('level 1 renders with targets', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__bankshot !== 'undefined');

  const count = await page.evaluate(() => window.__bankshot.targetsLeft());
  expect(count).toBeGreaterThan(0);

  const level = await page.evaluate(() => window.__bankshot.level());
  expect(level).toBe(1);
});

test('shoot at target — targetsLeft decreases within 6 shots', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__bankshot !== 'undefined');

  const initialTargets = await page.evaluate(() => window.__bankshot.targetsLeft());
  expect(initialTargets).toBeGreaterThan(0);

  // Try to shoot at each visible target
  let decreased = false;
  for (let attempt = 0; attempt < 6 && !decreased; attempt++) {
    const result = await page.evaluate(() => {
      const targets = window.__bankshot.targets();
      const turret = window.__bankshot.turret();
      if (targets.length === 0) return { done: true, left: 0 };
      // Aim at the first target
      const t = targets[0]!;
      const angle = Math.atan2(t.y - turret.y, t.x - turret.x);
      window.__bankshot.shoot(angle);
      return { done: false, left: window.__bankshot.targetsLeft() };
    });
    if (result.done) { decreased = true; break; }
    // Wait for bullet to travel
    await page.waitForTimeout(600);
    const left = await page.evaluate(() => window.__bankshot.targetsLeft());
    if (left < initialTargets) {
      decreased = true;
    }
  }

  expect(decreased).toBe(true);
});

test('clear level 1 fully — level becomes 2', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__bankshot !== 'undefined');

  // Keep shooting at targets until level clears
  let cleared = false;
  for (let attempt = 0; attempt < 20 && !cleared; attempt++) {
    const state = await page.evaluate(() => {
      const targets = window.__bankshot.targets();
      const turret = window.__bankshot.turret();
      const left = window.__bankshot.targetsLeft();
      if (left === 0) return { left: 0, shot: false };
      // Shoot at first target
      const t = targets[0]!;
      const angle = Math.atan2(t.y - turret.y, t.x - turret.x);
      window.__bankshot.shoot(angle);
      return { left, shot: true };
    });

    if (state.left === 0) { cleared = true; break; }
    await page.waitForTimeout(700);
    const left = await page.evaluate(() => window.__bankshot.targetsLeft());
    if (left === 0) { cleared = true; }
  }

  // Wait for level clear animation + auto advance (3s overlay + buffer)
  await page.waitForTimeout(3500);

  const level = await page.evaluate(() => window.__bankshot.level());
  expect(level).toBe(2);
});

test('skipLevel works', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__bankshot !== 'undefined');

  const before = await page.evaluate(() => window.__bankshot.level());
  await page.evaluate(() => window.__bankshot.skipLevel());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.__bankshot.level());
  expect(after).toBe(before + 1);
});

test('screenshots: aim preview visible, explosion/clear, dark + light', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__bankshot !== 'undefined');
  await page.waitForTimeout(300);

  // ——— Dark: aim preview screenshot ———
  // Simulate pointer drag to aim
  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // Start aim from bottom-center (turret area), drag up-left
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.25);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(ARTIFACTS, 'aim-preview-dark.png') });
    await page.mouse.up();
  }

  await page.waitForTimeout(300);

  // ——— Dark: shoot and capture the level-clear overlay ———
  for (let attempt = 0; attempt < 20; attempt++) {
    const left = await page.evaluate(() => window.__bankshot.targetsLeft());
    if (left === 0) break;
    await page.evaluate(() => {
      const targets = window.__bankshot.targets();
      const turret = window.__bankshot.turret();
      if (targets.length === 0) return;
      const t = targets[0]!;
      const angle = Math.atan2(t.y - turret.y, t.x - turret.x);
      window.__bankshot.shoot(angle);
    });
    await page.waitForTimeout(700);
  }

  // Wait for cleared overlay
  await page.waitForSelector('[data-testid="level-clear-overlay"]', { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, 'explosion-clear-dark.png') });

  // ——— Light theme ———
  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__bankshot.skipLevel());
  await page.waitForTimeout(300);

  // Aim preview in light
  const box2 = await canvas.boundingBox();
  if (box2) {
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.85);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width * 0.7, box2.y + box2.height * 0.2);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(ARTIFACTS, 'aim-preview-light.png') });
    await page.mouse.up();
  }

  await page.waitForTimeout(300);

  // Shoot in light — keep shooting until level clears
  for (let attempt = 0; attempt < 20; attempt++) {
    const left = await page.evaluate(() => window.__bankshot.targetsLeft());
    if (left === 0) break;
    await page.evaluate(() => {
      const targets = window.__bankshot.targets();
      const turret = window.__bankshot.turret();
      if (targets.length === 0) return;
      const t = targets[0]!;
      const angle = Math.atan2(t.y - turret.y, t.x - turret.x);
      window.__bankshot.shoot(angle);
    });
    await page.waitForTimeout(700);
  }

  // Wait for cleared overlay
  await page.waitForSelector('[data-testid="level-clear-overlay"]', { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, 'explosion-clear-light.png') });
});
