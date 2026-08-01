import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = process.env.QG_FRONTEND_ROOT
  ? path.resolve(process.env.QG_FRONTEND_ROOT)
  : path.resolve(__dirname, '..');

const errors = [];
const shouldCheckGitBlob =
  process.env.QG_CHECK_GIT_BLOB === '1' ||
  process.env.CI === 'true';

function relPath(...parts) {
  return path.join(...parts).replace(/\\/g, '/');
}

function fail(message) {
  errors.push(message);
}

function readWorkingTree(rel) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    fail(`${rel} is missing`);
    return null;
  }
  return fs.readFileSync(abs);
}

function readGitBlob(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: repoRoot,
      encoding: null,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    fail(`git blob ${rel} is missing or unreadable: ${error.message}`);
    return null;
  }
}

function toText(buffer) {
  return buffer.toString('utf8');
}

function countLfLines(buffer) {
  const text = toText(buffer);
  if (text.length === 0) return 0;
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

function assertNoCarriageReturn(label, rel, buffer) {
  if (buffer.includes(13)) {
    fail(`${label} ${rel} contains carriage-return bytes; expected LF-only Git blob`);
  }
}

function assertLineCount(label, rel, buffer, minLines) {
  const lines = countLfLines(buffer);
  if (lines < minLines) {
    fail(`${label} ${rel} has ${lines} LF lines; expected at least ${minLines}`);
  }
}

function assertMaxLineCount(label, rel, buffer, maxLines) {
  const lines = countLfLines(buffer);
  if (lines > maxLines) {
    fail(`${label} ${rel} has ${lines} LF lines; expected at most ${maxLines}`);
  }
}

function assertContains(label, rel, buffer, needle) {
  if (!toText(buffer).includes(needle)) {
    fail(`${label} ${rel} does not contain required marker: ${needle}`);
  }
}

function assertNotContains(label, rel, buffer, needle) {
  if (toText(buffer).includes(needle)) {
    fail(`${label} ${rel} contains forbidden marker: ${needle}`);
  }
}

function assertNoHashbang(label, rel, buffer) {
  if (toText(buffer).startsWith('#!')) {
    fail(`${label} ${rel} starts with a hashbang; guard scripts should be invoked by node explicitly`);
  }
}

function lineSet(buffer) {
  return new Set(toText(buffer).split('\n'));
}

function assertWorkflowShape(label, rel, buffer) {
  const text = toText(buffer);
  const lines = lineSet(buffer);
  const requiredLines = [
    'name: QuantGod Frontend CI',
    'on:',
    '  push:',
    '    branches:',
    '      - main',
    '  pull_request:',
    'permissions:',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
  ];
  for (const line of requiredLines) {
    if (!lines.has(line)) {
      fail(`${label} ${rel} is not a canonical multiline workflow; missing line: ${line}`);
    }
  }
  const guardScripts = [
    'git-blob-integrity',
    'remote-ci-integrity',
    'lf-integrity',
    'contract',
    'structure',
    'workspace-boundary',
    'domain-workspace',
    'dashboard-workspace',
    'mt5-workspace',
    'governance-workspace',
    'paramlab-workspace',
    'research-workspace',
    'legacy-deprecation',
    'legacy-slim',
  ];
  for (const script of guardScripts) {
    if (!text.includes(`npm run ${script}`)) {
      fail(`${label} ${rel} does not invoke npm run ${script}`);
    }
  }
}

function validateBuffer(label, rel, buffer, options) {
  if (!buffer) return;
  assertNoCarriageReturn(label, rel, buffer);
  if (options.minLines) assertLineCount(label, rel, buffer, options.minLines);
  if (options.maxLines) assertMaxLineCount(label, rel, buffer, options.maxLines);
  for (const needle of options.mustContain ?? []) {
    assertContains(label, rel, buffer, needle);
  }
  for (const needle of options.mustNotContain ?? []) {
    assertNotContains(label, rel, buffer, needle);
  }
  if (options.noHashbang) assertNoHashbang(label, rel, buffer);
  if (options.workflow) assertWorkflowShape(label, rel, buffer);
}

const criticalFiles = [
  {
    rel: relPath('.github', 'workflows', 'ci.yml'),
    minLines: 80,
    workflow: true,
  },
  {
    rel: 'package.json',
    minLines: 30,
    mustContain: ['"git-blob-integrity"', '"legacy-slim"'],
  },
  {
    rel: relPath('scripts', 'frontend_git_blob_integrity_guard.mjs'),
    minLines: 120,
    mustContain: ['QG_CHECK_GIT_BLOB', 'git show', 'contains carriage-return bytes'],
    noHashbang: true,
  },
  {
    rel: relPath('tests', 'frontend_git_blob_integrity_guard.test.mjs'),
    minLines: 30,
    mustContain: ['node:test', 'git blob integrity'],
  },
  {
    rel: relPath('src', 'App.vue'),
    minLines: 3,
    maxLines: 80,
    mustContain: ["import AppShell from './app/AppShell.vue'"],
  },
];

for (const spec of criticalFiles) {
  const buffer = readWorkingTree(spec.rel);
  validateBuffer('working tree', spec.rel, buffer, spec);
}

const scriptsDir = path.join(repoRoot, 'scripts');
if (fs.existsSync(scriptsDir)) {
  for (const fileName of fs.readdirSync(scriptsDir)) {
    if (!fileName.endsWith('.mjs')) continue;
    const rel = relPath('scripts', fileName);
    const buffer = readWorkingTree(rel);
    validateBuffer('working tree', rel, buffer, {
      minLines: fileName.startsWith('frontend_') ? 25 : 5,
      noHashbang: true,
    });
  }
}

if (shouldCheckGitBlob) {
  for (const spec of criticalFiles) {
    const buffer = readGitBlob(spec.rel);
    validateBuffer('git blob', spec.rel, buffer, spec);
  }
  if (fs.existsSync(scriptsDir)) {
    for (const fileName of fs.readdirSync(scriptsDir)) {
      if (!fileName.endsWith('.mjs')) continue;
      const rel = relPath('scripts', fileName);
      const buffer = readGitBlob(rel);
      validateBuffer('git blob', rel, buffer, {
        minLines: fileName.startsWith('frontend_') ? 25 : 5,
        noHashbang: true,
      });
    }
  }
}

if (errors.length) {
  console.error('Frontend Git blob integrity guard failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  const mode = shouldCheckGitBlob ? 'working tree + git blob' : 'working tree';
  console.log(`Frontend Git blob integrity guard OK (${mode})`);
}
