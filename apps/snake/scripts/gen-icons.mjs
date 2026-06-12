/** Snake Pop icons — coiled snake "S" on green→pink gradient. */
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
        <stop offset="0" stop-color="#0a2a1e"/>
        <stop offset="1" stop-color="#2a0a24"/>
      </linearGradient>
      <linearGradient id="sn" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#00f5a0"/>
        <stop offset="1" stop-color="#ff4ecd"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <path d="M70 26 C70 16 30 16 30 30 C30 44 70 40 70 56 C70 70 30 70 30 60"
        fill="none" stroke="url(#sn)" stroke-width="15" stroke-linecap="round"/>
      <circle cx="69" cy="26" r="9.5" fill="#eafff5"/>
      <circle cx="66.5" cy="24" r="2.6" fill="#10241c"/>
      <circle cx="72.5" cy="24" r="2.6" fill="#10241c"/>
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
