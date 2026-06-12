/** Helix Twist icons — ball over spun ring stack on violet gradient. */
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
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#181230"/>
        <stop offset="1" stop-color="#33205c"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <rect x="46" y="20" width="8" height="64" rx="3" fill="#4a3a78"/>
      <ellipse cx="50" cy="48" rx="32" ry="9" fill="none" stroke="#8b5cf6" stroke-width="9" stroke-dasharray="40 14"/>
      <ellipse cx="50" cy="68" rx="32" ry="9" fill="none" stroke="#6d3fd4" stroke-width="9" stroke-dasharray="34 18"/>
      <circle cx="50" cy="26" r="10" fill="#ff6ec4"/>
      <circle cx="46.5" cy="23.5" r="2.8" fill="#fff"/>
      <circle cx="53.5" cy="23.5" r="2.8" fill="#fff"/>
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
