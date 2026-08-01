import { fetchCommandJson, fetchJsonOrFallback, postCommandJson } from './apiClient.js';

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
  return {
    configured: Boolean(config.telegramConfigured && config.telegramPushAllowed),
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

function compactText(value, fallback = '—', max = 72) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function rowPf(row = {}) {
  return row.profitFactor ?? row.pf ?? row.forwardPf ?? row.liveForwardPf ?? row.score ?? null;
}

function rowScore(row = {}) {
  return row.rankScore ?? row.score ?? row.aiScore ?? row.compositeScore ?? null;
}

function rowTrades(row = {}) {
  return row.trades ?? row.closedTrades ?? row.sampleTrades ?? row.tradeCount ?? null;
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
    .map((item) => ({
      时间: item.timestamp || item.createdAt || item.time || '—',
      类型: item.eventType || item.event_type || '通知',
      状态: item.sent ? '已发送' : item.error ? '发送异常' : '等待确认',
      说明: item.error || item.messagePreview || item.message || 'Telegram 推送记录',
    }));
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

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function buildBacktestTelegramMessage({ backtest, ai, symbols }) {
  const backtestSummary = summarizeBacktest(backtest);
  const aiSummary = summarizeAiReport(ai);
  const rawRows = backtestSummary.rows.slice(0, 5);
  const topRows = backtestRows(backtest).slice(0, 5);
  const cautiousRows = rawRows
    .filter((row) => humanBacktestState(row).includes('不足') || humanBacktestState(row).includes('研究'))
    .slice(0, 3);
  const readyRows = rawRows.filter((row) => humanBacktestState(row).includes('复核')).slice(0, 3);
  const lines = [
    '📊 QuantGod AI 回测闭环完成',
    '',
    `观察品种：${cleanSymbols(symbols).join('、')}`,
    `回测任务：${backtestSummary.taskCount} 个，需谨慎 ${backtestSummary.cautionCount} 个，可复核 ${backtestSummary.readyCount} 个`,
    `最佳路线：${backtestSummary.topRouteKey}`,
    `最佳候选：${compactText(backtestSummary.topCandidateId, '暂无候选', 120)}`,
    `候选评分：${backtestSummary.topRankScore == null ? '—' : formatNumber(backtestSummary.topRankScore, 2)}`,
    '',
    `AI结论：${aiSummary.verdict}`,
    `AI摘要：${compactText(aiSummary.headline, '等待 AI 复核', 180)}`,
    '',
    '候选明细：',
    ...topRows.map((row, index) => {
      const raw = rawRows[index] || {};
      const pf = rowPf(raw);
      const score = rowScore(raw);
      const trades = rowTrades(raw);
      return `${index + 1}. ${compactText(row.路线, '未知路线', 36)}｜${row.品种} ${row.周期}｜PF ${pf == null ? row.PF : formatNumber(pf, 2)}｜胜率 ${row.胜率}｜样本 ${trades ?? '—'}｜评分 ${score == null ? '—' : formatNumber(score, 2)}｜${row.建议}`;
    }),
    readyRows.length ? '' : null,
    readyRows.length ? '可人工复核：' : null,
    ...readyRows.map(
      (row, index) =>
        `${index + 1}. ${compactText(row.routeKey || row.strategy || '未知路线', '未知路线', 42)} / ${row.symbol || '—'} / ${humanBacktestDecision(row)}`,
    ),
    cautiousRows.length ? '' : null,
    cautiousRows.length ? '主要阻断：' : null,
    ...cautiousRows.map((row, index) => {
      const blockers = Array.isArray(row.blockers) ? row.blockers.slice(0, 2).join('、') : '';
      return `${index + 1}. ${compactText(row.routeKey || row.strategy || '未知路线', '未知路线', 42)}：${compactText(blockers || humanBacktestDecision(row), '继续研究', 120)}`;
    }),
    '',
    '安全边界：只读回测、AI建议、Telegram只推送；不下单、不平仓、不撤单、不改实盘配置。',
  ];
  return lines
    .filter((line) => line !== null)
    .join('\n')
    .slice(0, 2400);
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
  sendTelegram = true,
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
    send: sendTelegram,
    force: true,
    noDeepseek,
    minIntervalSeconds: 0,
  });
  let notify = null;
  if (sendTelegram) {
    notify = await postBacktestAiJson('/api/notify/test', {
      eventType: 'BACKTEST_AI',
      message: buildBacktestTelegramMessage({ backtest, ai, symbols: normalizedSymbols }),
      dryRun: false,
    });
  }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    symbols: normalizedSymbols,
    backtest,
    ai,
    notify,
    safety: SAFETY,
  };
}
