import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');

const BANNED = [
  /workbench/i,
  /Still on the bench/,
  /once the blank/i,
  /that blank is real/i,
  /\$44[–-]\$48/,
];

function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...htmlFiles(path));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

describe('customer-facing storefront copy', () => {
  it('bans roadmap and blank-process commentary from site HTML', () => {
    const files = htmlFiles(site);
    assert.ok(files.length > 20, 'expected the published HTML tree');
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      for (const pattern of BANNED) {
        assert.doesNotMatch(html, pattern, file);
      }
    }
  });
});
