import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkProject } from '../scripts/frontend_dashboard_workspace_guard.mjs';

function project(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-dashboard-guard-'));
  const files = {
    'package.json': JSON.stringify({
      scripts: { 'dashboard-workspace': 'node scripts/frontend_dashboard_workspace_guard.mjs' },
    }),
    'src/workspaces/dashboard/DashboardWorkspace.vue': [
      '<template><EndpointHealthGrid />全局快照根因 Operator Overview workspace=mt5 workspace=evolution</template>',
      '<script setup>',
      "import { loadDashboardWorkspaceCore } from '../../services/domainApi.js';",
      "import { buildSnapshotRootCauseBanner, buildFrontendSnapshotRecoveryRows } from './dashboardModel.js';",
      "const endpoint = '/api/production-evidence-validation/status';",
      "const overviewEndpoint = '/api/operator/overview';",
      '</script>',
    ].join('\n'),
    'src/workspaces/dashboard/dashboardModel.js': [
      'export function normalizeDashboardSnapshot() {}',
      'export function buildDashboardMetrics() {}',
      'export function buildEndpointHealth() {}',
      'export function buildRuntimeItems() {}',
      'export function buildDailyItems() {}',
      'export function buildSnapshotRootCauseBanner() {}',
      'export function buildFrontendSnapshotRecoveryRows() {}',
      'export function buildSnapshotImpactSummary() {}',
      'export function buildOperatorOverviewItems() {}',
      'export function buildOperatorOverviewBlockerRows() {}',
      'export function buildOperatorOverviewAxisItems() {}',
      'export function buildOperatorOverviewSupportItems() {}',
    ].join('\n'),
    ...overrides,
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return root;
}

test('accepts the Forex-only dashboard workspace', () => {
  assert.deepEqual(checkProject(project()), []);
});

test('rejects direct fetch in dashboard workspace', () => {
  const root = project({
    'src/workspaces/dashboard/DashboardWorkspace.vue': "fetch('/api/latest')",
  });
  assert.match(checkProject(root).join('\n'), /must not call fetch directly/);
});

test('rejects missing dashboard model exports', () => {
  const root = project({
    'src/workspaces/dashboard/dashboardModel.js': 'export function normalizeDashboardSnapshot() {}',
  });
  assert.match(checkProject(root).join('\n'), /missing export buildDashboardMetrics/);
});

test('active Dashboard and MT5 loaders do not request the retired daily-autopilot endpoint', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const service = fs.readFileSync(path.join(root, 'src/services/domainApi.js'), 'utf8');
  assert.doesNotMatch(service, /['"]\/api\/daily-autopilot['"]/);
});
