import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('docker local Vite config proxies API only through the backend service', () => {
  const text = fs.readFileSync('vite.config.local.js', 'utf8');
  assert.match(text, /QG_BACKEND_API_BASE_URL/);
  assert.match(text, /http:\/\/127\.0\.0\.1:8080/);
  assert.match(text, /'\/api'/);
  assert.doesNotMatch(text, /QuantGod_.*\.(json|csv)/);
  assert.doesNotMatch(text, /'\/QuantGod_'/);
});

test('primary Vite config does not proxy raw QuantGod runtime artifacts', () => {
  const text = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(text, /'\/api'/);
  assert.doesNotMatch(text, /'\/QuantGod_'/);
});

test('docker local Vite config binds inside container only while Compose binds host to 127.0.0.1', () => {
  const text = fs.readFileSync('vite.config.local.js', 'utf8');
  assert.match(text, /host:\s*'0\.0\.0\.0'/);
  assert.match(text, /strictPort:\s*true/);
});
