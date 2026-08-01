import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function read(root, relativePath) {
  const file = path.join(root, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export function checkProject(root = process.cwd()) {
  const errors = [];
  const workspace = read(root, 'src/workspaces/dashboard/DashboardWorkspace.vue');
  const model = read(root, 'src/workspaces/dashboard/dashboardModel.js');
  const pkg = JSON.parse(read(root, 'package.json') || '{}');
  for (const [relativePath, text] of [
    ['src/workspaces/dashboard/DashboardWorkspace.vue', workspace],
    ['src/workspaces/dashboard/dashboardModel.js', model],
  ]) {
    if (!text) errors.push(`${relativePath}: missing`);
    if (/fetch\s*\(/.test(text)) errors.push(`${relativePath}: must not call fetch directly`);
    if (/['"]\/QuantGod_[^'"]+\.(json|csv)['"]/i.test(text)) {
      errors.push(`${relativePath}: must not reference runtime JSON/CSV paths`);
    }
    if (/(?:hyperliquid|moss|\bcrypto\b|\bbtc\b)/i.test(text)) {
      errors.push(`${relativePath}: retired non-Forex lane must not appear`);
    }
  }
  for (const marker of [
    'loadDashboardWorkspaceCore',
    'EndpointHealthGrid',
    '全局快照根因',
    'buildSnapshotRootCauseBanner',
    'buildFrontendSnapshotRecoveryRows',
    'Operator Overview',
    '/api/operator/overview',
    'workspace=mt5',
    'workspace=evolution',
    '/api/production-evidence-validation/status',
  ]) {
    if (!workspace.includes(marker)) errors.push(`DashboardWorkspace.vue: missing ${marker}`);
  }
  for (const name of [
    'normalizeDashboardSnapshot',
    'buildDashboardMetrics',
    'buildEndpointHealth',
    'buildRuntimeItems',
    'buildDailyItems',
    'buildSnapshotRootCauseBanner',
    'buildFrontendSnapshotRecoveryRows',
    'buildSnapshotImpactSummary',
    'buildOperatorOverviewItems',
    'buildOperatorOverviewBlockerRows',
    'buildOperatorOverviewAxisItems',
    'buildOperatorOverviewSupportItems',
  ]) {
    if (!model.includes(`export function ${name}`)) errors.push(`dashboardModel.js: missing export ${name}`);
  }
  if (pkg.scripts?.['dashboard-workspace'] !== 'node scripts/frontend_dashboard_workspace_guard.mjs') {
    errors.push('package.json: missing dashboard-workspace script');
  }
  return errors;
}

export function main(argv = process.argv.slice(2)) {
  const errors = checkProject(argv[0] ? path.resolve(argv[0]) : process.cwd());
  if (errors.length) {
    console.error('QuantGod frontend dashboard workspace guard failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('QuantGod frontend dashboard workspace guard OK');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
