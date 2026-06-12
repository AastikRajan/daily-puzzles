import { test, expect } from '@playwright/test';

test('manifest is served and service worker takes control', async ({ page }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const res = await page.request.get(new URL(manifestHref!, page.url()).toString());
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toContain('Daily Logic');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 20_000,
  });
});

test('app loads and plays offline after first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('card-sudoku')).toBeVisible();
  // a board still opens (generation is client-side, no network needed)
  await page.getByTestId('card-sudoku').click();
  await expect(page.getByTestId('sudoku-grid')).toBeVisible();
  await context.setOffline(false);
});
