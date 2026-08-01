import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function rel(...parts) {
  return path.join(root, ...parts);
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function exists(relPath) {
  return existsSync(rel(relPath));
}

function read(relPath) {
  return readFileSync(rel(relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(dir, predicate = () => true) {
  const abs = rel(dir);
  if (!existsSync(abs)) return [];
  const out = [];
  const stack = [abs];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(name)) stack.push(full);
      } else if (predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function checkNoCarriageReturns() {
  const files = [
    'package.json',
    '.github/workflows/ci.yml',
    '.gitattributes',
    ...walk('scripts', (file) => /\.(mjs|js)$/.test(file)).map((file) => toPosix(path.relative(root, file))),
    ...walk('tests', (file) => /\.mjs$/.test(file)).map((file) => toPosix(path.relative(root, file))),
    ...walk('src', (file) => /\.(vue|js|mjs|ts|css)$/.test(file)).map((file) => toPosix(path.relative(root, file))),
  ];
  for (const file of files) {
    if (!exists(file)) continue;
    const content = read(file);
    assert(!content.includes('\r'), `${file} contains CR/CRLF/CR-only line endings; use LF`);
  }
}

function checkHashbangScriptsAreExecutableCode() {
  const files = walk('scripts', (file) => /\.(mjs|js)$/.test(file));
  for (const full of files) {
    const relPath = toPosix(path.relative(root, full));
    const content = readFileSync(full, 'utf8');
    const lines = content.split('\n');
    if (content.startsWith('#!')) {
      assert(lines.length > 1, `${relPath} has a hashbang but no LF after it; Node will treat the file as a comment`);
      assert(lines[0].length <= 120, `${relPath} hashbang line is suspiciously long`);
      assert(!lines.slice(1).some((line) => line.startsWith('#!')), `${relPath} contains a repeated hashbang`);
    }
  }
}

function checkCriticalFileLineCounts() {
  const minimums = {
    'package.json': 20,
    '.github/workflows/ci.yml': 20,
    'scripts/frontend_api_contract_guard.mjs': 40,
    'scripts/frontend_structure_guard.mjs': 40,
    'scripts/frontend_workspace_boundary_guard.mjs': 40,
    'scripts/frontend_domain_workspace_guard.mjs': 40,
    'scripts/frontend_dashboard_workspace_guard.mjs': 40,
    'scripts/frontend_mt5_workspace_guard.mjs': 40,
    'scripts/frontend_governance_workspace_guard.mjs': 40,
    'scripts/frontend_paramlab_workspace_guard.mjs': 40,
    'scripts/frontend_research_workspace_guard.mjs': 40,
    'scripts/frontend_legacy_deprecation_guard.mjs': 40,
    'scripts/frontend_lf_integrity_guard.mjs': 40,
    'tests/frontend_api_contract_guard.test.mjs': 10,
    'tests/frontend_structure_guard.test.mjs': 10,
    'tests/frontend_workspace_boundary_guard.test.mjs': 10,
    'tests/frontend_domain_workspace_guard.test.mjs': 10,
    'tests/frontend_dashboard_workspace_guard.test.mjs': 10,
    'tests/frontend_mt5_workspace_guard.test.mjs': 10,
    'tests/frontend_governance_workspace_guard.test.mjs': 10,
    'tests/frontend_paramlab_workspace_guard.test.mjs': 10,
    'tests/frontend_research_workspace_guard.test.mjs': 10,
    'tests/frontend_legacy_deprecation_guard.test.mjs': 10,
    'tests/frontend_lf_integrity_guard.test.mjs': 10,
    'src/App.vue': 3,
  };
  for (const [file, min] of Object.entries(minimums)) {
    if (!exists(file)) continue;
    const count = lineCount(read(file));
    assert(count >= min, `${file} has only ${count} LF lines; expected at least ${min}`);
  }

  if (exists('src/App.vue')) {
    const count = lineCount(read('src/App.vue'));
    assert(count <= 80, `src/App.vue has ${count} lines; AppShell entry must stay lightweight`);
  }
}

function checkPackageAndCi() {
  const pkg = exists('package.json') ? JSON.parse(read('package.json')) : {};
  assert(pkg.scripts && pkg.scripts['lf-integrity'] === 'node scripts/frontend_lf_integrity_guard.mjs', 'package.json must include npm run lf-integrity');

  const ci = exists('.github/workflows/ci.yml') ? read('.github/workflows/ci.yml') : '';
  assert(ci.includes('npm run lf-integrity'), 'CI must run npm run lf-integrity');
}

checkNoCarriageReturns();
checkHashbangScriptsAreExecutableCode();
checkCriticalFileLineCounts();
checkPackageAndCi();

if (failures.length > 0) {
  console.error('Frontend LF integrity guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Frontend LF integrity guard OK');
