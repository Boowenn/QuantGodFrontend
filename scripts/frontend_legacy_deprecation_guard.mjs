import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function rel(...parts) {
  return path.join(root, ...parts);
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function read(relPath) {
  return readFileSync(rel(relPath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function fileExists(relPath) {
  return existsSync(rel(relPath));
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\n|\r/).length;
}

function lineCount(text) {
  return text.split(/\r\n|\r|\n/).length;
}

function walkFiles(dir, predicate = () => true) {
  const abs = rel(dir);
  if (!existsSync(abs)) return [];
  const out = [];
  const stack = [abs];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (predicate(full)) out.push(full);
    }
  }
  return out;
}

function checkCoreFiles() {
  const required = [
    'src/App.vue',
    'src/app/workspaceRegistry.js',
    'src/app/navigation.js',
    'src/stores/workspaceStore.js',
  ];
  for (const file of required) assert(fileExists(file), `${file} is required for legacy removal tracking`);
}

function checkLegacySourceRemoved() {
  assert(!fileExists('src/workspaces/legacy'), 'src/workspaces/legacy must be removed; legacy UI is archive-only after migration');
}

function checkLegacyArchiveRemoved() {
  const archivePath = 'archive/legacy-workbench/LegacyWorkbenchFull.vue';
  assert(!fileExists(archivePath), `${archivePath} must be removed after full workspace migration`);
}

function checkDefaultWorkspace() {
  const storePath = 'src/stores/workspaceStore.js';
  const navigationPath = 'src/app/navigation.js';
  const store = fileExists(storePath) ? read(storePath) : '';
  const navigation = fileExists(navigationPath) ? read(navigationPath) : '';
  assert(!/DEFAULT_WORKSPACE\s*=\s*['"]legacy['"]/.test(store), 'legacy must not be the default workspace');
  assert(!/currentWorkspace\s*=\s*['"]legacy['"]/.test(store), 'legacy must not be the initial workspace');
  assert(!/defaultWorkspace\s*:\s*['"]legacy['"]/.test(navigation), 'navigation must not default to legacy');
  assert(store.includes('dashboard') || navigation.includes('dashboard'), 'dashboard should remain the default operational workspace');
}

function checkRegistryBoundary() {
  const registryPath = 'src/app/workspaceRegistry.js';
  if (!fileExists(registryPath)) return;
  const registry = read(registryPath);
  assert(!registry.includes('LegacyWorkbench'), 'workspaceRegistry must not register the archived legacy workbench');
  assert(
    !registry.includes('workspaces/legacy') && !registry.includes('../workspaces/legacy/LegacyWorkbench.vue'),
    'workspaceRegistry must not import the archived legacy workbench',
  );

  const srcFiles = walkFiles('src', (full) => /\.(vue|js|mjs|ts)$/.test(full));
  for (const full of srcFiles) {
    const relPath = toPosix(path.relative(root, full));
    if (relPath === 'src/app/workspaceRegistry.js') continue;
    const content = readFileSync(full, 'utf8');
    assert(!content.includes('LegacyWorkbench'), `${relPath} must not import or render LegacyWorkbench directly`);
    assert(!content.includes('workspaces/legacy/LegacyWorkbench.vue'), `${relPath} must not import LegacyWorkbench directly`);
  }
}

function checkMigratedWorkspacesExist() {
  const expected = [
    'src/workspaces/dashboard/DashboardWorkspace.vue',
    'src/workspaces/mt5/Mt5Workspace.vue',
    'src/workspaces/governance/GovernanceWorkspace.vue',
    'src/workspaces/paramlab/ParamLabWorkspace.vue',
    'src/workspaces/research/ResearchWorkspace.vue',
    'src/workspaces/phase1/Phase1Workspace.vue',
    'src/workspaces/phase2/Phase2OperationsWorkspace.vue',
    'src/workspaces/phase3/Phase3Workspace.vue',
  ];
  for (const file of expected) assert(fileExists(file), `${file} must exist before legacy source can be removed`);
}

function checkAppShell() {
  const app = fileExists('src/App.vue') ? read('src/App.vue') : '';
  assert(!app.includes('LegacyWorkbench'), 'src/App.vue must not import LegacyWorkbench');
  assert(app.includes('AppShell'), 'src/App.vue should remain a light AppShell entry');
  assert(lineCount(app) <= 80, 'src/App.vue must remain lightweight');
}

function checkPackageScript() {
  if (!fileExists('package.json')) return;
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts && pkg.scripts['legacy-deprecation'] === 'node scripts/frontend_legacy_deprecation_guard.mjs', 'package.json must include npm run legacy-deprecation');
}

checkCoreFiles();
checkLegacySourceRemoved();
checkLegacyArchiveRemoved();
checkDefaultWorkspace();
checkRegistryBoundary();
checkMigratedWorkspacesExist();
checkAppShell();
checkPackageScript();

if (failures.length > 0) {
  console.error('Frontend legacy deprecation guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Frontend legacy deprecation guard OK');
