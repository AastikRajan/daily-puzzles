/** Builds every game app sequentially (vite build, no typecheck — fast path). */
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from './games.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const g of GAMES) {
  process.stdout.write(`building ${g}… `);
  execSync('npx vite build', { cwd: join(root, 'apps', g), stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('done');
}
console.log('\nall 16 built');
