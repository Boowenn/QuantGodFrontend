import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_ROOT = path.join(ROOT, 'tests');
const SYNTHETIC_ACCOUNT_PATTERN = /^9000\d{4}$/;
const LOGIN_LITERAL_PATTERN = /\blogin\s*:\s*['"](\d{6,})['"]/g;
const SERVER_LITERAL_PATTERN = /\b(?:server|trade_server)\s*:\s*['"]([^'"]+)['"]/g;

function sourceFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:js|mjs|cjs)$/.test(entry.name) ? [target] : [];
  });
}

test('test fixtures use only clearly synthetic MT5 account logins', () => {
  const violations = [];
  for (const file of sourceFiles(TEST_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(LOGIN_LITERAL_PATTERN)) {
      if (!SYNTHETIC_ACCOUNT_PATTERN.test(match[1])) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${path.relative(ROOT, file)}:${line}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `MT5 account fixtures must use reserved 9000xxxx synthetic IDs: ${violations.join(', ')}`,
  );
});

test('test fixtures use only clearly synthetic broker server names', () => {
  const violations = [];
  for (const file of sourceFiles(TEST_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(SERVER_LITERAL_PATTERN)) {
      if (!/synthetic/i.test(match[1])) {
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${path.relative(ROOT, file)}:${line}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `broker server fixtures must be explicitly synthetic: ${violations.join(', ')}`,
  );
});
