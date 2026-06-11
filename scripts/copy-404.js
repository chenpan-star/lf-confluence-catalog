/**
 * GitHub Pages SPA fallback: serve index.html for unknown routes.
 */
import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const index = join(dist, 'index.html');
const notFound = join(dist, '404.html');

if (!existsSync(index)) {
  console.error('dist/index.html not found — run vite build first');
  process.exit(1);
}

copyFileSync(index, notFound);
console.log('Copied dist/index.html → dist/404.html (GitHub Pages SPA)');
