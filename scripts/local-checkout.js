import http from 'node:http';
import assert from 'node:assert/strict';

const URL = new URL(process.argv[1] || 'http://127.0.0.1:9999/api/health');
const response = await fetch(URL);
assert.strictEqual(response.status, 200, 'health endpoint must return 200');
const data = await response.json();
assert.strictEqual(data.status, 'ok');
console.log('health', data);
