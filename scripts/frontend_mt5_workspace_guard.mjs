/**
 * QuantGodFrontend MT5 workspace guard.
 *
 * MT5 monitor must stay read-only, structured, and API-backed. This guard
 * prevents regressions into direct runtime file reads, direct fetch calls in the
 * workspace component, or accidental exposure of execution affordances.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function exists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function rel(root, target) {
  return path.relative(root, target).replaceAll(path.sep, '/') || '.';
}

function checkMt5Workspace(root) {
  const errors = [];
  const workspace = path.join(root, 'src', 'workspaces', 'mt5', 'Mt5Workspace.vue');
  const model = path.join(root, 'src', 'workspaces', 'mt5', 'mt5Model.js');
  if (!exists(workspace)) return [`${rel(root, workspace)}: missing MT5 workspace`];
  if (!exists(model)) errors.push(`${rel(root, model)}: missing MT5 model`);

  const text = read(workspace);
  for (const required of [
    './mt5Model.js',
    'loadMt5WorkspaceCore',
    'loadMt5Workspace',
    'normalizeDashboardSnapshot',
    'buildOperatorOverviewAxisItems',
    'EndpointHealthGrid',
    'KeyValueList',
    'LedgerTable',
    '模式与市场',
    'primaryAxisItems',
    'coreMetrics',
    'qg-mt5-progressive',
    '账户登记与快照诊断',
    '当前账号与凭据边界',
    ':limit="3"',
    '第二账号信息',
    'RSI 入场诊断',
    '执行反馈与下一代修复',
    'StatusPill',
    '全局快照恢复',
    '当前账号数据是否可信',
    'snapshotRootCause',
    'snapshotRecoveryRows',
    'Safety Envelope',
    'Raw MT5 evidence',
  ]) {
    if (!text.includes(required)) errors.push(`${rel(root, workspace)}: missing ${required}`);
  }

  if (/fetch\s*\(/.test(text)) errors.push(`${rel(root, workspace)}: must not call fetch directly`);
  if (/['"]\/QuantGod_[^'"]+\.(json|csv)['"]/i.test(text)) {
    errors.push(`${rel(root, workspace)}: must not read runtime JSON/CSV directly`);
  }
  if (/LegacyWorkbench/.test(text)) errors.push(`${rel(root, workspace)}: must not import legacy workbench`);

  const forbiddenAffordances = [
    /\bOrderSend\s*\(/i,
    /\bclosePosition\s*\(/i,
    /\bcancelOrder\s*\(/i,
    /\bplaceOrder\s*\(/i,
    /\bmutatePreset\s*\(/i,
    /\btrade\s*:\s*true/i,
  ];
  for (const pattern of forbiddenAffordances) {
    if (pattern.test(text))
      errors.push(`${rel(root, workspace)}: forbidden MT5 execution affordance ${pattern}`);
  }
  return errors;
}

function checkMt5Model(root) {
  const errors = [];
  const model = path.join(root, 'src', 'workspaces', 'mt5', 'mt5Model.js');
  if (!exists(model)) return errors;
  const text = read(model);
  for (const exportedName of [
    'normalizeMt5Snapshot',
    'buildMt5Metrics',
    'buildMt5CoreMetrics',
    'buildMt5PrimaryAxisItems',
    'buildSafetyItems',
    'buildAccountItems',
    'buildMt5ConnectionItems',
    'buildMt5AccountProfileRows',
    'buildMt5SnapshotRootCauseBanner',
    'buildMt5SnapshotRecoveryRows',
    'buildPositionRows',
    'buildOrderRows',
    'buildSymbolRows',
    'buildRsiEntryDiagnosticRows',
    'buildMt5EvidenceOsLiteItems',
    'buildEndpointHealth',
    'rowsFromPayload',
  ]) {
    if (!text.includes(`export function ${exportedName}`)) {
      errors.push(`${rel(root, model)}: missing export ${exportedName}`);
    }
  }

  for (const requiredSafety of [
    'orderSendAllowed',
    'closeAllowed',
    'cancelAllowed',
    'credentialStorageAllowed',
    'livePresetMutationAllowed',
    'MISSING_EA_SNAPSHOT',
    'freshnessBlocksCurrentState',
    'writer 未运行',
    '旧快照不能证明当前为 0',
    '当前净值、余额、持仓、挂单和 EA 权限不可确认',
  ]) {
    if (!text.includes(requiredSafety))
      errors.push(`${rel(root, model)}: missing safety field ${requiredSafety}`);
  }

  for (const requiredEvidenceOS of [
    'evidenceOS',
    'promotionGate',
    'fieldCompleteness',
    'EA 字段契约',
    '三方一致性',
    'deepParity',
    'evidenceSync',
    'Evidence Sync',
    'Strategy JSON / Python Replay / MQL5 EA',
    'gaSeedHints',
    'Case Memory',
  ]) {
    if (!text.includes(requiredEvidenceOS)) {
      errors.push(
        `${rel(root, model)}: missing MT5 Evidence OS lightweight summary marker ${requiredEvidenceOS}`,
      );
    }
  }

  for (const requiredScope of ['FOCUS_SYMBOL', 'focusSymbolRows', 'isFocusSymbolRow']) {
    if (!text.includes(requiredScope)) {
      errors.push(`${rel(root, model)}: missing USDJPY-only shadow ledger scope ${requiredScope}`);
    }
  }

  if (/['"]\/QuantGod_[^'"]+\.(json|csv)['"]/i.test(text)) {
    errors.push(`${rel(root, model)}: must not reference runtime JSON/CSV paths`);
  }
  return errors;
}

function checkDomainApi(root) {
  const errors = [];
  const api = path.join(root, 'src', 'services', 'domainApi.js');
  if (!exists(api)) return [`${rel(root, api)}: missing domain API`];
  const text = read(api);
  if (!text.includes('/api/usdjpy-strategy-lab/evidence-os/status')) {
    errors.push(`${rel(root, api)}: MT5 workspace must load USDJPY Evidence OS status through API facade`);
  }
  if (!text.includes('loadMt5WorkspaceCore')) {
    errors.push(`${rel(root, api)}: MT5 workspace must expose a core snapshot load for first paint`);
  }
  if (text.includes('/api/mt5/account-profiles') || text.includes('/api/mt5-trading')) {
    errors.push(`${rel(root, api)}: MT5 workspace must not call retired trading or account-profile routes`);
  }
  for (const endpoint of [
    '/api/mt5-readonly/positions',
    '/api/mt5-readonly/orders',
    '/api/mt5-readonly/snapshot',
    '/api/mt5-readonly-secondary/snapshot',
  ]) {
    if (!text.includes(endpoint)) {
      errors.push(`${rel(root, api)}: MT5 workspace must load unscoped live account ${endpoint}`);
    }
  }
  if (/\/api\/mt5-readonly(?:-secondary)?\/(?:positions|orders|snapshot)\$\{symbolQuery\}/.test(text)) {
    errors.push(
      `${rel(root, api)}: MT5 live account positions, orders, and snapshots must not be USDJPY-scoped`,
    );
  }
  if (!text.includes('/api/mt5-readonly-secondary/account')) {
    errors.push(`${rel(root, api)}: MT5 workspace must load secondary MT5 account status through API facade`);
  }
  if (!text.includes("scope: 'secondary'")) {
    errors.push(
      `${rel(root, api)}: MT5 workspace must load secondary account trade history through scope=secondary`,
    );
  }
  if (!text.includes('/api/usdjpy-strategy-lab/evidence-os/parity')) {
    errors.push(
      `${rel(root, api)}: MT5 workspace must load USDJPY Evidence OS deep parity through API facade`,
    );
  }
  if (!text.includes('/api/usdjpy-strategy-lab/evidence-os/execution-feedback')) {
    errors.push(
      `${rel(root, api)}: MT5 workspace must load live execution feedback field completeness through API facade`,
    );
  }
  for (const endpoint of [
    '/api/shadow/signals',
    '/api/shadow/outcomes',
    '/api/shadow/candidates',
    '/api/shadow/candidate-outcomes',
  ]) {
    const index = text.indexOf(endpoint);
    if (index < 0) {
      errors.push(`${rel(root, api)}: missing ${endpoint}`);
      continue;
    }
    const snippet = text.slice(index, index + 160);
    if (!snippet.includes('symbol: focusSymbol')) {
      errors.push(`${rel(root, api)}: ${endpoint} must request symbol-scoped USDJPY shadow rows`);
    }
  }
  for (const endpoint of ['/api/trades/close-history', '/api/trades/journal']) {
    const exactUnlimited = new RegExp(`fetchRows\\(\\s*['"]${endpoint.replaceAll('/', '\\/')}['"]\\s*\\)`);
    if (exactUnlimited.test(text)) {
      errors.push(`${rel(root, api)}: ${endpoint} must be requested with a limit for small-memory startup`);
    }
  }
  return errors;
}

function checkPackageScript(root) {
  const errors = [];
  const packagePath = path.join(root, 'package.json');
  if (!exists(packagePath)) return [`${rel(root, packagePath)}: missing package.json`];
  const packageJson = JSON.parse(read(packagePath));
  if (packageJson.scripts?.['mt5-workspace'] !== 'node scripts/frontend_mt5_workspace_guard.mjs') {
    errors.push('package.json: missing mt5-workspace script');
  }
  return errors;
}

export function checkProject(root = process.cwd()) {
  const resolved = path.resolve(root);
  return [
    ...checkMt5Workspace(resolved),
    ...checkMt5Model(resolved),
    ...checkDomainApi(resolved),
    ...checkPackageScript(resolved),
  ];
}

export function main(argv = process.argv.slice(2)) {
  const root = argv[0] ? path.resolve(argv[0]) : process.cwd();
  const errors = checkProject(root);
  if (errors.length) {
    console.error('QuantGod frontend MT5 workspace guard failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('QuantGod frontend MT5 workspace guard OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
