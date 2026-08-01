/**
 * QuantGodFrontend structure guard.
 *
 * Keeps the split frontend maintainable after retiring the legacy monolithic
 * workspace from active routing.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_FILES = [
  'src/App.vue',
  'src/app/AppShell.vue',
  'src/app/navigation.js',
  'src/app/workspaceRegistry.js',
  'src/stores/workspaceStore.js',
];

const FORBIDDEN_ROOT_DIRS = ['Dashboard', 'MQL5', 'tools'];

function rel(root, target) {
  return path.relative(root, target).replaceAll(path.sep, '/') || '.';
}

function fileText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function existsAsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function existsAsFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function checkRequiredFiles(root) {
  return REQUIRED_FILES
    .filter((relativePath) => !existsAsFile(path.join(root, relativePath)))
    .map((relativePath) => `${relativePath}: required modular shell file is missing`);
}

function checkSplitBoundary(root) {
  return FORBIDDEN_ROOT_DIRS
    .filter((dirName) => existsAsDir(path.join(root, dirName)))
    .map((dirName) => `${dirName}/: frontend split-boundary violation`);
}

function checkAppShell(root) {
  const errors = [];
  const appPath = path.join(root, 'src/App.vue');
  if (!existsAsFile(appPath)) {
    return errors;
  }
  const text = fileText(appPath);
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > 80) {
    errors.push(`src/App.vue: expected lightweight shell wrapper, got ${lineCount} lines`);
  }
  if (!text.includes("./app/AppShell.vue")) {
    errors.push('src/App.vue: must import ./app/AppShell.vue');
  }
  if (text.includes('loadDashboardState(') || text.includes('fetch(')) {
    errors.push('src/App.vue: must not contain dashboard loading logic or raw fetch');
  }
  return errors;
}

function checkLegacyArchiveIsNotRouted(root) {
  const errors = [];
  const registryPath = path.join(root, 'src/app/workspaceRegistry.js');
  const navigationPath = path.join(root, 'src/app/navigation.js');
  const registry = existsAsFile(registryPath) ? fileText(registryPath) : '';
  const navigation = existsAsFile(navigationPath) ? fileText(navigationPath) : '';
  for (const [label, text] of [
    ['src/app/workspaceRegistry.js', registry],
    ['src/app/navigation.js', navigation],
  ]) {
    if (text.includes('LegacyWorkbench') || text.includes("key: 'legacy'") || text.includes('workspaces/legacy')) {
      errors.push(`${label}: legacy archive must not be routed as an active workspace`);
    }
  }
  return errors;
}

export function runFrontendStructureGuard(repoRoot = process.cwd()) {
  const root = path.resolve(repoRoot);
  return [
    ...checkRequiredFiles(root),
    ...checkSplitBoundary(root),
    ...checkAppShell(root),
    ...checkLegacyArchiveIsNotRouted(root),
  ];
}

export function formatErrors(errors) {
  if (!errors.length) return 'QuantGodFrontend structure guard OK';
  return ['QuantGodFrontend structure guard failed:', ...errors.map((error) => `- ${error}`)].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = runFrontendStructureGuard(process.argv[2] || process.cwd());
  console.log(formatErrors(errors));
  process.exit(errors.length ? 1 : 0);
}
