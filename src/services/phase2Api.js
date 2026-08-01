import { fetchJsonOrFallback, postCommandJson } from './apiClient.js';
import { formatDisplayValue, humanizeLabel } from '../utils/displayText.js';

export const PHASE2_ENDPOINTS = Object.freeze({
  governance: [
    ['/api/governance/advisor', '治理建议'],
    ['/api/governance/version-registry', '策略版本登记'],
    ['/api/governance/promotion-gate', 'Shadow 研究晋级闸门'],
    ['/api/governance/optimizer-v2', '优化器结果'],
  ],
  paramlab: [
    ['/api/paramlab/status', '实验状态'],
    ['/api/paramlab/results', '实验结果'],
    ['/api/paramlab/scheduler', '排队调度'],
    ['/api/paramlab/recovery', '失败恢复'],
    ['/api/paramlab/report-watcher', '报告回灌'],
    ['/api/paramlab/tester-window', '测试器窗口'],
  ],
  trades: [
    ['/api/trades/journal?limit=200', '交易流水'],
    ['/api/trades/close-history?limit=200', '历史平仓'],
    ['/api/trades/outcome-labels?limit=200', '交易结果标签'],
    ['/api/trades/trading-audit?limit=200', '交易审计'],
  ],
  research: [
    ['/api/research/stats', '研究统计'],
    ['/api/research/stats-ledger?limit=200', '研究统计流水'],
    ['/api/research/strategy-evaluation?limit=200', '策略评估'],
    ['/api/research/regime-evaluation?limit=200', '行情环境评估'],
    ['/api/research/manual-alpha?limit=200', '人工 Alpha 记录'],
  ],
  shadow: [
    ['/api/shadow/signals?days=7&limit=200', '模拟信号'],
    ['/api/shadow/candidates?limit=200', '模拟候选'],
    ['/api/shadow/outcomes?limit=200', '模拟结果'],
    ['/api/shadow/candidate-outcomes?limit=200', '候选结果'],
  ],
  dashboard: [
    ['/api/dashboard/state', '总览状态'],
    ['/api/dashboard/backtest-summary', '回测摘要'],
  ],
});

export async function fetchPhase2Json(url, fallback = null, options = {}) {
  return fetchJsonOrFallback(url, fallback, options);
}

export async function postPhase2Json(url, payload = {}, _fallback = null, options = {}) {
  return postCommandJson(url, payload, options);
}

export function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.rows,
    payload?.items,
    payload?.routeDecisions,
    payload?.governanceDecisions,
    payload?.decisions,
    payload?.routes,
    payload?.data?.rows,
    payload?.data?.items,
    payload?.data?.routeDecisions,
    payload?.data?.governanceDecisions,
    payload?.data?.decisions,
    payload?.data?.routes,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  if (payload?.data && typeof payload.data === 'object') return readableRows(payload.data);
  if (payload && typeof payload === 'object') return readableRows(payload);
  return [];
}

const SKIP_SUMMARY_KEYS = new Set([
  'schemaVersion',
  'endpoint',
  'runtimeDir',
  'filePath',
  'sourcePath',
  '_api',
  '_phase2',
  'safety',
  'principles',
  'hardGuards',
  'systemHealth',
  'files',
]);

function readableRows(source) {
  const roots = [source.summary, source.globalState, source].filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item),
  );
  const rows = [];
  for (const root of roots) {
    for (const [key, value] of Object.entries(root)) {
      if (SKIP_SUMMARY_KEYS.has(key) || value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        rows.push({ 项目: humanizeLabel(key), 内容: `${value.length} 项` });
      } else if (value && typeof value === 'object') {
        rows.push({ 项目: humanizeLabel(key), 内容: formatDisplayValue(value, { max: 96 }) });
      } else {
        rows.push({ 项目: humanizeLabel(key), 内容: formatDisplayValue(value, { max: 96 }) });
      }
      if (rows.length >= 12) return rows;
    }
  }
  return rows;
}

