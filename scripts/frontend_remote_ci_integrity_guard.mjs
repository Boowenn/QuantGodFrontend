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

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split('\n').length;
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
        if (!['node_modules', 'dist', '.git', 'coverage'].includes(name)) {
          stack.push(full);
        }
      } else if (predicate(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function checkWorkflowShape() {
  const workflowPath = '.github/workflows/ci.yml';
  assert(exists(workflowPath), `${workflowPath} is missing`);
  if (!exists(workflowPath)) return;

  const workflow = read(workflowPath);
  assert(!workflow.includes('\r'), `${workflowPath} must use LF, not CR/CRLF`);
  assert(lineCount(workflow) >= 50, `${workflowPath} has only ${lineCount(workflow)} LF lines; CI YAML appears compressed`);
  assert(/^name:\s*QuantGod Frontend CI/m.test(workflow), `${workflowPath} must have a name header`);
  assert(/^on:/m.test(workflow), `${workflowPath} must contain an on: section on its own line`);
  assert(/^jobs:/m.test(workflow), `${workflowPath} must contain jobs: on its own line`);
  assert(workflow.includes('npm run remote-ci-integrity'), `${workflowPath} must run npm run remote-ci-integrity`);
  assert(workflow.includes('npm run lf-integrity'), `${workflowPath} must run npm run lf-integrity`);
  assert(workflow.includes('npm run legacy-slim'), `${workflowPath} must run npm run legacy-slim`);
  assert(workflow.includes('npm run build'), `${workflowPath} must run npm run build`);
  assert(!workflow.includes('name: QuantGod Frontend CI on:'), `${workflowPath} appears to be single-line YAML`);
}

function checkPackageShape() {
  const packagePath = 'package.json';
  assert(exists(packagePath), `${packagePath} is missing`);
  if (!exists(packagePath)) return;

  const content = read(packagePath);
  assert(!content.includes('\r'), `${packagePath} must use LF, not CR/CRLF`);
  assert(lineCount(content) >= 30, `${packagePath} has only ${lineCount(content)} LF lines; package.json should be pretty printed`);
  const pkg = JSON.parse(content);
  assert(pkg.scripts && pkg.scripts['remote-ci-integrity'] === 'node scripts/frontend_remote_ci_integrity_guard.mjs', 'package.json must define npm run remote-ci-integrity');
  for (const scriptName of [
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
    'lf-integrity',
    'legacy-slim',
  ]) {
    assert(pkg.scripts && pkg.scripts[scriptName], `package.json is missing ${scriptName}`);
  }
}

function checkScriptShape() {
  const scripts = walk('scripts', (file) => /\.mjs$/.test(file));
  assert(scripts.length >= 10, 'expected frontend guard scripts under scripts/');
  for (const full of scripts) {
    const relPath = toPosix(path.relative(root, full));
    const content = readFileSync(full, 'utf8');
    const count = lineCount(content);
    assert(!content.includes('\r'), `${relPath} must use LF, not CR/CRLF`);
    assert(!content.startsWith('#!'), `${relPath} should not use a hashbang; npm invokes it with node and hashbang compression can create no-op guards`);
    assert(count >= 20, `${relPath} has only ${count} LF lines; script appears compressed`);
    if (relPath.includes('_guard.mjs')) {
      assert(count >= 40, `${relPath} has only ${count} LF lines; guard appears compressed`);
      assert(content.includes('failures') || content.includes('errors') || content.includes('function fail(') || content.includes('function assert') || content.includes('assert('), `${relPath} should contain explicit guard assertions`);
      assert(content.includes('process.exit(') || content.includes('process.exitCode'), `${relPath} should fail hard with process.exit or process.exitCode`);
    }
  }
}

function checkTestShape() {
  const tests = walk('tests', (file) => /\.mjs$/.test(file));
  assert(tests.length >= 10, 'expected frontend node tests under tests/');
  for (const full of tests) {
    const relPath = toPosix(path.relative(root, full));
    const content = readFileSync(full, 'utf8');
    const count = lineCount(content);
    assert(!content.includes('\r'), `${relPath} must use LF, not CR/CRLF`);
    assert(count >= 10, `${relPath} has only ${count} LF lines; test appears compressed`);
    assert(content.includes("node:test") || content.includes('test('), `${relPath} should contain node:test assertions`);
  }
}

function checkSourceStillModular() {
  const appPath = 'src/App.vue';
  assert(exists(appPath), `${appPath} is missing`);
  if (exists(appPath)) {
    const app = read(appPath);
    assert(lineCount(app) <= 80, `${appPath} must stay as a lightweight AppShell wrapper`);
    assert(app.includes('./app/AppShell.vue'), `${appPath} must import AppShell`);
  }

  const legacyPath = 'src/workspaces/legacy';
  assert(!exists(legacyPath), `${legacyPath} must not exist after legacy source removal`);
  const archivePath = 'archive/legacy-workbench/LegacyWorkbenchFull.vue';
  assert(!exists(archivePath), `${archivePath} must not exist after full legacy source removal`);
}

checkWorkflowShape();
checkPackageShape();
checkScriptShape();
checkTestShape();
checkSourceStillModular();

if (failures.length > 0) {
  console.error('Frontend remote CI integrity guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Frontend remote CI integrity guard OK');
