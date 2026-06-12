/**
 * REAL-INPUT playtest: drives games with actual mouse gestures (no debug
 * APIs) at desktop size, capturing what a human actually sees and feels.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'artifacts/playtest';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

// ——— SNAKE: steer with mouse like a human ———
await page.goto('http://localhost:8080/snake/');
await page.waitForTimeout(1200);
await shot('snake-1-first-impression');
// human behavior: move mouse around to steer
await page.mouse.move(900, 450);
await page.waitForTimeout(800);
await page.mouse.move(700, 300);
await page.waitForTimeout(800);
await shot('snake-2-after-steering');
await page.waitForTimeout(2500);
await shot('snake-3-after-4s-idle');

// ——— GOLF: drag back to aim like a human ———
await page.goto('http://localhost:8080/golf/');
await page.waitForTimeout(2500); // banner
await shot('golf-1-first-impression');
await page.mouse.move(720, 700);
await page.mouse.down();
await page.mouse.move(720, 820, { steps: 10 });
await shot('golf-2-aiming-drag');
await page.mouse.up();
await page.waitForTimeout(1500);
await shot('golf-3-after-shot');

// ——— SMASH: hold to smash ———
await page.goto('http://localhost:8080/smash/');
await page.waitForTimeout(1000);
await shot('smash-1-first-impression');
await page.mouse.move(720, 450);
await page.mouse.down();
await page.waitForTimeout(900);
await shot('smash-2-holding');
await page.mouse.up();
await page.waitForTimeout(800);
await shot('smash-3-released');

// ——— DROP: click to drop orbs ———
await page.goto('http://localhost:8080/drop/');
await page.waitForTimeout(1000);
await shot('drop-1-first-impression');
for (const x of [650, 750, 700]) {
  await page.mouse.move(x, 400);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);
}
await shot('drop-2-after-3-drops');

await browser.close();
console.log('playtest done');
