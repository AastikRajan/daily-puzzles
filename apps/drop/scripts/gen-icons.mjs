/**
 * Generates all PWA icons — glossy candy orb mark on pink→orange gradient.
 * Run: node scripts/gen-icons.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');
mkdirSync(pub, { recursive: true });

/** Glossy orb SVG mark */
const mark = (inset, rx = 24) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff6eb4"/>
        <stop offset="0.55" stop-color="#ff8a50"/>
        <stop offset="1" stop-color="#ff9a44"/>
      </linearGradient>
      <radialGradient id="orb" cx="38%" cy="35%" r="55%">
        <stop offset="0" stop-color="#fff8fc" stop-opacity="1"/>
        <stop offset="0.4" stop-color="#ff6eb4" stop-opacity="1"/>
        <stop offset="1" stop-color="#cc3d7a" stop-opacity="1"/>
      </radialGradient>
      <radialGradient id="gloss" cx="38%" cy="28%" r="42%">
        <stop offset="0" stop-color="rgba(255,255,255,0.75)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <circle cx="50" cy="52" r="34" fill="url(#orb)"/>
      <circle cx="50" cy="52" r="34" fill="url(#gloss)"/>
      <circle cx="42" cy="48" r="3.5" fill="rgba(0,0,0,0.5)"/>
      <circle cx="58" cy="48" r="3.5" fill="rgba(0,0,0,0.5)"/>
      <path d="M42 57 Q50 64 58 57" stroke="rgba(0,0,0,0.45)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
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
