/**
 * Arcade Hub server — serves every built game under one origin:
 *   http://localhost:8080/          → the hub launcher
 *   http://localhost:8080/<game>/   → that game's built PWA
 * Zero dependencies. Run `npm run arcade` to build everything + serve.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAMES } from './games.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);

    if (path === '/' || path === '/index.html') {
      const html = await readFile(join(root, 'scripts', 'arcade-hub.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    const seg = path.split('/').filter(Boolean);
    const game = seg[0];
    if (!GAMES.includes(game)) {
      res.writeHead(404).end('unknown game');
      return;
    }
    let rel = seg.slice(1).join('/');
    if (rel === '') rel = 'index.html';
    let file = join(root, 'apps', game, 'dist', rel);
    try {
      const st = await stat(file);
      if (st.isDirectory()) file = join(file, 'index.html');
    } catch {
      // SPA fallback
      file = join(root, 'apps', game, 'dist', 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => {
  console.log(`\n  🕹  Arcade Hub running:  http://localhost:${PORT}\n`);
  console.log('  (open that on your phone too — use this PC\'s LAN IP)');
});
