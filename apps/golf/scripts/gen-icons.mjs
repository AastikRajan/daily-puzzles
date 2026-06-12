/** Glow Golf icons — flag-in-hole mark on green→cyan glow gradient. */
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
        <stop offset="0" stop-color="#062e26"/>
        <stop offset="1" stop-color="#0a0a1a"/>
      </linearGradient>
      <linearGradient id="fl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff3366"/>
        <stop offset="1" stop-color="#ff7a9e"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <ellipse cx="50" cy="72" rx="26" ry="9" fill="#000" stroke="#00ffcc" stroke-width="2.5"/>
      <line x1="50" y1="72" x2="50" y2="22" stroke="#eafffa" stroke-width="4" stroke-linecap="round"/>
      <path d="M50 22 L80 31 L50 40 Z" fill="url(#fl)"/>
      <circle cx="34" cy="68" r="7" fill="#eafffa"/>
      <circle cx="31.5" cy="65.5" r="2.2" fill="#ffffff" opacity="0.9"/>
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
