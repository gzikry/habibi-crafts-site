import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('builder parity', () => {
  it('regenerates the committed storefront pages', () => {
    const out = execFileSync('python3', ['pipeline/check-builder-parity.py'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.match(out, /builder output matches site/);
  });
});
