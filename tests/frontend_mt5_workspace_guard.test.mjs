import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProject } from '../scripts/frontend_mt5_workspace_guard.mjs';

function makeProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-mt5-guard-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return root;
}

const model = [
  'export function normalizeMt5Snapshot() {}',
  'export function buildMt5Metrics() {}',
  'export function buildMt5CoreMetrics() {}',
  'export function buildMt5PrimaryAxisItems() {}',
  'export function buildSafetyItems() {}',
  'export function buildAccountItems() {}',
  'export function buildMt5ConnectionItems() {}',
  'export function buildMt5AccountProfileRows() {}',
  'export function buildMt5SnapshotRootCauseBanner() {}',
  'export function buildMt5SnapshotRecoveryRows() {}',
  'export function buildPositionRows() {}',
  'export function buildOrderRows() {}',
  'export function buildSymbolRows() {}',
  'export function buildRsiEntryDiagnosticRows() {}',
  'export function buildMt5EvidenceOsLiteItems() {}',
  'export function buildEndpointHealth() {}',
  'export function rowsFromPayload() {}',
  'const fields = ["orderSendAllowed", "closeAllowed", "cancelAllowed", "credentialStorageAllowed", "livePresetMutationAllowed"];',
  'const missingSnapshot = "MISSING_EA_SNAPSHOT";',
  'function freshnessBlocksCurrentState() { return true; }',
  'const staleSnapshotCopy = "writer 未运行 / 旧快照不能证明当前为 0";',
  'const recoveryScope = "当前净值、余额、持仓、挂单和 EA 权限不可确认";',
  "const FOCUS_SYMBOL = 'USDJPYc';",
  'function isFocusSymbolRow() { return true; }',
  'function focusSymbolRows() { return []; }',
  'const evidenceOS = { parity: { evidenceSync: { strategyJsonBacktest: "WRITTEN", pythonReplay: "WRITTEN" }, deepParity: { status: "PASS", reasonZh: "Strategy JSON / Python Replay / MQL5 EA" } }, executionFeedback: { promotionGate: {}, fieldCompleteness: {} }, caseMemory: { gaSeedHints: [], label: "Case Memory" } };',
  "const fieldCompleteness = evidenceOS.executionFeedback.fieldCompleteness; const label = 'EA 字段契约';",
  "const parityLabel = '三方一致性'; const deepParity = evidenceOS.parity.deepParity; const evidenceSync = evidenceOS.parity.evidenceSync; const syncLabel = 'Evidence Sync';",
].join('\n');

const workspace = [
  '<template><EndpointHealthGrid /><KeyValueList :items="primaryAxisItems" /><MetricGrid :items="coreMetrics" /><details class="qg-mt5-progressive">账户登记与快照诊断</details><section>当前账号与凭据边界</section><LedgerTable title="第二账号信息" /><LedgerTable title="RSI 影子条件诊断" :limit="3" /><LedgerTable title="当前账号数据是否可信" :rows="snapshotRecoveryRows" /><StatusPill />模式与市场 全局快照恢复 {{ snapshotRootCause }} 影子结果反馈与下一代修复 Safety Envelope Raw MT5 evidence</template>',
  '<script setup>',
  "import { loadMt5Workspace, loadMt5WorkspaceCore } from '../../services/domainApi.js';",
  "import { normalizeMt5Snapshot } from './mt5Model.js';",
  "import { normalizeDashboardSnapshot, buildOperatorOverviewAxisItems } from '../dashboard/dashboardModel.js';",
  '</script>',
].join('\n');

