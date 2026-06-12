/** Real-input desktop playtest of upgraded Snake Pop. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';

mkdirSync('artifacts/playtest', { recursive: true });

execSync('npx vite build', { cwd: 'apps/snake', stdio: 'ignore' });
const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], {
  cwd: 'apps/snake',
  shell: true,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 3000));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4177');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/playtest/snake-NEW-1-title.png' });

await page.getByTestId('start-btn').click();
await page.waitForTimeout(400);
// steer like a human
await page.mouse.move(1000, 350);
await page.waitForTimeout(900);
await page.mouse.move(500, 600);
await page.waitForTimeout(900);
await page.screenshot({ path: 'artifacts/playtest/snake-NEW-2-gameplay-desktop.png' });

// mobile size too
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'artifacts/playtest/snake-NEW-3-gameplay-mobile.png' });

await browser.close();
server.kill();
console.log('done');
