/** Bank Shot icons — bullet zigzag/ricochet on slate→cyan gradient. */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');
mkdirSync(pub, { recursive: true });

const mark = (inset, rx = 24) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0d1a2e"/>
        <stop offset="1" stop-color="#050e1c"/>
      </linearGradient>
      <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7ee8ff"/>
        <stop offset="1" stop-color="#00d4ff"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <!-- ricochet path: top-right bounces off right wall, bounces off bottom, center -->
      <polyline points="20,80 72,28 72,72 28,72"
        fill="none" stroke="url(#trail)" stroke-width="8"
        stroke-linecap="round" stroke-linejoin="round"/>
      <!-- bullet dot at the end -->
      <circle cx="28" cy="72" r="7" fill="#7ee8ff"/>
      <circle cx="28" cy="72" r="3.5" fill="#ffffff"/>
      <!-- turret base at start -->
      <circle cx="20" cy="80" r="7" fill="#4a7cff" opacity="0.9"/>
      <circle cx="20" cy="80" r="3" fill="#a0d4ff"/>
    </g>
  </svg>`;

writeFileSync(join(pub, 'favicon.svg'), mark(0).trim());

const targets = [
  { file: 'pwa-192.png', size: 192, inset: 0, rx: 24, transparent: true },
  { file: 'pwa-512.png', size: 512, inset: 0, rx: 24, transparent: true },
  { file: 'maskable-512.png', size: 512, inset: 10, rx: 0, transparent: false },
  { file: 'apple-touch-icon.png', size: 180, inset: 0, rx: 0, transparent: false },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${mark(t.inset, t.rx)}`,
  );
  const buf = await page.screenshot({ omitBackground: t.transparent });
  writeFileSync(join(pub, t.file), buf);
  console.log('wrote', t.file);
}
await browser.close();
console.log('icons done');
