/** Paint Rush icons — paint blob trail on dark track gradient. */
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
        <stop offset="0" stop-color="#14122b"/>
        <stop offset="1" stop-color="#262050"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <path d="M50 86 C30 70 36 50 50 34 C64 50 70 70 50 86 Z" fill="#ff4ecd" opacity="0.9"/>
      <rect x="30" y="22" width="14" height="14" rx="4" fill="#36d6ff"/>
      <rect x="56" y="16" width="14" height="14" rx="4" fill="#a8e34d"/>
      <circle cx="50" cy="30" r="13" fill="#ff4ecd"/>
      <circle cx="45.5" cy="27" r="3.4" fill="#fff"/>
      <circle cx="54.5" cy="27" r="3.4" fill="#fff"/>
      <circle cx="45.5" cy="28" r="1.7" fill="#1c1230"/>
      <circle cx="54.5" cy="28" r="1.7" fill="#1c1230"/>
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
