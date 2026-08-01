import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guardPath = path.join(repoRoot, 'scripts/frontend_workspace_deeplink_guard.mjs');

test('deep-link guard passes on current repository', () => {
  const result = spawnSync(process.execPath, [guardPath], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('retired workspace deep links normalize to MT5', async () => {
  const { normalizeWorkspaceKey, readWorkspaceFromUrl } = await import('../src/app/workspaceUrl.js');
  assert.equal(normalizeWorkspaceKey('hfm-crypto'), 'mt5');
  assert.equal(readWorkspaceFromUrl({ search: '?workspace=hfm-crypto', pathname: '/vue/' }), 'mt5');
  assert.equal(readWorkspaceFromUrl({ search: '', pathname: '/vue/hfm-crypto' }), 'mt5');
});

test('sidebar uses concise Chinese labels without changing workspace keys', async () => {
  const { findWorkspace } = await import('../src/app/navigation.js');

  assert.deepEqual(
    ['dashboard', 'mt5', 'evolution'].map((key) => ({ key, label: findWorkspace(key).label })),
    [
      { key: 'dashboard', label: '总览' },
      { key: 'mt5', label: 'MT5' },
      { key: 'evolution', label: '策略进化' },
    ],
  );
  assert.ok(findWorkspace('dashboard').description.length <= 22);
  assert.ok(findWorkspace('evolution').description.length <= 22);
});

test('snapshot health first paint uses only the aggregate operator overview', () => {
  const service = fs.readFileSync(path.join(repoRoot, 'src/services/domainApi.js'), 'utf8');
  const start = service.indexOf('const operatorOverviewEntries');
  const end = service.indexOf('export async function loadDashboardWorkspace');
  const body = service.slice(start, end);
  assert.notEqual(start, -1);
  assert.match(body, /['"]\/api\/operator\/overview['"]/);
  assert.doesNotMatch(body, /['"]\/api\/latest['"]/);
  assert.doesNotMatch(body, /['"]\/api\/dashboard\/state['"]/);
  assert.doesNotMatch(body, /['"]\/api\/mt5-readonly\/snapshot['"]/);
  assert.doesNotMatch(body, /['"]\/api\/usdjpy-strategy-lab\/live-loop['"]/);
  assert.doesNotMatch(body, /live-automation/);
});

test('guard rejects a fixture without URL synchronization', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-deeplink-invalid-'));
  fs.mkdirSync(path.join(root, 'src/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/app/AppShell.vue'), '<template><div /></template>');
  const result = spawnSync(process.execPath, [guardPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, QG_FRONTEND_ROOT: root },
  });
  assert.notEqual(result.status, 0);
});
