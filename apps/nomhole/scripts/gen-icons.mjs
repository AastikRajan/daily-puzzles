/** Nom Hole icons — black hole with orbit ring on purple→orange gradient. */
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
      <radialGradient id="bg" cx="35%" cy="35%" r="65%">
        <stop offset="0" stop-color="#5b2d8e"/>
        <stop offset="0.6" stop-color="#2d0a5e"/>
        <stop offset="1" stop-color="#1a0530"/>
      </radialGradient>
      <radialGradient id="hole" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#0a0010"/>
        <stop offset="0.7" stop-color="#050008"/>
        <stop offset="1" stop-color="#000000"/>
      </radialGradient>
    </defs>
    <rect width="100" height="100" rx="${rx}" fill="url(#bg)"/>
    <g transform="translate(${inset} ${inset}) scale(${(100 - inset * 2) / 100})">
      <!-- outer glow -->
      <circle cx="50" cy="55" r="26" fill="rgba(140,40,240,0.25)"/>
      <!-- hole body -->
      <ellipse cx="50" cy="55" rx="18" ry="14" fill="url(#hole)"/>
      <!-- accent rim -->
      <ellipse cx="50" cy="55" rx="18" ry="14" fill="none" stroke="#c77dff" stroke-width="2.5"/>
      <!-- orbit ring -->
      <ellipse cx="50" cy="50" rx="32" ry="12" fill="none" stroke="#ff9ef5" stroke-width="2"
        stroke-dasharray="8 5" transform="rotate(-25 50 50)" opacity="0.85"/>
      <!-- orbiting dot -->
      <circle cx="78" cy="47" r="3.5" fill="#ffbe0b"/>
      <!-- swirl hint inside hole -->
      <path d="M44 55 Q48 51 52 55 Q56 59 60 55"
        fill="none" stroke="rgba(200,150,255,0.45)" stroke-width="1.5" stroke-linecap="round"/>
    </g>
  </svg>`;

writeFileSync(join(pub, 'favicon.svg'), mark(0).trim());
console.log('wrote favicon.svg');

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
