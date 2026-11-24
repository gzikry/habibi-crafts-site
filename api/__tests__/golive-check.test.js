import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function run(dir) {
  return spawnSync('python3', ['scripts/golive-check', dir], { cwd: root, encoding: 'utf8' });
}

describe('golive check', () => {
  it('lists closed-shop copy and a missing key without writing anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'habibi-golive-'));
    writeFileSync(join(dir, 'cart.html'), '<p>We are not taking orders yet.</p><button>Opening soon</button>');
    writeFileSync(join(dir, 'public-config.js'), [
      'window.HABIBI_PUBLIC_CONFIG = {',
      '  CHECKOUT_ENABLED: true,',
      "  STRIPE_PUBLISHABLE_KEY: '',",
      "  CHECKOUT_API_BASE: ''",
      '};'
    ].join('\n'));
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /not taking orders yet/);
    assert.match(result.stdout, /Opening soon/);
    assert.match(result.stdout, /publishable Stripe key/);
    assert.match(result.stdout, /CHECKOUT_API_BASE/);
  });

  it('passes a flag-on build whose health endpoint answers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'habibi-golive-ok-'));
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":"ok","checkout_enabled":true}');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    writeFileSync(join(dir, 'cart.html'), '<button>Check out</button>');
    writeFileSync(join(dir, 'public-config.js'), [
      'window.HABIBI_PUBLIC_CONFIG = {',
      '  CHECKOUT_ENABLED: true,',
      "  STRIPE_PUBLISHABLE_KEY: 'pk_test_example',",
      `  CHECKOUT_API_BASE: 'http://127.0.0.1:${port}'`,
      '};'
    ].join('\n'));
    try {
      const result = await new Promise((resolve) => {
        execFile('python3', ['scripts/golive-check', dir], { cwd: root }, (error, stdout, stderr) => {
          resolve({ status: error && error.code ? error.code : 0, stdout, stderr });
        });
      });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /golive-check passed/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