export function tableColumns(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))]
    .filter((key) => !key.startsWith('_'))
    .slice(0, 8);
  return keys.map((key) => ({
    title: humanizeLabel(key),
    dataIndex: key,
    key,
    ellipsis: true,
    sorter: (a, b) => String(a?.[key] ?? '').localeCompare(String(b?.[key] ?? '')),
  }));
}

export function endpointSummary(payload) {
  const source = payload?.source || payload?._api || payload?._phase2 || {};
  const method = String(source.method || '').toUpperCase();
  const status = Number(source.status || 0);
  const durationMs = Number(source.durationMs || 0);
  return {
    ok: payload?.ok !== false,
    endpoint: source.endpoint || payload?.endpoint || '--',
    httpStatus: status > 0 ? `${method || 'GET'} ${status}` : method ? `${method} 无响应` : '--',
    fileName: source.fileName || '--',
    mtimeIso: source.mtimeIso || '--',
    fetchedAt: source.fetchedAt || '--',
    durationLabel: Number.isFinite(durationMs) && durationMs > 0 ? `${durationMs} ms` : '--',
    returnedRows: payload?.data?.returnedRows ?? extractRows(payload).length,
    error: endpointErrorMessage(payload),
    failureDetail: endpointFailureDetail(payload),
  };
}

export function endpointErrorMessage(payload) {
  if (!payload || payload.ok !== false) return '';
  const apiError = payload?._api?.error || {};
  return (
    payload.statusZh ||
    payload.error ||
    payload.message ||
    apiError.bodyStatusZh ||
    apiError.bodyError ||
    apiError.bodyMessage ||
    apiError.message ||
    'API 请求失败'
  );
}

export function endpointFailureDetail(payload) {
  if (!payload || payload.ok !== false) return '';
  const source = payload._api || {};
  const parts = [];
  if (source.endpoint) parts.push(`端点 ${source.endpoint}`);
  if (source.method || source.status) {
    parts.push(`${String(source.method || 'GET').toUpperCase()} ${Number(source.status || 0) || '无响应'}`);
  }
  if (source.fetchedAt) parts.push(`读取 ${source.fetchedAt}`);
  if (Number(source.durationMs || 0) > 0) parts.push(`耗时 ${Number(source.durationMs)} ms`);
  return parts.join(' · ');
}

export function loadNotifyConfig() {
  return fetchPhase2Json('/api/notify/config', { ok: false, error: 'notify_config_failed' });
}

export function loadNotifyHistory(limit = 50) {
  return fetchPhase2Json(`/api/notify/history?limit=${Number(limit) || 50}`, { ok: false, items: [] });
}

export function sendNotifyTest(message, dryRun = false) {
  return postPhase2Json('/api/notify/test', { message, dryRun }, { ok: false, error: 'notify_test_failed' });
}

export function sendNotifyDailyDigest(dryRun = false) {
  return postPhase2Json('/api/notify/daily-digest', { dryRun }, { ok: false, error: 'daily_digest_failed' });
}

export function sendNotifyRuntimeScan(dryRun = true) {
  return postPhase2Json('/api/notify/runtime-scan', { dryRun }, { ok: false, error: 'runtime_scan_failed' });
}

export function loadAiMonitorConfig() {
  return fetchPhase2Json('/api/notify/mt5-ai-monitor/config', {
    ok: false,
    error: 'ai_monitor_config_failed',
  });
}

export function runMt5AiMonitor({
  send = false,
  dryRun = true,
  symbols = 'USDJPYc',
  timeframes = 'M15,H1',
  noDeepseek = false,
} = {}) {
  return postPhase2Json(
    '/api/notify/mt5-ai-monitor/run',
    { send, dryRun, symbols, timeframes, noDeepseek },
    { ok: false, error: 'mt5_ai_monitor_failed' },
  );
}
