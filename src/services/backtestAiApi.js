import { fetchCommandJson, fetchJsonOrFallback, postCommandJson } from './apiClient.js';
import {
  buildTelegramDigest,
  formatTelegramTimestamp,
  normalizeTelegramDelivery,
  normalizeTelegramSafety,
} from '../utils/telegramStatus.js';

export const DEFAULT_BACKTEST_SYMBOLS = ['USDJPYc'];
export const DEFAULT_BACKTEST_TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];

const SAFETY = Object.freeze({
  readOnlyDataPlane: true,
  pythonBacktestOnly: true,
  advisoryOnly: true,
  notificationPushOnly: true,
  orderSendAllowed: false,
  closeAllowed: false,
  cancelAllowed: false,
  credentialStorageAllowed: false,
  livePresetMutationAllowed: false,
  canOverrideKillSwitch: false,
  telegramCommandExecutionAllowed: false,
});

function fetchBacktestAiJson(path, fallback = null) {
  return fetchJsonOrFallback(path, fallback);
}

function postBacktestAiJson(path, payload = {}) {
  return postCommandJson(path, payload);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {};
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanSymbols(input) {
  const source = Array.isArray(input) ? input : String(input || '').split(',');
  const symbols = source.map((item) => String(item || '').trim()).filter(Boolean);
  return symbols.length ? [...new Set(symbols)] : [...DEFAULT_BACKTEST_SYMBOLS];
}

export function summarizeBacktest(backtest = {}) {
  const summary = firstObject(backtest.summary, backtest.data?.summary);
  const rows = toArray(backtest);
  return {
    ok: backtest?.ok !== false,
    generatedAt: backtest.generatedAtIso || backtest.generatedAt || '',
    taskCount: finiteNumber(summary.taskCount ?? rows.length),
    readyCount: finiteNumber(summary.readyCount),
    cautionCount: finiteNumber(summary.cautionCount),
    topCandidateId: summary.topCandidateId || rows[0]?.candidateId || '暂无候选',
    topRouteKey: summary.topRouteKey || rows[0]?.routeKey || rows[0]?.strategy || '暂无路线',
    topRankScore: summary.topRankScore ?? rows[0]?.rankScore ?? rows[0]?.score ?? null,
    safety: firstObject(backtest.safety, backtest._api),
    rows,
  };
}

export function summarizeAiReport(aiLatest = {}) {
  const items = toArray(aiLatest);
  const first = items[0] || {};
  const decision = firstObject(first.decision, aiLatest.decision);
  const deepseek = firstObject(
    first.deepseek?.advice,
    first.deepseek_advice?.advice,
    aiLatest.deepseek?.advice,
  );
  return {
    ok: aiLatest?.ok !== false,
    generatedAt: aiLatest.generatedAt || aiLatest.generatedAtIso || first.generatedAt || '',
    itemCount: items.length,
    headline: deepseek.headline || decision.reasoning || '等待 AI 生成中文建议',
    verdict: deepseek.verdict || decision.action || '等待分析',
    confidence: deepseek.confidencePct || decision.confidence || '',
    items,
  };
}

export function summarizeNotifyConfig(config = {}) {
  const safety = normalizeTelegramSafety(config, { requireConfigured: true });
  return {
    configured: safety.configured === true,
    pushAllowed: safety.pushAllowed === true,
    ready: safety.ready,
    status: safety.code,
    statusLabel: safety.label,
    statusDetail: safety.reason,
    statusTone: safety.tone,
    tokenConfigured: Boolean(config.tokenConfigured),
    chatConfigured: Boolean(config.chatConfigured),
    chatIdRedacted: config.chatIdRedacted || '未配置频道',
    enabled: config.enabled !== false,
  };
}

export function backtestRows(backtest = {}) {
  return summarizeBacktest(backtest)
    .rows.slice(0, 12)
    .map((row) => ({
      路线: row.routeKey || row.strategy || '—',
      品种: row.symbol || row.brokerSymbol || '—',
      周期: row.timeframe || '—',
      PF: row.profitFactor ?? row.pf ?? row.score ?? '—',
      胜率: row.winRatePct != null ? `${Number(row.winRatePct).toFixed(1)}%` : '—',
      净点数: row.netPips ?? row.avgPips ?? '—',
      状态: humanBacktestState(row),
      建议: humanBacktestDecision(row),
    }));
}

export function aiRows(aiLatest = {}) {
  return toArray(aiLatest)
    .slice(0, 6)
    .map((item) => {
      const decision = firstObject(item.decision);
      const advice = firstObject(item.deepseek?.advice, item.deepseek_advice?.advice);
      return {
        品种: item.symbol || '—',
        中文结论: advice.verdict || decision.action || '等待分析',
        置信度: advice.confidencePct ? `${advice.confidencePct}%` : (decision.confidence ?? '—'),
        风险: advice.newsRisk || item.risk?.risk_level || '—',
        说明: advice.headline || decision.reasoning || '—',
      };
    });
}

export function notifyRows(notifyHistory = {}) {
  return toArray(notifyHistory)
    .slice(-8)
    .reverse()
    .map((item) => {
      const delivery = normalizeTelegramDelivery(item);
      const timestamp = item.timestamp || item.createdAt || item.time;
      return {
        时间: timestamp ? formatTelegramTimestamp(timestamp) : '—',
        类型: item.eventType || item.event_type || '通知',
        状态: delivery.label,
        说明: delivery.detail || item.messagePreview || 'Telegram 投递记录',
      };
    });
}

function humanBacktestState(row = {}) {
  const state = String(row.sampleState || row.status || row.backendDecision || '').toUpperCase();
  if (state.includes('READY')) return '可进入人工复核';
  if (state.includes('CAUTION')) return '证据不足，继续研究';
  if (state.includes('SIMULATED')) return '模拟完成';
  if (state.includes('KEEP_RESEARCH')) return '保持研究';
  return state || '等待结果';
}

function humanBacktestDecision(row = {}) {
  const blockers = Array.isArray(row.blockers) ? row.blockers : [];
  if (row.backendDecision === 'KEEP_RESEARCH') return '保持只读研究，不推实盘';
  if (blockers.some((item) => String(item).includes('pf'))) return 'PF 未达标，继续优化';
  if (blockers.some((item) => String(item).includes('drawdown'))) return '回撤偏高，先控风险';
  if (row.ready || row.sampleState === 'READY') return '建议人工复核';
  return blockers.length ? '仍有阻断项' : '等待 AI 复核';
}

export function buildBacktestTelegramMessage({ backtest, ai, symbols }) {
  const backtestSummary = summarizeBacktest(backtest);
  const aiSummary = summarizeAiReport(ai);
  const rawRows = backtestSummary.rows.slice(0, 5);
  const firstBlockedRow = rawRows.find((row) => Array.isArray(row.blockers) && row.blockers.length);
  const hasReviewCandidate = backtestSummary.readyCount > 0;
  return buildTelegramDigest({
    icon: hasReviewCandidate ? '🟡' : '🔵',
    topic: 'AI 回测状态',
    conclusion: `${aiSummary.verdict}；${
      hasReviewCandidate
        ? `${backtestSummary.readyCount} 个候选仅进入人工 Shadow 复核。`
        : '暂无可复核候选，继续 Shadow 观察。'
    }`,
    keyMetrics: [
      cleanSymbols(symbols).join('、'),
      `任务 ${backtestSummary.taskCount}`,
      `谨慎 ${backtestSummary.cautionCount}`,
      `最佳 ${backtestSummary.topRouteKey}`,
    ],
    reasons: [
      aiSummary.headline,
      firstBlockedRow ? `主要阻断：${humanBacktestDecision(firstBlockedRow)}` : '',
    ],
    nextAction: hasReviewCandidate
      ? '人工复核最佳候选与阻断证据；不自动升级或执行。'
      : '继续采集回测样本并复核主要阻断。',
    timestamp: backtestSummary.generatedAt || aiSummary.generatedAt,
  });
}

export async function loadBacktestAiState() {
  const [backtest, aiLatest, notifyConfig, notifyHistory] = await Promise.all([
    fetchBacktestAiJson('/api/mt5-backtest-loop'),
    fetchBacktestAiJson('/api/ai-analysis/deepseek-telegram/latest', { ok: false, items: [] }),
    fetchBacktestAiJson('/api/notify/config', { ok: false }),
    fetchBacktestAiJson('/api/notify/history?limit=20', { ok: false, items: [] }),
  ]);
  return {
    backtest,
    aiLatest,
    notifyConfig,
    notifyHistory,
    safety: SAFETY,
  };
}

export async function runBacktestAiCycle({
  symbols = DEFAULT_BACKTEST_SYMBOLS,
  timeframes = DEFAULT_BACKTEST_TIMEFRAMES,
  days = 180,
  maxTasks = 20,
  sendTelegram = false,
  noDeepseek = false,
} = {}) {
  const normalizedSymbols = cleanSymbols(symbols);
  const params = new URLSearchParams({
    days: String(Math.max(7, Math.min(365, Number(days) || 180))),
    maxTasks: String(Math.max(1, Math.min(50, Number(maxTasks) || 20))),
  });
  const backtest = await fetchCommandJson(`/api/mt5-backtest-loop/run?${params.toString()}`);
  const ai = await postBacktestAiJson('/api/ai-analysis/deepseek-telegram/run', {
    symbols: normalizedSymbols,
    timeframes,
    send: false,
    dryRun: true,
    force: false,
    noDeepseek,
    minIntervalSeconds: 900,
  });
  let notify = null;
  if (sendTelegram) {
    notify = await postBacktestAiJson('/api/notify/test', {
      eventType: 'BACKTEST_AI',
      message: buildBacktestTelegramMessage({ backtest, ai, symbols: normalizedSymbols }),
      send: true,
      dryRun: false,
    });
  }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    symbols: normalizedSymbols,
    sendTelegramRequested: Boolean(sendTelegram),
    backtest,
    ai,
    notify,
    safety: SAFETY,
  };
}
