import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('asset versions', () => {
  it('matches every stylesheet and script reference to SCRIPT_V', () => {
    const out = execFileSync('python3', ['pipeline/check-asset-version.py'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.match(out, /styles\.css=27/);
    assert.match(out, /script and stylesheet versions match, and images are versioned/);
  });
});