const validFiles = {
  'package.json': JSON.stringify({
    scripts: { 'mt5-workspace': 'node scripts/frontend_mt5_workspace_guard.mjs' },
  }),
  'src/workspaces/mt5/mt5Model.js': model,
  'src/workspaces/mt5/Mt5Workspace.vue': workspace,
  'src/services/domainApi.js': `
export async function loadMt5WorkspaceCore() {
  fetchJson('/api/operator/overview');
  fetchJson('/api/mt5-readonly/snapshot');
  fetchJson('/api/mt5-readonly-secondary/snapshot');
}
export async function loadMt5Workspace() {
  const focusSymbol = 'USDJPYc';
  fetchJson('/api/mt5-readonly-secondary/account');
  fetchJson(\`/api/shadow/signals\${params({ symbol: focusSymbol, limit: 500, days: 30 })}\`);
  fetchJson(\`/api/shadow/outcomes\${params({ symbol: focusSymbol, limit: 500, days: 30 })}\`);
  fetchJson(\`/api/shadow/candidates\${params({ symbol: focusSymbol, limit: 500, days: 30 })}\`);
  fetchJson(\`/api/shadow/candidate-outcomes\${params({ symbol: focusSymbol, limit: 500, days: 30 })}\`);
  fetchJson('/api/mt5-readonly/positions');
  fetchJson('/api/mt5-readonly/orders');
  fetchJson('/api/mt5-readonly/snapshot');
  fetchJson('/api/mt5-readonly-secondary/snapshot');
  fetchRows(\`/api/trades/journal\${params({ limit: 200, scope: 'secondary' })}\`);
  fetchJson('/api/usdjpy-strategy-lab/evidence-os/status');
  fetchJson('/api/usdjpy-strategy-lab/evidence-os/parity');
  fetchJson('/api/usdjpy-strategy-lab/evidence-os/execution-feedback');
}`,
};

test('accepts structured MT5 workspace', () => {
  const root = makeProject(validFiles);
  assert.deepEqual(checkProject(root), []);
});

test('keeps MT5 snapshot root cause in a core first-paint load', () => {
  const service = fs.readFileSync(new URL('../src/services/domainApi.js', import.meta.url), 'utf8');
  const coreStart = service.indexOf('export async function loadMt5WorkspaceCore(options = {})');
  const fullStart = service.indexOf('export async function loadMt5Workspace(options = {})');
  const coreLoadBody = service.slice(coreStart, fullStart);
  assert.match(coreLoadBody, /\/api\/operator\/overview/);
  assert.match(coreLoadBody, /\/api\/mt5-readonly\/snapshot/);
  assert.match(coreLoadBody, /\/api\/mt5-readonly-secondary\/snapshot/);
  assert.match(coreLoadBody, /\/api\/latest/);
  assert.doesNotMatch(coreLoadBody, /\/api\/shadow\/signals/);
  assert.doesNotMatch(coreLoadBody, /\/api\/usdjpy-strategy-lab\/evidence-os\/execution-feedback/);
});

test('rejects direct fetch in MT5 workspace', () => {
  const root = makeProject({
    ...validFiles,
    'src/workspaces/mt5/Mt5Workspace.vue': `${workspace}\nfetch('/api/mt5-readonly/status')`,
  });
  assert.match(checkProject(root).join('\n'), /must not call fetch directly/);
});

test('rejects USDJPY-scoped live account positions and snapshots', () => {
  const root = makeProject({
    ...validFiles,
    'src/services/domainApi.js': validFiles['src/services/domainApi.js'].replace(
      "fetchJson('/api/mt5-readonly/positions');",
      'fetchJson(`/api/mt5-readonly/positions${symbolQuery}`);',
    ),
  });
  assert.match(
    checkProject(root).join('\n'),
    /live account positions, orders, and snapshots must not be USDJPY-scoped/,
  );
});

test('rejects direct runtime file reads', () => {
  const root = makeProject({
    ...validFiles,
    'src/workspaces/mt5/Mt5Workspace.vue': `${workspace}\nconst x = '/QuantGod_Dashboard.json';`,
  });
  assert.match(checkProject(root).join('\n'), /runtime JSON\/CSV/);
});

test('rejects missing MT5 safety fields', () => {
  const root = makeProject({
    ...validFiles,
    'src/workspaces/mt5/mt5Model.js': 'export function normalizeMt5Snapshot() {}',
  });
  assert.match(checkProject(root).join('\n'), /missing export buildMt5Metrics/);
});

test('rejects execution affordances in MT5 workspace', () => {
  const root = makeProject({
    ...validFiles,
    'src/workspaces/mt5/Mt5Workspace.vue': `${workspace}\nfunction placeOrder() { return true; }`,
  });
  assert.match(checkProject(root).join('\n'), /forbidden MT5 execution affordance/);
});
