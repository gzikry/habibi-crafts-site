import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const builders = [
  'pipeline/build-home.py',
  'pipeline/build-shop.py',
  'pipeline/build-products.py',
  'pipeline/build-sitemap.py',
];

for (const script of builders) {
  const run = spawnSync('python3', [join(root, script)], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
