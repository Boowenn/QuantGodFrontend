import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const guard = path.join(root, 'scripts/frontend_legacy_deprecation_guard.mjs');

function makeRepo(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-legacy-guard-'));
  const write = (rel, text) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
  };
  write('package.json', JSON.stringify({ scripts: { 'legacy-deprecation': 'node scripts/frontend_legacy_deprecation_guard.mjs' } }));
  write('src/App.vue', '<template><AppShell /></template>\n<script setup>import AppShell from \'./app/AppShell.vue\';</script>\n');
  write('src/stores/workspaceStore.js', "export const DEFAULT_WORKSPACE = 'dashboard';\n");
  write('src/app/navigation.js', "export const defaultWorkspace = 'dashboard';\n");
  write('src/app/workspaceRegistry.js', "export default { dashboard: {} };\n");
  for (const rel of [
    'src/workspaces/dashboard/DashboardWorkspace.vue',
    'src/workspaces/mt5/Mt5Workspace.vue',
    'src/workspaces/governance/GovernanceWorkspace.vue',
    'src/workspaces/paramlab/ParamLabWorkspace.vue',
    'src/workspaces/research/ResearchWorkspace.vue',
    'src/workspaces/phase1/Phase1Workspace.vue',
    'src/workspaces/phase2/Phase2OperationsWorkspace.vue',
    'src/workspaces/phase3/Phase3Workspace.vue',
  ]) write(rel, '<template><section /></template>\n');
  write('scripts/frontend_legacy_deprecation_guard.mjs', fs.readFileSync(guard, 'utf8'));
  for (const [rel, text] of Object.entries(overrides)) write(rel, text);
  return dir;
}

function runGuard(dir) {
  return spawnSync(process.execPath, ['scripts/frontend_legacy_deprecation_guard.mjs'], {
    cwd: dir,
    encoding: 'utf8',
  });
}

test('accepts fully removed legacy source with migrated workspaces', () => {
  const dir = makeRepo();
  const result = runGuard(dir);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects legacy as default workspace', () => {
  const dir = makeRepo({ 'src/stores/workspaceStore.js': "export const DEFAULT_WORKSPACE = 'legacy';\n" });
  const result = runGuard(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /legacy must not be the default workspace/);
});

test('rejects legacy source still under src workspaces', () => {
  const dir = makeRepo({ 'src/workspaces/legacy/LegacyWorkbench.vue': '<template>legacy</template>\n' });
  const result = runGuard(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /src\/workspaces\/legacy must be removed/);
});

test('rejects archived legacy source after full removal', () => {
  const dir = makeRepo({
    'archive/legacy-workbench/LegacyWorkbenchFull.vue': `${'<template>LegacyWorkbench</template>\n'.repeat(1200)}`,
  });
  const result = runGuard(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be removed/);
});

test('rejects direct imports of LegacyWorkbench from active workspaces', () => {
  const dir = makeRepo({ 'src/workspaces/dashboard/DashboardWorkspace.vue': "<script setup>import LegacyWorkbench from '../legacy/LegacyWorkbench.vue';</script>\n" });
  const result = runGuard(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not import or render LegacyWorkbench directly/);
});
