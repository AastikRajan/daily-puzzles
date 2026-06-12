/** Smash Drop icons — cracked plate + ball on red→yellow gradient. */
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
        <stop offset="0" stop-color="#2a0a00"/>
        <stop offset="1" stop-color="#1a1200"/>
      </linearGradient>
      <linearGradient id="plate" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff4e00"/>
        <stop offset="0.5" stop-color="#ffe94e"/>
        <stop offset="1" stop-color="#ff4e00"/>
      </linearGradient>
      <radialGradient id="ball" cx="40%" cy="35%" r="60%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.4" stop-color="#b8d4ff"/>
        <stop offset="1" stop-color="#3670c0"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <!-- cracked plates -->
      <rect x="10" y="62" width="38" height="10" rx="3" fill="url(#plate)" opacity="0.9"/>
      <rect x="52" y="68" width="38" height="10" rx="3" fill="url(#plate)" opacity="0.9"/>
      <!-- crack lines -->
      <line x1="44" y1="62" x2="50" y2="72" stroke="#1a1200" stroke-width="2.5"/>
      <line x1="48" y1="62" x2="54" y2="72" stroke="#1a1200" stroke-width="2.5"/>
      <!-- debris chips -->
      <rect x="20" y="50" width="8" height="5" rx="1" fill="#ff6a00" opacity="0.8" transform="rotate(-25 24 52)"/>
      <rect x="68" y="48" width="6" height="4" rx="1" fill="#ffe94e" opacity="0.8" transform="rotate(18 71 50)"/>
      <rect x="40" y="44" width="5" height="4" rx="1" fill="#ff4e00" opacity="0.7" transform="rotate(-10 42 46)"/>
      <!-- ball -->
      <circle cx="50" cy="34" r="18" fill="url(#ball)"/>
      <circle cx="43" cy="28" r="5" fill="rgba(255,255,255,0.6)"/>
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
