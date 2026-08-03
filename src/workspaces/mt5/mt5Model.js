import { formatCurrencyDisplay, formatDisplayValue, humanizeStatus } from '../../utils/displayText.js';
import { normalizeMt5ReadonlyFreshness } from '../../utils/mt5ReadonlyFreshness.js';

const FOCUS_SYMBOL = 'USDJPYc';
const NON_FOCUS_SYMBOL_RE = /\b(EURUSD|EURUSDc|XAUUSD|XAUUSDc)\b/i;
const SHADOW_SIGNAL_FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function pick(source, paths, fallback = null) {
  for (const path of paths) {
    const value = String(path)
      .split('.')
      .reduce((cursor, part) => (cursor == null ? undefined : cursor[part]), source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function unwrap(payload) {
  if (!isObject(payload)) return payload;
  if (isObject(payload.data) && Object.keys(payload.data).length) return payload.data;
  if (isObject(payload.result) && Object.keys(payload.result).length) return payload.result;
  return payload;
}

export function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.positions?.items)) return payload.positions.items;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.orders?.items)) return payload.orders.items;
  if (Array.isArray(payload?.symbols)) return payload.symbols;
  if (Array.isArray(payload?.symbols?.items)) return payload.symbols.items;
  if (Array.isArray(payload?.data?.positions)) return payload.data.positions;
  if (Array.isArray(payload?.data?.positions?.items)) return payload.data.positions.items;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.data?.orders?.items)) return payload.data.orders.items;
  if (Array.isArray(payload?.data?.symbols)) return payload.data.symbols;
  if (Array.isArray(payload?.data?.symbols?.items)) return payload.data.symbols.items;
  return [];
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== '';
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function freshnessLine(freshness = {}) {
  if (!present(freshness)) return '';
  const ageSeconds = Number(freshness.ageSeconds);
  const ageText = Number.isFinite(ageSeconds) ? `${Math.round(ageSeconds)}s` : '未知时长';
  if (freshness.statusZh) return freshness.statusZh;
  if (freshness.nextActionZh) return freshness.nextActionZh;
  if (freshness.stale === true) return `MT5 dashboard 已过期 ${ageText}`;
  if (freshness.fresh === true) return 'MT5 dashboard 新鲜';
  return 'MT5 dashboard 新鲜度待确认';
}

function formatAgeSeconds(value) {
  const ageSeconds = Number(value);
  if (!Number.isFinite(ageSeconds)) return '待确认';
  if (ageSeconds < 60) return `${Math.round(ageSeconds)} 秒`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)} 分钟`;
  if (ageSeconds < 86400) return `${(ageSeconds / 3600).toFixed(1)} 小时`;
  return `${(ageSeconds / 86400).toFixed(1)} 天`;
}

function freshnessAgeLine(freshness = {}) {
  if (!present(freshness)) return '等待 freshness 证据';
  return `${formatAgeSeconds(freshness.ageSeconds)} / 阈值 ${formatAgeSeconds(freshness.maxAgeSeconds)}`;
}

function mt5HostProcess(payload = {}) {
  const source = unwrap(payload) || {};
  const terminal = isObject(source.terminal) ? source.terminal : {};
  const process = isObject(source.hostProcess) ? source.hostProcess : {};
  return {
    status: process.status || terminal.hostProcessStatus || '',
    terminalProcessDetected:
      process.terminalProcessDetected ??
      terminal.hostProcessDetected ??
      terminal.terminalProcessDetected ??
      null,
    matchingProcessCount: numberValue(process.matchingProcessCount),
  };
}

function mt5HostProcessMissing(process = {}) {
  return process.terminalProcessDetected === false || String(process.status).toUpperCase() === 'MISSING';
}

function mt5HostProcessLine(process = {}) {
  if (process.terminalProcessDetected === true) {
    const count = process.matchingProcessCount === null ? '' : ` ${process.matchingProcessCount} 个`;
    return `检测到 terminal64/wine 进程${count}`;
  }
  if (mt5HostProcessMissing(process)) return '未检测到 terminal64/wine 进程';
  if (process.status) return humanizeStatus(process.status);
  return '进程状态待确认';
}

function freshnessFromReadonlyPayload(payload = {}, options = {}) {
  return normalizeMt5ReadonlyFreshness(payload, {
    scopeLabel: options.scopeLabel || 'MT5',
    refreshEndpoint: options.refreshEndpoint || '/api/mt5-readonly/snapshot',
  });
}

function freshnessStatus(freshness = {}) {
  return String(freshness.status || '').toUpperCase();
}

function freshnessMissing(freshness = {}) {
  const blockers = Array.isArray(freshness.blockers) ? freshness.blockers : [];
  return (
    freshness.missing === true ||
    freshnessStatus(freshness) === 'MISSING_EA_SNAPSHOT' ||
    blockers.includes('missing_ea_dashboard_snapshot')
  );
}

function freshnessUnavailable(freshness = {}) {
  const status = freshnessStatus(freshness);
  return (
    freshness.unavailable === true ||
    status === 'MT5_READONLY_BRIDGE_UNAVAILABLE' ||
    status === 'MT5_READONLY_BRIDGE_UNCONFIGURED'
  );
}

function freshnessStale(freshness = {}) {
  const status = freshnessStatus(freshness);
  return (
    freshness.stale === true ||
    status === 'STALE_EA_SNAPSHOT' ||
    status === 'STALE_DASHBOARD_SNAPSHOT' ||
    freshnessUnavailable(freshness) ||
    freshnessMissing(freshness)
  );
}

function freshnessUnconfirmed(freshness = {}) {
  return present(freshness) && !freshnessStale(freshness) && freshness.fresh !== true;
}

function freshnessBlocksCurrentState(freshness = {}) {
  return freshnessStale(freshness) || freshnessUnconfirmed(freshness);
}

function freshnessStatusLabel(freshness = {}) {
  if (freshnessMissing(freshness)) return '快照缺失';
  if (freshnessUnavailable(freshness)) return '只读桥不可用';
  if (freshnessStale(freshness)) return '快照过期';
  if (freshnessUnconfirmed(freshness)) return '快照待确认';
  if (freshness.fresh === true) return '新鲜';
  return '待同步';
}

function freshnessRecoveryHint(freshness = {}, fallback = '') {
  const action =
    freshness.nextActionZh ||
    freshness.nextAction ||
    freshnessLine(freshness) ||
    fallback ||
    '等待 MT5 快照刷新';
  const steps = toArray(freshness.recoveryStepsZh || freshness.recoverySteps)
    .map((step) => String(step).trim())
    .filter(Boolean);
  return [action, steps.length ? steps.join(' / ') : ''].filter(Boolean).join('；');
}

function format(value) {
  return formatDisplayValue(value);
}

function asSummary(payload) {
  const value = unwrap(payload);
  if (isObject(value?.summary)) return value.summary;
  if (isObject(value)) return value;
  return {};
}

function numberValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatAccountAmount(value, currency = 'USC') {
  const numeric = numberValue(value);
  if (numeric === null) return format(value);
  const code = String(currency || '').toUpperCase();
  if (code === 'USC' || code === '—' || code === '-') return numeric.toFixed(2);
  return formatCurrencyDisplay(numeric, code || 'USD');
}

function formatAccountWithCurrency(value, currency = 'USC') {
  const amount = formatAccountAmount(value, currency);
  const code = String(currency || '').trim();
  if (amount === '—') return amount;
  if (!code || code === '—' || code === '-') return amount;
  return `${amount} ${code}`.trim();
}

function staleAwareAccountItem(label, value, currency, snapshotState = {}) {
  const formatted = formatAccountWithCurrency(value, currency);
  if (!snapshotState.blocked && !snapshotState.stale && !snapshotState.unconfirmed) {
    return { label, value: formatted };
  }
  const historicalHint = formatted === '—' ? '' : `历史${label}: ${formatted}，仅作参考`;
  return {
    label,
    value: snapshotState.blocked ? '不可确认' : snapshotState.stale ? '快照过期' : '待确认',
    status: snapshotState.blocked ? 'blocked' : 'warn',
    hint: [snapshotState.hint, historicalHint].filter(Boolean).join('；'),
  };
}

function truthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'yes';
}

function boolLike(value, trueStatus = 'ok', falseStatus = 'warn') {
  if (truthyFlag(value)) return trueStatus;
  if (value === false || value === 'false' || value === 0 || value === '0' || value === 'no')
    return falseStatus;
  return 'unknown';
}

function passText(value) {
  if (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes') return '通过';
  if (value === false || value === 'false' || value === 0 || value === '0' || value === 'no') return '未通过';
  return '待同步';
}

function onOffText(value) {
  if (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes') return '是';
  if (value === false || value === 'false' || value === 0 || value === '0' || value === 'no') return '否';
  return '待同步';
}

function formatDiagnosticNumber(value, digits = 2) {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return numeric.toFixed(digits);
}

function feedbackFieldPresent(row, field) {
  const presence = row?.fieldPresence;
  if (isObject(presence) && presence[field] === false) return false;
  return true;
}

function feedbackPlaceholderZero(row, field, numeric) {
  if (numeric !== 0) return false;
  if (['expectedPrice', 'fillPrice'].includes(field)) return true;
  const sourceTier = String(row?.sourceTier || '').toLowerCase();
  const eventType = String(row?.eventType || '').toUpperCase();
  if (
    sourceTier === 'backfilled_history' &&
    ['expectedPrice', 'slippagePips', 'latencyMs', 'spreadAtEntry'].includes(field)
  ) {
    return true;
  }
  if (
    ['profitR', 'mfeR', 'maeR'].includes(field) &&
    !eventType.includes('CLOSE') &&
    !eventType.includes('OUTCOME') &&
    !row?.exitReason
  ) {
    return true;
  }
  return false;
}

function formatFeedbackNumber(row, field, digits = 2, suffix = '') {
  if (!feedbackFieldPresent(row, field)) return '—';
  const numeric = numberValue(row?.[field]);
  if (numeric === null) return '—';
  if (feedbackPlaceholderZero(row, field, numeric)) return '—';
  const value = numeric.toFixed(digits);
  return suffix ? `${value} ${suffix}` : value;
}

function formatLot(value) {
  const numeric = numberValue(value);
  if (numeric === null) return '—';
  return numeric.toFixed(2).replace(/\.?0+$/, '');
}

function directionZh(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('LONG') || text.includes('BUY')) return '买入观察';
  if (text.includes('SHORT') || text.includes('SELL')) return '卖出观察';
  return humanizeStatus(value || '—');
}

function entryModeZh(value) {
  const text = String(value || '').toUpperCase();
  if (text === 'STANDARD_ENTRY') return '标准入场';
  if (text === 'OPPORTUNITY_ENTRY') return '机会入场';
  if (text === 'BLOCKED') return '阻断';
  return humanizeStatus(value || '—');
}

function usdJpyOnlyUniverseLabel() {
  return FOCUS_SYMBOL;
}

function normalizeSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function rowSymbol(row) {
  return pick(
    row,
    [
      'Symbol',
      'symbol',
      'BrokerSymbol',
      'brokerSymbol',
      'CanonicalSymbol',
      'canonicalSymbol',
      'UnderlyingSymbol',
      'underlyingSymbol',
      'MarketSymbol',
      'marketSymbol',
      'Pair',
      'pair',
    ],
    '',
  );
}

function isFocusSymbolRow(row) {
  return normalizeSymbol(rowSymbol(row)).startsWith('USDJPY');
}

function focusSymbolRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isFocusSymbolRow);
}

function rowMentionsNonFocusSymbol(row) {
  const text = [
    row?.candidateId,
    row?.candidateVersionId,
    row?.presetName,
    row?.reportPath,
    row?.existingReportPath,
    row?.reportPathHint,
    row?.testerOnlyCommand,
    row?.configOnlyCommand,
    row?.task,
    row?.title,
    row?.summary,
    row?.detail,
  ]
    .filter(Boolean)
    .join(' ');
  return NON_FOCUS_SYMBOL_RE.test(text);
}

function isFocusOrUnscopedRow(row) {
  if (!isObject(row)) return false;
  const symbol = rowSymbol(row);
  if (symbol) return isFocusSymbolRow(row);
  return !rowMentionsNonFocusSymbol(row);
}

function focusScopedRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isFocusOrUnscopedRow);
}

function jstTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dateKey(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/(\d{4})[./-](\d{2})[./-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(parsed));
}

function dailyReviewDateKeys(payload = {}) {
  return [
    payload.generatedAtIso,
    payload.generatedAt,
    payload.timestamp,
    payload.summary?.dailyReviewGeneratedAtIso,
    payload.summary?.generatedAtIso,
    payload.dailyPnl?.date,
    payload.summary?.dailyReviewDateJst,
  ]
    .map(dateKey)
    .filter(Boolean);
}

function dailyReviewIsFresh(payload = {}) {
  if (!present(payload)) return true;
  const keys = dailyReviewDateKeys(payload);
  if (!keys.length) return true;
  return keys.includes(jstTodayKey());
}

function liveLoopAdvisoryReady(value, payload = {}) {
  const text = String(value || '').toUpperCase();
  return (
    payload.advisoryReady === true ||
    payload.shadowAdvisoryReady === true ||
    text === 'SHADOW_ADVISORY_READY' ||
    text === 'READY_FOR_EXISTING_EA'
  );
}

function liveLoopStateLabel(value, label) {
  const text = String(value || '').toUpperCase();
  if (text === 'SHADOW_ADVISORY_READY') return '影子建议已就绪';
  if (text === 'READY_FOR_EXISTING_EA') return '影子建议已就绪（旧契约）';
  return label || humanizeStatus(value);
}

function liveLoopStatusTone(value, payload = {}) {
  const text = String(value || '').toUpperCase();
  if (liveLoopAdvisoryReady(text, payload)) return 'ok';
  if (text.includes('BLOCK') || text.includes('PAUSE') || text.includes('MISSING')) return 'error';
  if (text.includes('WAIT')) return 'warn';
  return 'warn';
}

function dryRunDecisionTone(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('BLOCK') || text.includes('阻断') || text.includes('暂停')) return 'warn';
  if (text.includes('PASS') || text.includes('ALLOW') || text.includes('通过') || text.includes('放行')) {
    return 'ok';
  }
  if (text.includes('WAIT') || text.includes('等待')) return 'warn';
  return value ? 'warn' : 'unknown';
}

function reasonText(row) {
  if (isObject(row)) {
    return row.reasonZh || row.reason || row.detail || row.code || row.label || humanizeStatus(row);
  }
  return humanizeStatus(row);
}

function nonEmptyObject(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

function firstNonEmptyObject(...values) {
  return values.find(nonEmptyObject) || {};
}

function reasonTextsFrom(...values) {
  const seen = new Set();
  const texts = [];
  values
    .flatMap((value) => rowsFromPayload(value))
    .forEach((row) => {
      const text = reasonText(row);
      if (!text || seen.has(text)) return;
      seen.add(text);
      texts.push(text);
    });
  return texts;
}

function isBlockingReason(value) {
  const text = String(value || '');
  const upper = text.toUpperCase();
  if (!text) return false;
  if (/不阻断|无阻断|未报告阻断|不再挡|通过|为正|可进入|可用/.test(text)) return false;
  return (
    /高冲击|新闻窗口|暂停\s*live|点差|超过|缺少|样本不足|禁止|阻断|熔断|冷却/.test(text) ||
    upper.includes('BLOCK') ||
    upper.includes('HARD')
  );
}

function newsGateBlockerText(...newsGates) {
  const gate = newsGates.find(nonEmptyObject);
  if (!gate) return '';
  const hardBlock =
    gate.hardBlock === true ||
    String(gate.riskLevel || '').toUpperCase() === 'HARD' ||
    Number(gate.lotMultiplier) === 0;
  if (!hardBlock) return '';
  return (
    gate.reasonZh ||
    gate.reason ||
    gate.highImpactEvent?.reason ||
    gate.highImpactEvent?.eventLabel ||
    '高冲击新闻窗口内暂停 live，shadow / replay 继续。'
  );
}

function rsiDiagnosticBlockerText(diagnostics = {}) {
  if (!nonEmptyObject(diagnostics)) return '';
  const reasons = rowsFromPayload(diagnostics.whyNoEntry).map(reasonText).filter(Boolean);
  if (reasons.length) return reasons.slice(0, 2).join('；');
  const state = String(diagnostics.state || '').toUpperCase();
  if (!state || ['READY', 'OK', 'PASS'].includes(state)) return '';
  return diagnostics.stateZh || diagnostics.summary || humanizeStatus(diagnostics.state);
}

function evidenceGateTone(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('PASS') || text.includes('ALLOW') || text.includes('READY')) return 'ok';
  if (text.includes('BLOCK') || text.includes('FAIL') || text.includes('STOP')) return 'error';
  if (text.includes('WARN') || text.includes('WATCH') || text.includes('WAIT')) return 'warn';
  return 'warn';
}

function executionGateZh(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('PASS') || text.includes('ALLOW') || text.includes('READY'))
    return '可用于 Shadow 研究晋级';
  if (text.includes('BLOCK')) return '反馈证据阻断研究晋级';
  if (text.includes('FAIL')) return '反馈证据未通过';
  if (text.includes('WATCH')) return '反馈证据观察中';
  if (text.includes('WAIT')) return '等待影子 / 历史反馈';
  return humanizeStatus(value || '等待影子 / 历史反馈');
}

function mutationHintZh(value) {
  const text = String(value || '').toUpperCase();
  if (!text) return '等待 Case Memory 生成 GA 修复方向';
  if (text.includes('SLIPPAGE')) return '降低滑点损伤';
  if (text.includes('SPREAD')) return '收紧点差风险';
  if (text.includes('UNSTABLE') || text.includes('REJECT_UNSTABLE')) return '剔除不稳定候选';
  if (text.includes('EARLY_EXIT') || text.includes('LET_PROFIT')) return '改善过早出场';
  if (text.includes('MISSED') || text.includes('ENTRY')) return '减少错失入场';
  if (text.includes('RSI')) return '微调 RSI 买入触发';
  if (text.includes('NEWS')) return '复核新闻软门禁';
  if (text.includes('LATENCY')) return '降低执行延迟';
  return humanizeStatus(value);
}

function safetyEnvelope(raw = {}) {
  const candidates = [
    raw.status?.safety,
    raw.status?.data?.safety,
    raw.snapshot?.safety,
    raw.snapshot?.data?.safety,
    raw.account?.safety,
    raw.positions?.safety,
    raw.orders?.safety,
  ];
  return candidates.find(isObject) || {};
}

function normalizeAccountId(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '—') return '';
  return text.replace(/[^\d]/g, '');
}

export function maskAccountLogin(value) {
  const login = normalizeAccountId(value);
  if (!login) return '—';
  return `••••${login.slice(-4)}`;
}

function normalizeServerName(value) {
  const text = String(value ?? '').trim();
  return text && text !== '—' ? text.toLowerCase() : '';
}

function timestampParts(value) {
  const match = String(value || '').match(
    /(\d{4})[./-](\d{2})[./-](\d{2})(?:[ T](\d{2}):?(\d{2})?(?::?(\d{2}))?)?/,
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
  };
}

function weekdayFromParts(parts) {
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function forexSessionFromGmt(value) {
  const parts = timestampParts(value);
  const weekday = weekdayFromParts(parts);
  if (weekday === null) return '';
  if (weekday === 6 || (weekday === 0 && parts.hour < 22) || (weekday === 5 && parts.hour >= 22)) {
    return 'MARKET_CLOSED';
  }
  return 'MARKET_OPEN';
}

function weekendSessionFromTimestamp(value) {
  const weekday = weekdayFromParts(timestampParts(value));
  return weekday === 0 || weekday === 6 ? 'MARKET_CLOSED' : '';
}

function explicitMarketSession(source = {}) {
  const values = [
    source.marketSession,
    source.sessionStatus,
    source.market?.session,
    source.market?.status,
    source.runtime?.marketSession,
    source.runtime?.sessionStatus,
    source.usdJpyRsiEntryDiagnostics?.guards?.marketSession,
  ];
  const normalized = values.map((value) => String(value || '').toUpperCase());
  if (normalized.some((text) => text.includes('CLOSED') || text.includes('OFF_MARKET'))) {
    return 'MARKET_CLOSED';
  }
  if (normalized.some((text) => text.includes('OPEN'))) return 'MARKET_OPEN';
  return '';
}

export function resolveMt5MarketSession(...payloads) {
  const sources = payloads.map((payload) => unwrap(payload) || {}).filter(isObject);
  const explicitSessions = sources.map(explicitMarketSession);
  if (explicitSessions.includes('MARKET_CLOSED')) return 'MARKET_CLOSED';
  if (explicitSessions.includes('MARKET_OPEN')) return 'MARKET_OPEN';
  for (const source of sources) {
    if (
      source.marketClosed === true ||
      source.market?.closed === true ||
      source.runtime?.marketClosed === true ||
      source.marketClosedTickIdle === true ||
      source.runtime?.marketClosedTickIdle === true
    ) {
      return 'MARKET_CLOSED';
    }
  }
  for (const source of sources) {
    const sessionOpen =
      source.sessionOpen ??
      source.market?.sessionOpen ??
      source.runtime?.sessionOpen ??
      source.usdJpyRsiEntryDiagnostics?.guards?.sessionOpen;
    if (sessionOpen === false) return 'MARKET_CLOSED';
  }
  for (const source of sources) {
    const inferred = forexSessionFromGmt(source.runtime?.gmtTime || source.gmtTime);
    if (inferred) return inferred;
  }
  for (const source of sources) {
    const inferred = weekendSessionFromTimestamp(
      source.runtime?.serverTime ||
        source.runtime?.localTime ||
        source.generatedAtIso ||
        source.generatedAt ||
        source.timestamp,
    );
    if (inferred) return inferred;
  }
  for (const source of sources) {
    const sessionOpen =
      source.sessionOpen ??
      source.market?.sessionOpen ??
      source.runtime?.sessionOpen ??
      source.usdJpyRsiEntryDiagnostics?.guards?.sessionOpen;
    if (sessionOpen === true) return 'MARKET_OPEN';
  }
  return 'MARKET_UNKNOWN';
}

function quoteFreshFromPayload(source = {}, runtime = {}, market = {}, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') return false;
  const explicit =
    market.quoteFresh ??
    source.quoteFresh ??
    runtime.quoteFresh ??
    source.usdJpyRsiEntryDiagnostics?.quoteFresh;
  if (explicit === true || explicit === false) return explicit;
  const tickAgeSeconds = numberValue(
    runtime.tickAgeSeconds ?? market.tickAgeSeconds ?? source.tickAgeSeconds,
  );
  if (tickAgeSeconds === null) return false;
  const maxTickAgeSeconds =
    numberValue(runtime.maxTickAgeSeconds ?? market.maxTickAgeSeconds ?? source.maxTickAgeSeconds) ?? 120;
  return tickAgeSeconds <= maxTickAgeSeconds;
}

function firstObject(...values) {
  return values.find((value) => isObject(value) && Object.keys(value).length) || {};
}

function firstExplicitBoolean(...values) {
  return values.find((value) => value === true || value === false) ?? null;
}

function hasAccountFields(value) {
  return (
    isObject(value) &&
    [
      value.login,
      value.loginMasked,
      value.account,
      value.server,
      value.trade_server,
      value.balance,
      value.equity,
    ].some(present)
  );
}

function mt5ConnectionFromPayload(accountPayload, snapshotPayload = {}, options = {}) {
  const accountEnvelope = unwrap(accountPayload) || {};
  const snapshotEnvelope = unwrap(snapshotPayload) || {};
  const source = { ...snapshotEnvelope, ...accountEnvelope };
  const freshness = freshnessFromReadonlyPayload(source, options);
  const account = firstObject(
    accountEnvelope.account,
    snapshotEnvelope.account,
    hasAccountFields(accountEnvelope) ? accountEnvelope : null,
    hasAccountFields(snapshotEnvelope) ? snapshotEnvelope : null,
  );
  const runtime = firstObject(accountEnvelope.runtime, snapshotEnvelope.runtime);
  const terminal = firstObject(accountEnvelope.terminal, snapshotEnvelope.terminal);
  const connectionState = firstObject(
    accountEnvelope.connection,
    snapshotEnvelope.connection,
    runtime.connectionState,
  );
  const hostProcess = mt5HostProcess(source);
  const processRunningSignal = firstExplicitBoolean(connectionState.processRunning, runtime.processRunning);
  const hostProcessMissing =
    processRunningSignal === false ||
    (processRunningSignal === null &&
      (mt5HostProcessMissing(hostProcess) || freshness.terminalProcessMissing === true));
  const latestAuthorization = isObject(terminal.lastAuthorization) ? terminal.lastAuthorization : {};
  const login = pick(
    { account, source, latestAuthorization },
    [
      'account.login',
      'account.loginMasked',
      'account.account',
      'source.login',
      'source.loginMasked',
      'latestAuthorization.login',
    ],
    '',
  );
  const server = pick(
    { account, source, latestAuthorization },
    ['account.server', 'account.trade_server', 'source.server', 'latestAuthorization.server'],
    '',
  );
  const terminalStatus = String(terminal.status || '').toUpperCase();
  const status = String(source.status || terminal.status || '').toUpperCase();
  const market = isObject(source.market) ? source.market : {};
  const brokerConnectionSignal = firstExplicitBoolean(
    connectionState.brokerSessionConnected,
    connectionState.brokerConnected,
    runtime.brokerSessionConnected,
    runtime.brokerConnected,
    terminal.connected,
    runtime.terminalConnected,
    runtime.connected,
  );
  const brokerConnected =
    brokerConnectionSignal ??
    (status === 'CONNECTED' ||
      status === 'AUTHORIZED' ||
      terminalStatus === 'CONNECTED' ||
      terminalStatus === 'AUTHORIZED');
  const accountIdentityPresent =
    firstExplicitBoolean(connectionState.accountIdentityPresent, runtime.accountIdentityPresent) ??
    Boolean(normalizeAccountId(login) && normalizeServerName(server));
  const authorizationSignal = firstExplicitBoolean(
    connectionState.accountAuthorized,
    runtime.accountAuthorized,
  );
  const readReadySignal = firstExplicitBoolean(connectionState.readReady, runtime.readReady);
  const accountAuthorized =
    authorizationSignal ??
    Boolean(
      accountIdentityPresent &&
      (status === 'CONNECTED' || status === 'AUTHORIZED' || terminalStatus === 'AUTHORIZED'),
    );
  const writerFreshSignal = firstExplicitBoolean(connectionState.writerFresh, runtime.writerFresh);
  const writerFresh = Boolean(
    writerFreshSignal !== false &&
    source.snapshotFresh !== false &&
    freshness.fresh === true &&
    !freshnessBlocksCurrentState(freshness),
  );
  const processRunning =
    processRunningSignal ??
    (hostProcess.terminalProcessDetected === true
      ? true
      : hostProcess.terminalProcessDetected === false
        ? false
        : null);
  const connectionEvidenceKnown = Boolean(
    String(connectionState.semantics || runtime.connectionSemantics || '').toUpperCase() ===
      'EXPLICIT_CONNECTION_EVIDENCE_V2' ||
    readReadySignal !== null ||
    brokerConnectionSignal !== null ||
    authorizationSignal !== null ||
    ['CONNECTED', 'AUTHORIZED'].includes(status) ||
    ['CONNECTED', 'AUTHORIZED'].includes(terminalStatus),
  );
  const explicitConnectionFailure =
    readReadySignal === false ||
    brokerConnectionSignal === false ||
    authorizationSignal === false ||
    writerFreshSignal === false ||
    processRunningSignal === false;
  const readReady =
    !explicitConnectionFailure &&
    brokerConnected &&
    accountAuthorized &&
    writerFresh &&
    processRunning === true &&
    readReadySignal !== false;
  const marketSession = resolveMt5MarketSession(source, snapshotEnvelope, accountEnvelope);
  const quoteFresh = quoteFreshFromPayload(source, runtime, market, marketSession);
  const connected = brokerConnected && accountAuthorized;
  const connectionError = connected
    ? ''
    : terminal.lastAuthFailure?.message ||
      terminal.lastAuthFailure?.reason ||
      source.error ||
      source.detail?.stderr ||
      source.pythonBridgeError ||
      '';

  const connection = {
    ok: accountEnvelope.ok === true || snapshotEnvelope.ok === true,
    status: source.status || (connected ? 'CONNECTED' : 'MISSING'),
    connected,
    brokerConnected,
    brokerSessionConnected: brokerConnected,
    accountIdentityPresent,
    accountAuthorized,
    writerFresh,
    processRunning,
    connectionEvidenceKnown,
    connectionSemantics: connectionState.semantics || runtime.connectionSemantics || '',
    readReady: connectionEvidenceKnown ? readReady : null,
    quoteFresh,
    marketSession,
    tradingReady: false,
    login,
    server,
    name: pick({ account, source }, ['account.name', 'source.name'], ''),
    company: pick({ account, source }, ['account.company', 'source.company'], ''),
    balance: pick({ account, source }, ['account.balance', 'source.balance'], null),
    equity: pick({ account, source }, ['account.equity', 'source.equity'], null),
    profit: pick({ account, source }, ['account.profit', 'source.profit'], null),
    margin: pick({ account, source }, ['account.margin', 'source.margin'], null),
    freeMargin: pick(
      { account, source },
      [
        'account.free_margin',
        'account.marginFree',
        'account.margin_free',
        'source.freeMargin',
        'source.marginFree',
      ],
      null,
    ),
    currency: pick({ account, source }, ['account.currency', 'source.currency'], 'USC'),
    leverage: pick({ account, source }, ['account.leverage', 'source.leverage'], null),
    tradeStatus: pick({ runtime, source }, ['runtime.tradeStatus', 'source.tradeStatus'], ''),
    shadowMode: pick({ runtime }, ['runtime.shadowMode'], false),
    readOnlyMode: pick({ runtime }, ['runtime.readOnlyMode'], false),
    executionEnabled: pick({ runtime }, ['runtime.executionEnabled'], false),
    livePilotMode: pick({ runtime }, ['runtime.livePilotMode'], false),
    tradeAllowed: pick(
      { runtime, terminal, account },
      [
        'runtime.tradeAllowed',
        'runtime.terminalTradeAllowed',
        'terminal.tradeAllowed',
        'account.tradeAllowed',
      ],
      false,
    ),
    terminalTradeAllowed: pick(
      { runtime, terminal },
      ['runtime.terminalTradeAllowed', 'terminal.tradeAllowed'],
      null,
    ),
    programTradeAllowed: pick({ runtime }, ['runtime.programTradeAllowed'], null),
    accountTradeAllowed: pick(
      { runtime, account },
      ['runtime.accountTradeAllowed', 'account.tradeAllowed'],
      null,
    ),
    accountExpertTradeAllowed: pick(
      { runtime, account },
      ['runtime.accountExpertTradeAllowed', 'account.tradeExpert'],
      null,
    ),
    focusSymbolTradeAllowed: pick({ runtime }, ['runtime.focusSymbolTradeAllowed'], null),
    killSwitch: pick({ runtime }, ['runtime.pilotKillSwitch'], null),
    startupGuardActive: pick({ runtime }, ['runtime.pilotStartupEntryGuardActive'], null),
    startupGuardReason: pick({ runtime }, ['runtime.pilotStartupEntryGuardReason'], ''),
    tradePermissionBlocker: pick({ runtime }, ['runtime.tradePermissionBlocker'], ''),
    market,
    watchlist: pick({ source, market }, ['source.watchlist', 'market.symbol'], ''),
    timestamp: pick(
      { runtime, source },
      ['runtime.localTime', 'runtime.serverTime', 'source.generatedAtIso'],
      '',
    ),
    account,
    runtime,
    terminal,
    hostProcess,
    hostProcessKnown: Boolean(
      processRunningSignal !== null ||
      hostProcessMissing ||
      hostProcess.status ||
      hostProcess.terminalProcessDetected !== null,
    ),
    hostProcessMissing,
    hostProcessLine:
      hostProcessMissing && !hostProcess.status && hostProcess.terminalProcessDetected === null
        ? '未检测到 terminal64/wine 进程'
        : mt5HostProcessLine(hostProcess),
    snapshotFresh: source.snapshotFresh ?? freshness.fresh,
    freshness,
    sourceFile: source.source?.file || freshness.sourceFile || '',
    error: connectionError,
  };
  connection.tradingReady = accountAutoTradingEnabled(connection);
  return connection;
}

function accountAutoTradingEnabled(account = {}) {
  if (!account.ok || account.hostProcessMissing || freshnessBlocksCurrentState(account.freshness || {})) {
    return false;
  }
  const permissionFlags = [
    account.terminalTradeAllowed,
    account.programTradeAllowed,
    account.accountTradeAllowed,
    account.accountExpertTradeAllowed,
    account.focusSymbolTradeAllowed,
  ];
  return Boolean(
    normalizeAccountId(account.login) &&
    account.brokerConnected === true &&
    account.accountAuthorized === true &&
    account.writerFresh === true &&
    account.quoteFresh === true &&
    account.marketSession === 'MARKET_OPEN' &&
    !truthyFlag(account.shadowMode) &&
    !truthyFlag(account.readOnlyMode) &&
    account.executionEnabled === true &&
    account.livePilotMode === true &&
    account.tradeAllowed === true &&
    permissionFlags.every((value) => value === true) &&
    account.killSwitch === false &&
    account.startupGuardActive === false,
  );
}

function accountSlotDisabled(account = {}) {
  return (
    String(account.status || account.freshness?.status || '').toUpperCase() === 'DISABLED' &&
    account.enabled === false &&
    account.optional === true
  );
}

function accountStatusTone(account = {}) {
  if (accountSlotDisabled(account)) return 'warn';
  if (!account.ok) return 'blocked';
  if (account.hostProcessMissing || freshnessMissing(account.freshness || {})) return 'blocked';
  if (freshnessBlocksCurrentState(account.freshness || {})) return 'warn';
  if (!normalizeAccountId(account.login) || !account.brokerConnected || !account.accountAuthorized)
    return 'error';
  if (truthyFlag(account.killSwitch)) return 'error';
  if (account.marketSession === 'MARKET_CLOSED') return 'warn';
  if (!accountAutoTradingEnabled(account)) return 'warn';
  if (truthyFlag(account.startupGuardActive)) return 'warn';
  return 'ok';
}

function accountStatusLabel(account = {}) {
  if (accountSlotDisabled(account)) return '未启用（可选）';
  if (!account.ok) return '状态未知 / 已阻断';
  if (account.hostProcessMissing) return 'writer 未运行';
  if (freshnessMissing(account.freshness || {})) return '快照缺失';
  if (freshnessStale(account.freshness || {})) return '快照过期';
  if (freshnessUnconfirmed(account.freshness || {})) return '快照待确认';
  if (!normalizeAccountId(account.login) || !account.brokerConnected) return '经纪商未连接';
  if (!account.accountAuthorized) return '账号未授权';
  if (truthyFlag(account.killSwitch)) return '熔断中';
  if (truthyFlag(account.startupGuardActive)) return '启动保护中';
  if (
    truthyFlag(account.shadowMode) ||
    truthyFlag(account.readOnlyMode) ||
    String(account.tradeStatus || '').toUpperCase() === 'SHADOW'
  ) {
    return account.marketSession === 'MARKET_CLOSED' ? 'Shadow / 只读（MARKET_CLOSED）' : 'Shadow / 只读观察';
  }
  if (account.marketSession === 'MARKET_CLOSED') return 'MARKET_CLOSED / 只读已连接';
  if (!accountAutoTradingEnabled(account)) return '只读观察（不会执行交易）';
  return '旧执行字段已降级为只读观察';
}

function accountConnectionAxisItems(account = {}) {
  if (accountSlotDisabled(account)) {
    return [
      {
        label: 'Broker 连接',
        value: '未启用',
        status: 'warn',
        hint: '第二账号槽位已保留，但当前没有启动独立 MT5 只读实例。',
      },
      {
        label: '本地身份授权',
        value: '未启用',
        status: 'warn',
        hint: '未启用不等于授权失败，也不会影响主账号只读监控。',
      },
      {
        label: 'Writer 新鲜度',
        value: '未启用',
        status: 'warn',
        hint: '该槽位不参与当前 writer freshness 与就绪度计算。',
      },
      {
        label: '报价新鲜度',
        value: '不适用',
        status: 'warn',
        hint: '只有显式启用并连接第二终端后才评估独立报价。',
      },
      {
        label: '市场时段',
        value: '不适用',
        status: 'warn',
        hint: '当前市场状态由已启用账号的只读证据判断。',
      },
      {
        label: '影子观察状态',
        value: '未启用（可选）',
        status: 'warn',
        hint: '第二账号未加入 active readiness；系统继续保持 Shadow / ReadOnly。',
      },
    ];
  }
  const shadowOnly =
    truthyFlag(account.shadowMode) ||
    truthyFlag(account.readOnlyMode) ||
    String(account.tradeStatus || '').toUpperCase() === 'SHADOW';
  return [
    {
      label: 'Broker 连接',
      value: account.brokerConnected ? '已连接' : '未连接',
      status: account.brokerConnected ? 'ok' : 'blocked',
      hint: '只由终端 connected / terminalConnected / CONNECTED 证据判断；不使用快照新鲜度代替。',
    },
    {
      label: '本地身份授权',
      value:
        account.accountAuthorized && account.brokerConnected
          ? '已授权'
          : account.accountIdentityPresent
            ? '已登记 / Broker 未验证'
            : '未授权',
      status: account.accountAuthorized && account.brokerConnected ? 'ok' : 'blocked',
      hint:
        account.accountAuthorized && account.brokerConnected
          ? maskAccountLogin(account.login)
          : account.accountIdentityPresent
            ? '本地账号与服务器符合只读配置，但当前 Broker 未连接，不能视为在线授权成功。'
            : '等待明确 accountAuthorized 证据。',
    },
    {
      label: 'Writer 新鲜度',
      value: account.writerFresh ? 'FRESH' : freshnessStatusLabel(account.freshness || {}),
      status: account.writerFresh ? 'ok' : 'blocked',
      hint: freshnessAgeLine(account.freshness || {}),
    },
    {
      label: '报价新鲜度',
      value:
        account.marketSession === 'MARKET_CLOSED'
          ? 'MARKET_CLOSED（报价静止）'
          : account.quoteFresh
            ? 'FRESH'
            : 'STALE / 未确认',
      status: account.marketSession === 'MARKET_CLOSED' ? 'warn' : account.quoteFresh ? 'ok' : 'blocked',
      hint:
        account.marketSession === 'MARKET_CLOSED'
          ? '休市期间 tickAge 增长是正常现象，不等价于账号掉线。'
          : `tickAge ${formatAgeSeconds(account.runtime?.tickAgeSeconds)}`,
    },
    {
      label: '市场时段',
      value: account.marketSession,
      status:
        account.marketSession === 'MARKET_OPEN'
          ? 'ok'
          : account.marketSession === 'MARKET_CLOSED'
            ? 'warn'
            : 'blocked',
      hint: account.marketSession === 'MARKET_CLOSED' ? '外汇休市，只保留 Shadow / ReadOnly 观察。' : '',
    },
    {
      label: '影子观察状态',
      value: account.tradingReady
        ? '旧 ready 已降级为 Shadow 建议'
        : shadowOnly
          ? 'Shadow / ReadOnly（无执行通道）'
          : account.marketSession === 'MARKET_CLOSED'
            ? 'MARKET_CLOSED'
            : '等待只读观察证据',
      status:
        account.tradingReady || shadowOnly || account.marketSession === 'MARKET_CLOSED' ? 'warn' : 'blocked',
      hint: '仅表示观察与建议证据；EA、前端和自动化都没有 broker mutation 通道。',
    },
  ];
}

export function buildMt5PrimaryAxisItems(snapshot = {}) {
  return accountConnectionAxisItems(snapshot.primaryConnection || snapshot);
}

function accountPermissionItem(account = {}) {
  if (accountSlotDisabled(account)) {
    return {
      label: 'MT5 权限证据',
      value: '未启用（可选）',
      status: 'warn',
      hint: '第二账号槽位未启动，不参与当前权限或运行就绪判断。',
    };
  }
  if (!account.ok) {
    return {
      label: 'MT5 权限证据',
      value: '未知 / 已阻断',
      status: 'blocked',
      hint: '账号或快照接口没有明确返回 ok=true；恢复只读证据前禁止把缺失值当作安全。',
    };
  }
  if (account.hostProcessMissing || freshnessBlocksCurrentState(account.freshness || {})) {
    const freshness = account.freshness || {};
    const blocked = account.hostProcessMissing || freshnessMissing(freshness);
    return {
      label: 'MT5 权限证据',
      value: account.hostProcessMissing ? 'writer 未运行' : freshnessStatusLabel(freshness),
      status: blocked ? 'blocked' : 'warn',
      hint: account.hostProcessMissing
        ? '未检测到 terminal64/wine 进程；先恢复 MT5/EA dashboard writer，再判断账号与只读观察状态。'
        : freshnessRecoveryHint(freshness, '等待新鲜 MT5 快照后再判断只读观察状态。'),
    };
  }
  const flags = [
    account.terminalTradeAllowed,
    account.programTradeAllowed,
    account.accountTradeAllowed,
    account.accountExpertTradeAllowed,
    account.focusSymbolTradeAllowed,
  ];
  const missingFlags = flags.filter((value) => value === null || value === undefined || value === '');
  if (missingFlags.length) {
    return {
      label: 'MT5 权限证据',
      value: '证据不完整 / 已阻断',
      status: 'blocked',
      hint: `缺少 ${missingFlags.length} 项终端权限诊断证据；这些字段只用于观察，不构成执行授权。`,
    };
  }
  const allPassed = flags.every((value) => value === true);
  return {
    label: 'MT5 权限证据',
    value: allPassed ? '已观测（不构成执行授权）' : '证据有阻断',
    status: allPassed ? 'ok' : 'blocked',
    hint: `只读诊断：终端 ${passText(account.terminalTradeAllowed)} / 程序 ${passText(
      account.programTradeAllowed,
    )} / 账号 ${passText(account.accountTradeAllowed)} / EA ${passText(
      account.accountExpertTradeAllowed,
    )} / 品种 ${passText(account.focusSymbolTradeAllowed)}`,
  };
}

function accountSymbolLabel(account = {}) {
  return account.market?.symbol || account.watchlist || '—';
}

function accountMarketHint(account = {}) {
  const spread = numberValue(account.market?.spread);
  if (spread !== null) return `点差 ${spread.toFixed(1)}`;
  return account.watchlist ? `Watchlist ${account.watchlist}` : '';
}

function accountSnapshotItems(account = {}) {
  return [
    { label: '账号', value: maskAccountLogin(account.login) },
    { label: '服务器', value: account.server || '—' },
    {
      label: '终端',
      value:
        typeof account.terminal === 'object' ? account.terminal.name || 'HFM MT5' : account.terminal || '—',
    },
    { label: '余额', value: formatAccountWithCurrency(account.balance, account.currency) },
    { label: '净值', value: formatAccountWithCurrency(account.equity, account.currency) },
    { label: '浮动盈亏', value: formatAccountWithCurrency(account.profit, account.currency) },
    { label: '保证金', value: formatAccountWithCurrency(account.margin, account.currency) },
    { label: '可用保证金', value: formatAccountWithCurrency(account.freeMargin, account.currency) },
  ];
}

function spreadGateTone(spreadGate = {}, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') return 'warn';
  const tier = String(spreadGate.tier || '').toUpperCase();
  if (spreadGate.hardBlock || tier === 'HARD_WIDE' || tier === 'UNKNOWN') return 'error';
  if (tier.includes('SOFT_WIDE')) return 'warn';
  if (tier === 'NORMAL') return 'ok';
  return 'unknown';
}

function spreadGateLabel(spreadGate = {}, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') return 'MARKET_CLOSED / 休市';
  const spread = numberValue(spreadGate.spreadPips);
  const tier = spreadGate.tierZh || humanizeStatus(spreadGate.tier || '待同步');
  return `${spread === null ? '—' : spread.toFixed(2)} pips / ${tier}`;
}

function spreadGateHint(spreadGate = {}, isUsdLane = false, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') {
    return '休市报价冻结，当前点差不参与就绪或硬阻断判断；开市后等待新报价再评估。';
  }
  const tier = String(spreadGate.tier || '').toUpperCase();
  const action =
    spreadGate.hardBlock || tier === 'HARD_WIDE'
      ? '阻断新的 Shadow 建议'
      : tier.includes('SOFT_WIDE')
        ? '降低 Shadow 建议权重'
        : '保持 Shadow 研究观察';
  const limits = [
    numberValue(spreadGate.normalLimitPips),
    numberValue(spreadGate.softLimitPips),
    numberValue(spreadGate.hardLimitPips),
  ]
    .map((value) => (value === null ? '—' : value.toFixed(1)))
    .join(' / ');
  return `${action}；${isUsdLane ? 'USD ReadOnly' : 'Cent Shadow'} 仅作研究对照。正常/软/硬阈值 ${limits} pips`;
}

function spreadGateDiagnosticConclusion(spreadGate = {}, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') return 'MARKET_CLOSED / 休市不评估';
  if (!present(spreadGate)) return null;
  if (spreadGate.hardBlock) return '严重偏宽 / 硬阻断';
  const tier = spreadGate.tierZh || humanizeStatus(spreadGate.tier || '');
  if (!tier) return '未硬阻断';
  return `${tier} / 未硬阻断`;
}

function spreadGateDiagnosticDetail(spreadGate = {}, isUsdLane = false, marketSession = '') {
  if (marketSession === 'MARKET_CLOSED') {
    return '休市期间报价静止，不把冻结点差显示为硬阻断；开市后等待新 tick。';
  }
  if (!present(spreadGate)) return null;
  return `${spreadGateLabel(spreadGate)}；${spreadGateHint(spreadGate, isUsdLane)}`;
}

function accountCard(account = {}, fallback = {}) {
  const title = fallback.title || account.label || 'MT5 账号';
  const lane = present(fallback.lane) ? fallback.lane : null;
  const spreadGate = present(fallback.spreadGate) ? fallback.spreadGate : null;
  const usdDeploymentGate = present(fallback.usdDeploymentGate) ? fallback.usdDeploymentGate : null;
  if (accountSlotDisabled(account)) {
    return {
      role: fallback.role || account.role || title,
      eyebrow: fallback.eyebrow || 'MT5 Account',
      title,
      subtitle: '第二账号槽位已保留',
      status: 'warn',
      statusLabel: '未启用（可选）',
      note: '未启用不等于登录失败；该槽位不参与主账号连接、writer 或只读监控就绪度计算。',
      items: [
        { label: '槽位状态', value: '未启用（可选）', status: 'warn' },
        {
          label: 'Broker 连接',
          value: '未启动第二终端',
          status: 'warn',
          hint: '显式启用独立 Shadow / ReadOnly 终端后才检查连接。',
        },
        {
          label: 'Writer 新鲜度',
          value: '不参与',
          status: 'warn',
          hint: '当前 active readiness 只核对已启用账号。',
        },
        { label: '当前持仓', value: '不适用', status: 'warn' },
        {
          label: '执行边界',
          value: 'Shadow / ReadOnly（无执行通道）',
          status: 'warn',
        },
      ],
    };
  }
  const latestFreshness = present(account.freshness)
    ? account.freshness
    : present(fallback.latestFreshness)
      ? fallback.latestFreshness
      : null;
  const latestStale = Boolean(latestFreshness && freshnessStale(latestFreshness));
  const latestFresh = latestFreshness?.fresh === true;
  const latestUnconfirmed = Boolean(latestFreshness && freshnessUnconfirmed(latestFreshness));
  const accountSnapshotStale = latestStale || account.snapshotFresh === false;
  const accountSnapshotUnconfirmed = !accountSnapshotStale && latestUnconfirmed;
  const connectionBlock = accountConnectionBlockState(account);
  const connectionBlocksVisibleState =
    connectionBlock.blocked && !accountSnapshotStale && !accountSnapshotUnconfirmed;
  const currentStateTrusted =
    account.ok === true &&
    account.connectionEvidenceKnown === true &&
    account.readReady === true &&
    account.brokerConnected === true &&
    account.accountAuthorized === true &&
    account.writerFresh === true &&
    latestFresh &&
    !accountSnapshotStale &&
    !accountSnapshotUnconfirmed &&
    account.snapshotFresh === true;
  const freshnessHint = latestFreshness ? freshnessRecoveryHint(latestFreshness) : '';
  const accountSnapshotHint = freshnessHint || account.timestamp || account.sourceFile || '等待 MT5 快照刷新';
  const currentStateHint = connectionBlocksVisibleState
    ? `${connectionBlock.state}；该账号当前持仓、净值与余额不可确认，历史值仅作参考。`
    : accountSnapshotHint;
  const positions = Array.isArray(fallback.positions) ? fallback.positions : [];
  const positionHint = positions.length
    ? positions
        .slice(0, 3)
        .map(
          (row) =>
            `${row.symbol || '未知品种'} ${humanizeStatus(row.type || row.side || '')} ${format(row.volume || row.lots || 0)}`,
        )
        .join('；')
    : '该账号实时快照当前无持仓';
  const stalePositionHint = [
    accountSnapshotHint,
    positions.length
      ? `旧快照持仓 ${positions.length} 笔，仅作历史参考`
      : '旧快照未显示持仓，不能据此确认当前为 0 仓',
  ]
    .filter(Boolean)
    .join('；');
  const isUsdLane =
    lane?.accountMode === 'standard_usd' ||
    String(lane?.lane || '').includes('USD') ||
    String(fallback.eyebrow || '').includes('USD');
  const subtitle =
    normalizeAccountId(account.login) || account.server
      ? `${maskAccountLogin(account.login)} / ${account.server || '未返回服务器'}`
      : '等待 MT5 快照';
  return {
    role: fallback.role || account.role || title,
    eyebrow: fallback.eyebrow || 'MT5 Account',
    title,
    subtitle,
    status: accountStatusTone(account),
    statusLabel: accountStatusLabel(account),
    note:
      account.startupGuardReason ||
      account.tradePermissionBlocker ||
      account.error ||
      'EA 只记录 Shadow 观察与建议；session、点差、新闻和信号仅影响研究结论，不会触发交易。',
    items: [
      { label: '账号', value: maskAccountLogin(account.login) },
      { label: '服务器', value: account.server || '—' },
      ...accountConnectionAxisItems(account),
      ...(account.hostProcessKnown
        ? [
            {
              label: 'MT5 进程',
              value: account.hostProcessLine || '进程状态待确认',
              status: account.hostProcessMissing
                ? 'blocked'
                : account.hostProcess?.terminalProcessDetected
                  ? 'ok'
                  : 'warn',
              hint: account.hostProcessMissing
                ? '先恢复对应 terminal64/wine 与 EA dashboard writer，再判断当前账号、持仓和只读观察状态。'
                : '按只读桥 hostProcess 证据判断。',
            },
          ]
        : []),
      {
        label: '当前持仓',
        value:
          connectionBlocksVisibleState || accountSnapshotStale
            ? '不可确认'
            : accountSnapshotUnconfirmed
              ? '待确认'
              : `${positions.length} 笔`,
        status: connectionBlocksVisibleState
          ? 'blocked'
          : accountSnapshotStale || accountSnapshotUnconfirmed || positions.length
            ? 'warn'
            : 'ok',
        hint: connectionBlocksVisibleState
          ? [currentStateHint, stalePositionHint].filter(Boolean).join('；')
          : accountSnapshotStale || accountSnapshotUnconfirmed
            ? stalePositionHint
            : positionHint,
      },
      staleAwareAccountItem('净值', account.equity, account.currency, {
        blocked: connectionBlocksVisibleState,
        stale: accountSnapshotStale,
        unconfirmed: accountSnapshotUnconfirmed,
        hint: currentStateHint,
      }),
      staleAwareAccountItem('余额', account.balance, account.currency, {
        blocked: connectionBlocksVisibleState,
        stale: accountSnapshotStale,
        unconfirmed: accountSnapshotUnconfirmed,
        hint: currentStateHint,
      }),
      {
        label: '交易品种',
        value: currentStateTrusted ? accountSymbolLabel(account) : '不可用 / 已阻断',
        status: currentStateTrusted ? 'ok' : 'blocked',
        hint: currentStateTrusted
          ? accountMarketHint(account)
          : `历史证据：${accountSymbolLabel(account)}；${accountMarketHint(account)}`,
      },
      {
        label: '执行边界',
        value: !currentStateTrusted ? '不可用 / 已阻断' : 'Shadow / ReadOnly（无执行通道）',
        status: !currentStateTrusted ? 'blocked' : 'warn',
        hint: !currentStateTrusted
          ? accountSnapshotHint
          : `旧终端执行字段仅作诊断：execution ${onOffText(
              account.executionEnabled,
            )} / livePilot ${onOffText(account.livePilotMode)} / tradeAllowed ${onOffText(
              account.tradeAllowed,
            )}；不会执行交易。`,
      },
      ...(latestFreshness
        ? [
            {
              label: '快照新鲜度',
              value: latestStale
                ? freshnessMissing(latestFreshness)
                  ? '缺失'
                  : '过期'
                : latestFresh
                  ? '新鲜'
                  : '待确认',
              status: latestStale || !latestFresh ? 'warn' : 'ok',
              hint: freshnessRecoveryHint(latestFreshness),
            },
          ]
        : []),
      {
        label: '守门状态',
        value: humanizeStatus(account.tradeStatus || (account.startupGuardActive ? 'STARTUP_GUARD' : '—')),
        status: accountStatusTone(account),
        hint: account.startupGuardReason || account.tradePermissionBlocker || '',
      },
      accountPermissionItem(account),
      ...(lane
        ? [
            {
              label: '账户车道',
              value: currentStateTrusted
                ? isUsdLane
                  ? 'USD ReadOnly / Paper Mirror'
                  : 'Cent Shadow / ReadOnly'
                : '不可用 / 已阻断',
              status: currentStateTrusted ? (isUsdLane ? 'warn' : 'ok') : 'blocked',
              hint: currentStateTrusted
                ? '旧 lane 字段只用于账户分组与研究对照；当前没有 execution lane。'
                : `历史车道字段：${lane.laneZh || humanizeStatus(lane.lane || lane.role)}；当前只作兼容证据。`,
            },
            {
              label: '研究信号模式',
              value: currentStateTrusted
                ? Array.isArray(lane.allowedEntryModes)
                  ? lane.allowedEntryModes.join(' / ')
                  : format(lane.allowedEntryModes || '等待治理门')
                : '不可用 / 已阻断',
              status: currentStateTrusted ? (isUsdLane ? 'warn' : 'ok') : 'blocked',
              hint: currentStateTrusted
                ? '这些模式只用于 Shadow / tester 复核，不能触发 broker order。'
                : `历史允许模式：${Array.isArray(lane.allowedEntryModes) ? lane.allowedEntryModes.join(' / ') : format(lane.allowedEntryModes || '未返回')}；当前只作研究证据。`,
            },
          ]
        : []),
      ...(isUsdLane && usdDeploymentGate
        ? [
            {
              label: 'USD Shadow 对照门',
              value: currentStateTrusted
                ? usdDeploymentGate.liveAllowed
                  ? '旧 liveAllowed=true（已退役 / 不生效）'
                  : 'Shadow / PAPER_MIRROR'
                : '不可用 / 已阻断',
              status: currentStateTrusted ? (usdDeploymentGate.liveAllowed ? 'warn' : 'ok') : 'blocked',
              hint: currentStateTrusted
                ? `旧部署字段只作历史兼容；${usdDeploymentGate.reasonZh || '当前保持 Shadow / ReadOnly。'} 不构成执行授权。`
                : '旧部署门只作历史明细；恢复新鲜快照后也只能用于 Shadow / ReadOnly 观察。',
            },
          ]
        : []),
      ...(spreadGate
        ? [
            {
              label: '点差门禁',
              value: currentStateTrusted
                ? spreadGateLabel(spreadGate, account.marketSession)
                : '不可用 / 已阻断',
              status: currentStateTrusted ? spreadGateTone(spreadGate, account.marketSession) : 'blocked',
              hint: currentStateTrusted
                ? spreadGateHint(spreadGate, isUsdLane, account.marketSession)
                : `历史点差门禁：${spreadGateLabel(spreadGate)}；当前只作研究证据。`,
            },
          ]
        : []),
      {
        label: '快照刷新',
        value:
          account.snapshotFresh === true
            ? '已同步'
            : account.snapshotFresh === false
              ? '待刷新'
              : '未知 / 已阻断',
        status: account.snapshotFresh === true ? 'ok' : 'blocked',
        hint: account.timestamp || account.sourceFile || '',
      },
    ],
  };
}

function accountLedgerDisplay(account = {}, fallbackLabel = 'MT5 账号') {
  const login = normalizeAccountId(account.login);
  return login ? `${fallbackLabel} ${maskAccountLogin(login)}` : fallbackLabel;
}

function annotateLedgerRows(rows, account = {}, fallback = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const role = fallback.role || account.role || 'primary';
  const label = fallback.label || account.label || (role === 'secondary' ? '第二账号' : '主账号');
  const accountText = accountLedgerDisplay(account, label);
  return sourceRows.map((row) => ({
    ...row,
    Account: row.Account || row.account || accountText,
    AccountRole: row.AccountRole || row.accountRole || role,
    AccountLogin: maskAccountLogin(row.AccountLogin || row.accountLogin || account.login),
    AccountServer: row.AccountServer || row.accountServer || account.server || '',
  }));
}

function secondaryConnectionHint(connection) {
  if (connection?.connected || String(connection?.terminal?.status || '').toUpperCase() === 'AUTHORIZED') {
    return '第二个 MT5 实例已在 Live16 授权成功';
  }
  const authFailure = connection?.terminal?.lastAuthFailure;
  if (authFailure?.reason) {
    return `MT5 授权失败：${authFailure.reason}；请核对账号、服务器和交易密码`;
  }
  if (connection?.writerFresh && !connection?.brokerConnected) {
    return '第二账号只读 writer 已恢复，但 Broker 未连接；请在 Live16 终端重新验证账号登录。';
  }
  if (!connection?.error) return '等待第二 MT5 终端写出独立的只读快照';
  const errorText = String(connection.error || '').toLowerCase();
  if (connection.status === 'UNAVAILABLE' || errorText.includes('metatrader5 python package')) {
    return '第二 MT5 暂未写出 EA 快照；登录 Live16 后会自动变为已连接';
  }
  return connection.error;
}

function accountProfileList(payload) {
  const source = unwrap(payload) || {};
  const candidates = [
    source.profiles?.profiles,
    source.profiles,
    payload?.profiles?.profiles,
    payload?.profiles,
  ];
  const rows = candidates.find(Array.isArray) || [];
  return rows.filter(isObject);
}

export function normalizeMt5Snapshot(raw = {}) {
  const status = unwrap(raw.status) || {};
  const accountEnvelope = unwrap(raw.account) || {};
  const account = isObject(accountEnvelope.account) ? accountEnvelope.account : accountEnvelope;
  const snapshot = unwrap(raw.snapshot) || {};
  const latest = unwrap(raw.latest) || {};
  const usdJpyLiveLoop = unwrap(raw.usdJpyLiveLoop) || {};
  const evidenceOS = unwrap(raw.evidenceOS) || {};
  const accountRegistry = usdJpyLiveLoop?.accountRegistry || usdJpyLiveLoop?.policy?.accountRegistry || {};
  const accountLanes = usdJpyLiveLoop?.policy?.accountLanePolicy || usdJpyLiveLoop?.accountLanePolicy || {};
  const spreadGate =
    usdJpyLiveLoop?.spreadGate ||
    usdJpyLiveLoop?.policy?.spreadGate ||
    usdJpyLiveLoop?.topPolicy?.spreadGate ||
    {};
  const usdDeploymentGate =
    usdJpyLiveLoop?.policy?.usdDeploymentGate || usdJpyLiveLoop?.usdDeploymentGate || {};
  const runtime = isObject(snapshot.runtime) ? snapshot.runtime : {};
  const secondarySnapshotEnvelope = unwrap(raw.secondarySnapshot) || {};
  const allAccountProfiles = accountProfileList(raw.accountProfiles);
  const secondaryEnabled = !(
    String(secondarySnapshotEnvelope.status || '').toUpperCase() === 'DISABLED' &&
    secondarySnapshotEnvelope.optional === true &&
    secondarySnapshotEnvelope.enabled === false
  );
  const primaryFreshness = freshnessFromReadonlyPayload(snapshot, {
    scopeLabel: 'Live12',
    refreshEndpoint: '/api/mt5-readonly/snapshot',
  });
  const secondaryFreshness = freshnessFromReadonlyPayload(secondarySnapshotEnvelope, {
    scopeLabel: 'Live16',
    refreshEndpoint: '/api/mt5-readonly-secondary/snapshot',
  });
  const primaryPositionsFreshness = freshnessFromReadonlyPayload(raw.positions || {}, {
    scopeLabel: 'Live12',
    refreshEndpoint: '/api/mt5-readonly/positions',
  });
  const primaryOrdersFreshness = freshnessFromReadonlyPayload(raw.orders || {}, {
    scopeLabel: 'Live12',
    refreshEndpoint: '/api/mt5-readonly/orders',
  });
  const primaryPositionsBlocked =
    freshnessBlocksCurrentState(primaryFreshness) || freshnessBlocksCurrentState(primaryPositionsFreshness);
  const primaryOrdersBlocked =
    freshnessBlocksCurrentState(primaryFreshness) || freshnessBlocksCurrentState(primaryOrdersFreshness);
  const secondaryPositionsBlocked = freshnessBlocksCurrentState(secondaryFreshness);
  const secondaryOrdersBlocked = freshnessBlocksCurrentState(secondaryFreshness);
  const secondaryPositionsFromEndpoint = rowsFromPayload(raw.secondaryPositions);
  const secondaryOrdersFromEndpoint = rowsFromPayload(raw.secondaryOrders);
  const primaryPositionsRaw = primaryPositionsBlocked ? [] : rowsFromPayload(raw.positions);
  const latestFreshness =
    isObject(latest._freshness) && present(latest._freshness) ? latest._freshness : primaryFreshness;
  const secondaryPositionsRaw =
    !secondaryEnabled || secondaryPositionsBlocked
      ? []
      : secondaryPositionsFromEndpoint.length
        ? secondaryPositionsFromEndpoint
        : rowsFromPayload(secondarySnapshotEnvelope.positions || secondarySnapshotEnvelope);
  const primaryOrdersRaw = primaryOrdersBlocked ? [] : rowsFromPayload(raw.orders);
  const secondaryOrdersRaw =
    !secondaryEnabled || secondaryOrdersBlocked
      ? []
      : secondaryOrdersFromEndpoint.length
        ? secondaryOrdersFromEndpoint
        : rowsFromPayload(secondarySnapshotEnvelope.orders || {});
  const rawSymbols = rowsFromPayload(raw.symbols).length
    ? rowsFromPayload(raw.symbols)
    : rowsFromPayload(snapshot.symbols);
  const symbols = focusSymbolRows(rawSymbols);
  const primaryCloseHistoryRaw = rowsFromPayload(raw.closeHistory);
  const primaryTradeJournalRaw = rowsFromPayload(raw.tradeJournal);
  const secondaryCloseHistoryRaw = secondaryEnabled ? rowsFromPayload(raw.secondaryCloseHistory) : [];
  const secondaryTradeJournalRaw = secondaryEnabled ? rowsFromPayload(raw.secondaryTradeJournal) : [];
  const shadowSignals = focusSymbolRows(rowsFromPayload(raw.shadowSignals));
  const shadowOutcomes = focusSymbolRows(rowsFromPayload(raw.shadowOutcomes));
  const shadowCandidates = focusSymbolRows(rowsFromPayload(raw.shadowCandidates));
  const shadowCandidateOutcomes = focusSymbolRows(rowsFromPayload(raw.shadowCandidateOutcomes));
  const safety = safetyEnvelope(raw);
  const researchSummary = asSummary(raw.researchStats);
  const governanceSummary = asSummary(raw.governanceAdvisor);
  const accountProfiles = allAccountProfiles;
  const primaryConnection = {
    ...mt5ConnectionFromPayload(raw.account, raw.snapshot, {
      scopeLabel: 'Live12',
      refreshEndpoint: '/api/mt5-readonly/snapshot',
    }),
    role: 'primary',
    label: '主账号',
  };
  const secondaryConnection = {
    ...mt5ConnectionFromPayload(raw.secondaryAccount, raw.secondarySnapshot, {
      scopeLabel: 'Live16',
      refreshEndpoint: '/api/mt5-readonly-secondary/snapshot',
    }),
    role: 'secondary',
    label: '第二账号',
    enabled: secondaryEnabled,
    optional: !secondaryEnabled,
  };
  if (!secondaryEnabled) {
    Object.assign(secondaryConnection, {
      ok: true,
      status: 'DISABLED',
      connected: false,
      brokerConnected: false,
      accountAuthorized: false,
      writerFresh: true,
      quoteFresh: false,
      marketSession: 'MARKET_UNKNOWN',
      tradingReady: false,
      hostProcessMissing: false,
      hostProcessLine: '第二账号未启用（可选）',
      snapshotFresh: true,
      freshness: secondaryFreshness,
      error: '',
    });
  }
  const positions = [
    ...annotateLedgerRows(primaryPositionsRaw, primaryConnection, {
      role: 'primary',
      label: '主账号',
    }),
    ...annotateLedgerRows(secondaryPositionsRaw, secondaryConnection, {
      role: 'secondary',
      label: '第二账号',
    }),
  ];
  const orders = [
    ...annotateLedgerRows(primaryOrdersRaw, primaryConnection, {
      role: 'primary',
      label: '主账号',
    }),
    ...annotateLedgerRows(secondaryOrdersRaw, secondaryConnection, {
      role: 'secondary',
      label: '第二账号',
    }),
  ];
  const closeHistory = annotateLedgerRows(primaryCloseHistoryRaw, primaryConnection, {
    role: 'primary',
    label: '主账号',
  });
  const tradeJournal = annotateLedgerRows(primaryTradeJournalRaw, primaryConnection, {
    role: 'primary',
    label: '主账号',
  });
  const secondaryCloseHistory = annotateLedgerRows(secondaryCloseHistoryRaw, secondaryConnection, {
    role: 'secondary',
    label: '第二账号',
  });
  const secondaryTradeJournal = annotateLedgerRows(secondaryTradeJournalRaw, secondaryConnection, {
    role: 'secondary',
    label: '第二账号',
  });
  const combinedCloseHistory = [...closeHistory, ...secondaryCloseHistory];
  const combinedTradeJournal = [...tradeJournal, ...secondaryTradeJournal];
  const accountConnections = secondaryEnabled
    ? [primaryConnection, secondaryConnection]
    : [primaryConnection];
  const accountSlots = [primaryConnection, secondaryConnection];
  const marketSession = accountConnections.some((connection) => connection.marketSession === 'MARKET_CLOSED')
    ? 'MARKET_CLOSED'
    : accountConnections.every((connection) => connection.marketSession === 'MARKET_OPEN')
      ? 'MARKET_OPEN'
      : 'MARKET_UNKNOWN';
  const allTradingReady = accountConnections.every((connection) => connection.tradingReady === true);

  const bridgeStatus = pick(
    { status, raw },
    ['status.status', 'status.bridge_status', 'status.connected', 'raw.status.ok'],
    present(raw.status) ? 'available' : 'missing',
  );

  return {
    latest,
    latestFreshness,
    latestDashboardStale: freshnessStale(latestFreshness || {}),
    latestFreshnessLine: freshnessLine(latestFreshness || {}),
    primaryMt5Freshness: primaryFreshness,
    secondaryMt5Freshness: secondaryFreshness,
    runtime,
    bridgeStatus,
    terminal: pick(
      { status, snapshot },
      ['status.terminal', 'status.terminal_name', 'snapshot.terminal'],
      '—',
    ),
    server: pick(
      { account, status, snapshot },
      ['account.server', 'account.trade_server', 'status.server', 'snapshot.server'],
      '—',
    ),
    login: pick({ account, snapshot }, ['account.login', 'account.account', 'snapshot.account.login'], '—'),
    balance: pick({ account, snapshot }, ['account.balance', 'snapshot.account.balance'], null),
    equity: pick({ account, snapshot }, ['account.equity', 'snapshot.account.equity'], null),
    margin: pick({ account, snapshot }, ['account.margin', 'snapshot.account.margin'], null),
    freeMargin: pick(
      { account, snapshot },
      [
        'account.free_margin',
        'account.margin_free',
        'account.marginFree',
        'snapshot.account.free_margin',
        'snapshot.account.marginFree',
      ],
      null,
    ),
    currency: pick({ account, snapshot }, ['account.currency', 'snapshot.account.currency'], 'USC'),
    positions,
    orders,
    symbols,
    closeHistory,
    tradeJournal,
    secondaryCloseHistory,
    secondaryTradeJournal,
    combinedCloseHistory,
    combinedTradeJournal,
    shadowSignals,
    shadowOutcomes,
    shadowCandidates,
    shadowCandidateOutcomes,
    dailyReview: raw.dailyReview || {},
    accountRegistry,
    accountLanes,
    spreadGate,
    usdDeploymentGate,
    researchStats: raw.researchStats || {},
    governanceAdvisor: raw.governanceAdvisor || {},
    usdJpyLiveLoop,
    evidenceOS,
    researchSummary,
    governanceSummary,
    accountProfiles,
    primaryConnection,
    secondaryConnection,
    secondaryEnabled,
    accountConnections,
    accountSlots,
    brokerConnected: primaryConnection.brokerConnected,
    accountAuthorized: primaryConnection.accountAuthorized,
    writerFresh: primaryConnection.writerFresh,
    quoteFresh: primaryConnection.quoteFresh,
    marketSession,
    tradingReady: allTradingReady,
    dualAccountAutoEnabled: allTradingReady,
    dualAccountEntryReady: allTradingReady,
    safety,
    readOnly: pick(
      { safety, status },
      ['safety.readOnly', 'safety.read_only', 'status.readOnly', 'status.read_only'],
      true,
    ),
    orderSendAllowed: pick({ safety }, ['safety.orderSendAllowed', 'safety.order_send_allowed'], false),
    closeAllowed: pick({ safety }, ['safety.closeAllowed', 'safety.close_allowed'], false),
    cancelAllowed: pick({ safety }, ['safety.cancelAllowed', 'safety.cancel_allowed'], false),
    credentialStorageAllowed: pick(
      { safety },
      ['safety.credentialStorageAllowed', 'safety.credential_storage_allowed'],
      false,
    ),
    livePresetMutationAllowed: pick(
      { safety },
      ['safety.livePresetMutationAllowed', 'safety.live_preset_mutation_allowed'],
      false,
    ),
    tradeStatus: pick(
      { runtime, snapshot, latest },
      ['runtime.tradeStatus', 'snapshot.tradeStatus', 'latest.tradeStatus'],
      '—',
    ),
    livePilotMode: pick({ runtime, latest }, ['runtime.livePilotMode', 'latest.livePilotMode'], false),
    tradeAllowed: pick({ runtime }, ['runtime.tradeAllowed', 'runtime.terminalTradeAllowed'], false),
    executionEnabled: pick({ runtime }, ['runtime.executionEnabled'], false),
    killSwitch: pick({ runtime }, ['runtime.pilotKillSwitch'], null),
    startupGuardActive: pick({ runtime }, ['runtime.pilotStartupEntryGuardActive'], null),
    rsiRoute: pick(
      { latest },
      ['latest.strategies.RSI_Reversal', 'latest.symbols.0.strategies.RSI_Reversal'],
      {},
    ),
    usdJpyRsiEntryDiagnostics: pick(
      { snapshot, latest },
      ['snapshot.usdJpyRsiEntryDiagnostics', 'latest.usdJpyRsiEntryDiagnostics'],
      {},
    ),
    strategies: pick({ latest }, ['latest.strategies', 'latest.symbols.0.strategies'], {}),
    eaTradeReady: allTradingReady,
  };
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSignedNumber(value, digits = 1) {
  const numeric = asNumber(value);
  if (numeric === null) return '—';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}`;
}

function formatPct(value, digits = 1) {
  const numeric = asNumber(value);
  if (numeric === null) return '—';
  return `${numeric.toFixed(digits)}%`;
}

function sideLabel(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('BUY') || text.includes('LONG')) return '做多';
  if (text.includes('SELL') || text.includes('SHORT')) return '做空';
  if (text.includes('NONE')) return '无方向';
  return humanizeStatus(value || '—');
}

function translateOutcome(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('LOSS')) return '亏损';
  if (text.includes('WIN') || text.includes('PROFIT')) return '盈利';
  if (text.includes('LONG_OPPORTUNITY')) return '多头机会';
  if (text.includes('SHORT_OPPORTUNITY')) return '空头机会';
  if (text.includes('OBSERVED')) return '观察';
  return humanizeStatus(value || '—');
}

function routeEnabled(snapshot, key) {
  const route = snapshot.strategies?.[key] || {};
  if (!route.enabled) return false;
  const status = String(route.status || route.runtimeLabel || route.state || '').toUpperCase();
  if (/DISABLED|PAUSED|AUTO_PAUSED|ROUTE_DISABLED/.test(status)) return false;
  return true;
}

function routeMode(snapshot, key) {
  const route = snapshot.strategies?.[key] || {};
  if (!routeEnabled(snapshot, key)) return '未运行';
  if (Number(route.riskMultiplier || 0) > 0) return '影子建议候选（只读）';
  if (
    route.candidate ||
    route.simulation ||
    /candidate|shadow|sim/i.test(String(route.state || route.reason || ''))
  ) {
    return '模拟候选';
  }
  return '只读观察';
}

export function buildMt5Metrics(snapshot) {
  const rsiEnabled = routeEnabled(snapshot, 'RSI_Reversal');
  const primary = snapshot.primaryConnection || snapshot;
  const secondary = snapshot.secondaryConnection || {};
  const secondaryEnabled = snapshot.secondaryEnabled !== false && !accountSlotDisabled(secondary);
  const primaryFreshness = present(primary.freshness) ? primary.freshness : snapshot.latestFreshness;
  const secondaryFreshness = present(secondary.freshness)
    ? secondary.freshness
    : snapshot.secondaryMt5Freshness;
  const primaryConnectionBlock = accountConnectionBlockState(primary);
  const secondaryConnectionBlock = accountConnectionBlockState(secondary);
  const primaryStale = freshnessStale(primaryFreshness || {});
  const primaryUnconfirmed = freshnessUnconfirmed(primaryFreshness || {});
  const secondaryStale = freshnessStale(secondaryFreshness || {});
  const secondaryUnconfirmed = freshnessUnconfirmed(secondaryFreshness || {});
  const primarySnapshotState = {
    blocked: primaryConnectionBlock.blocked && !primaryStale && !primaryUnconfirmed,
    stale: primaryStale,
    unconfirmed: primaryUnconfirmed,
    hint: primaryConnectionBlock.blocked
      ? `主账号：${primaryConnectionBlock.state}，当前净值不可确认。`
      : freshnessRecoveryHint(primaryFreshness || {}, ''),
  };
  const secondarySnapshotState = {
    blocked: secondaryConnectionBlock.blocked && !secondaryStale && !secondaryUnconfirmed,
    stale: secondaryStale,
    unconfirmed: secondaryUnconfirmed,
    hint: secondaryConnectionBlock.blocked
      ? `第二账号：${secondaryConnectionBlock.state}，当前净值不可确认。`
      : freshnessRecoveryHint(secondaryFreshness || {}, ''),
  };
  const primaryEquity = staleAwareAccountItem(
    '主账号净值',
    primary.equity ?? snapshot.equity,
    primary.currency ?? snapshot.currency,
    primarySnapshotState,
  );
  const secondaryEquity = staleAwareAccountItem(
    '第二账号净值',
    secondary.equity,
    secondary.currency,
    secondarySnapshotState,
  );
  const positionsCount = snapshot.positions.length;
  const combinedSnapshotState = {
    blocked: primarySnapshotState.blocked || (secondaryEnabled && secondarySnapshotState.blocked),
    stale: primarySnapshotState.stale || (secondaryEnabled && secondarySnapshotState.stale),
    unconfirmed: primarySnapshotState.unconfirmed || (secondaryEnabled && secondarySnapshotState.unconfirmed),
    hint: [primarySnapshotState.hint, secondaryEnabled ? secondarySnapshotState.hint : '']
      .filter(Boolean)
      .join('；'),
  };
  const positionsMetric =
    combinedSnapshotState.blocked || combinedSnapshotState.stale || combinedSnapshotState.unconfirmed
      ? {
          label: '当前持仓',
          value: combinedSnapshotState.blocked || combinedSnapshotState.stale ? '不可确认' : '待确认',
          status: combinedSnapshotState.blocked ? 'blocked' : 'warn',
          hint: [combinedSnapshotState.hint, `旧快照持仓 ${positionsCount} 笔，仅作历史参考`]
            .filter(Boolean)
            .join('；'),
        }
      : { label: '当前持仓', value: positionsCount, hint: 'MT5 只读快照' };
  return [
    {
      label: '主账号 EA',
      value: accountStatusLabel(primary),
      hint: `${maskAccountLogin(primary.login)} / ${humanizeStatus(primary.tradeStatus || snapshot.tradeStatus)}`,
    },
    ...(secondaryEnabled
      ? [
          {
            label: '第二账号 EA',
            value: accountStatusLabel(secondary),
            status: accountStatusTone(secondary),
            hint: `${maskAccountLogin(secondary.login)} / ${humanizeStatus(secondary.tradeStatus || '—')}`,
          },
        ]
      : []),
    {
      ...primaryEquity,
      hint: primaryEquity.hint || primary.server || snapshot.server,
    },
    ...(secondaryEnabled
      ? [
          {
            ...secondaryEquity,
            hint: secondaryEquity.hint || secondary.server || '等待第二账号快照',
          },
        ]
      : []),
    positionsMetric,
    {
      label: 'RSI Shadow 路线',
      value:
        combinedSnapshotState.blocked || combinedSnapshotState.stale || combinedSnapshotState.unconfirmed
          ? '不可用 / 已阻断'
          : snapshot.marketSession === 'MARKET_CLOSED'
            ? 'MARKET_CLOSED / 只读观察'
            : rsiEnabled
              ? '策略证据已加载'
              : '未开启',
      status:
        combinedSnapshotState.blocked || combinedSnapshotState.stale || combinedSnapshotState.unconfirmed
          ? 'blocked'
          : snapshot.marketSession === 'MARKET_CLOSED'
            ? 'warn'
            : rsiEnabled
              ? 'ok'
              : 'warn',
      hint:
        combinedSnapshotState.blocked || combinedSnapshotState.stale || combinedSnapshotState.unconfirmed
          ? combinedSnapshotState.hint
          : snapshot.rsiRoute?.reason || '只以后端当前路线证据为准。',
    },
  ];
}

function accountConnectionBlockState(account = {}) {
  if (accountSlotDisabled(account)) return { blocked: false, state: '' };
  if (account.connectionEvidenceKnown !== true) return { blocked: true, state: '连接证据未知' };
  if (account.processRunning !== true) {
    return {
      blocked: true,
      state: account.processRunning === false ? '终端进程未就绪' : '终端进程证据未知',
    };
  }
  if (account.brokerConnected !== true) return { blocked: true, state: 'Broker 未连接' };
  if (account.accountAuthorized !== true) return { blocked: true, state: '账号未授权' };
  if (account.writerFresh !== true) return { blocked: true, state: 'Writer 不新鲜' };
  if (account.readReady !== true) return { blocked: true, state: '只读连接未就绪' };
  return { blocked: false, state: '' };
}

export function buildMt5CoreMetrics(snapshot = {}) {
  const primary = snapshot.primaryConnection || snapshot;
  const secondary = snapshot.secondaryConnection || {};
  const primaryFreshness = present(primary.freshness) ? primary.freshness : snapshot.latestFreshness;
  const secondaryFreshness = secondary.freshness || snapshot.secondaryMt5Freshness;
  const primaryConnectionBlock = accountConnectionBlockState(primary);
  const secondaryConnectionBlock = accountConnectionBlockState(secondary);
  const primaryBlocked =
    primaryConnectionBlock.blocked ||
    freshnessStale(primaryFreshness || {}) ||
    freshnessUnconfirmed(primaryFreshness || {});
  const secondaryBlocked =
    snapshot.secondaryEnabled &&
    (secondaryConnectionBlock.blocked ||
      freshnessStale(secondaryFreshness || {}) ||
      freshnessUnconfirmed(secondaryFreshness || {}));
  const currentCountsTrusted = !primaryBlocked && !secondaryBlocked;
  const currentCountsHint = primaryConnectionBlock.blocked
    ? `主账号：${primaryConnectionBlock.state}，当前合计不可确认。`
    : secondaryConnectionBlock.blocked
      ? `第二账号：${secondaryConnectionBlock.state}，双账号持仓与挂单合计不可确认；主账号账户数值仍可单独复核。`
      : '快照过期或未确认，不能把旧数据当作当前状态。';
  const balance = staleAwareAccountItem(
    '余额',
    primary.balance ?? snapshot.balance,
    primary.currency ?? snapshot.currency,
    {
      blocked: primaryConnectionBlock.blocked,
      stale: freshnessStale(primaryFreshness || {}),
      unconfirmed: freshnessUnconfirmed(primaryFreshness || {}),
      hint: primaryConnectionBlock.blocked
        ? `主账号：${primaryConnectionBlock.state}，当前余额不可确认。`
        : freshnessRecoveryHint(primaryFreshness || {}, ''),
    },
  );
  const equity = buildMt5Metrics(snapshot).find((item) => item.label === '主账号净值') || {
    label: '净值',
    value: '不可确认',
    status: 'blocked',
  };
  const trustedAmount = (item, label) => ({
    ...item,
    label,
    value: item.value === '—' ? '不可确认' : item.value,
    status: item.value === '—' ? 'blocked' : item.status || 'ok',
  });

  return [
    trustedAmount(balance, '余额'),
    trustedAmount(equity, '净值'),
    {
      label: '持仓',
      value: currentCountsTrusted ? snapshot.positions?.length || 0 : '不可确认',
      status: currentCountsTrusted ? 'ok' : 'blocked',
      hint: currentCountsTrusted ? '只读当前持仓' : currentCountsHint,
    },
    {
      label: '挂单',
      value: currentCountsTrusted ? snapshot.orders?.length || 0 : '不可确认',
      status: currentCountsTrusted ? 'ok' : 'blocked',
      hint: currentCountsTrusted ? '只读当前挂单' : currentCountsHint,
    },
  ];
}

function accountRecoveryEndpoint(account = {}) {
  return account.role === 'secondary' ? '/api/mt5-readonly-secondary/snapshot' : '/api/mt5-readonly/snapshot';
}

function accountRecoveryLabel(account = {}) {
  const server = account.server ? ` / ${account.server}` : '';
  return `${account.label || (account.role === 'secondary' ? '第二账号' : '主账号')}${server}`;
}

function accountConnectionRecoveryStep(account = {}, state = '') {
  const scope = account.role === 'secondary' ? '第二账号' : '主账号';
  const endpoint = accountRecoveryEndpoint(account);
  if (state === '终端进程未就绪') {
    return `恢复${scope} terminal64/wine 进程与 EA dashboard writer，再刷新 ${endpoint}。`;
  }
  if (state === 'Writer 不新鲜') {
    return `恢复${scope} EA dashboard writer 持续刷新，再确认 readReady=true。`;
  }
  if (state === 'Broker 未连接' || state === '账号未授权') {
    return `恢复${scope} Broker 登录与授权，确认 readReady=true 后刷新 ${endpoint}。`;
  }
  return `补齐${scope} Broker、授权、writer、进程与 readReady 显式证据，再刷新 ${endpoint}。`;
}

function accountRecoveryRow(account = {}) {
  const freshness = account.freshness || {};
  if (accountSlotDisabled(account)) {
    return {
      account,
      status: 'warn',
      state: '未启用（可选）',
      processMissing: false,
      blocksCurrentState: false,
      endpoint: accountRecoveryEndpoint(account),
      evidenceLine: `${accountRecoveryLabel(account)}：未启用（可选），不参与 active readiness`,
      processLine: '第二账号终端与 writer 未启动（符合当前配置）',
      nextStep:
        freshness.nextActionZh ||
        '如需观察第二账号，先启动独立 Shadow / ReadOnly 终端与 writer；未启用期间主账号继续运行。',
    };
  }
  const processMissing = account.hostProcessMissing === true;
  const missing = freshnessMissing(freshness);
  const unavailable = freshnessUnavailable(freshness);
  const stale = freshnessStale(freshness);
  const unconfirmed = freshnessUnconfirmed(freshness);
  const connectionBlock = accountConnectionBlockState(account);
  const status =
    processMissing || missing || unavailable || stale || connectionBlock.blocked
      ? 'blocked'
      : unconfirmed
        ? 'warn'
        : 'ok';
  const state = processMissing
    ? 'writer 未运行'
    : missing
      ? '快照缺失'
      : unavailable
        ? '只读桥不可用'
        : stale
          ? '快照过期'
          : connectionBlock.blocked
            ? connectionBlock.state
            : unconfirmed
              ? '快照待确认'
              : freshness.fresh
                ? '新鲜'
                : '待同步';
  const nextStep = processMissing
    ? [
        account.hostProcessLine || '未检测到 terminal64/wine 进程',
        freshnessRecoveryHint(
          freshness,
          '恢复对应 terminal64/wine 与 EA dashboard writer，再判断账号、持仓和只读观察状态。',
        ),
      ]
        .filter(Boolean)
        .join('；')
    : missing || unavailable || stale || unconfirmed
      ? freshnessRecoveryHint(freshness, '等待只读桥返回 MT5 dashboard 新鲜度证据，再判断当前账号状态。')
      : connectionBlock.blocked
        ? accountConnectionRecoveryStep(account, connectionBlock.state)
        : freshnessRecoveryHint(freshness, '等待只读桥返回 MT5 dashboard 新鲜度证据，再判断当前账号状态。');
  return {
    account,
    status,
    state,
    processMissing,
    connectionBlocked: connectionBlock.blocked,
    blocksCurrentState: processMissing || freshnessBlocksCurrentState(freshness) || connectionBlock.blocked,
    endpoint: accountRecoveryEndpoint(account),
    evidenceLine: `${accountRecoveryLabel(account)}：${state}，${freshnessAgeLine(freshness)}`,
    processLine:
      account.hostProcessLine || (processMissing ? '未检测到 terminal64/wine 进程' : '进程状态待确认'),
    nextStep,
  };
}

export function buildMt5SnapshotRecoveryRows(snapshot = {}) {
  const accounts = (snapshot.accountConnections || snapshot.accountSlots || []).filter(
    (account) => !accountSlotDisabled(account),
  );
  return accounts.map((account) => {
    const recovery = accountRecoveryRow(account);
    return {
      账户: accountRecoveryLabel(account),
      端点: recovery.endpoint,
      状态: recovery.state,
      打开页面: '/vue/?workspace=mt5',
      数据年龄: recovery.evidenceLine,
      进程诊断: recovery.processLine,
      可信范围: recovery.blocksCurrentState
        ? '当前净值、余额、持仓、挂单和 EA 权限不可确认；旧快照只作历史参考。'
        : '可把只读桥快照作为当前账号状态。',
      验收标准:
        '对应只读桥 fresh=true、terminal64/wine 进程已检测，且 Broker 已连接、账号已授权、readReady=true。',
      下一步: recovery.nextStep,
    };
  });
}

export function buildMt5SnapshotRootCauseBanner(snapshot = {}) {
  const activeRows = (snapshot.accountConnections || []).map(accountRecoveryRow);
  const displayRows = activeRows;
  const primaryRow = activeRows.find((row) => row.account.role === 'primary') || activeRows[0];
  const secondaryRow = activeRows.find((row) => row.account.role === 'secondary');
  const primaryBlocked = primaryRow?.blocksCurrentState === true;
  const secondaryBlocked = secondaryRow?.blocksCurrentState === true;
  const blockers = activeRows.filter((row) => row.blocksCurrentState);
  const partiallyAvailable = !primaryBlocked && secondaryBlocked;
  const secondaryDisconnected = ['Broker 未连接', '账号未授权'].includes(secondaryRow?.state);
  const status = primaryBlocked ? 'blocked' : partiallyAvailable ? 'warn' : 'ok';
  const label = primaryBlocked
    ? primaryRow?.processMissing
      ? 'MT5/EA writer 未运行'
      : '主账号当前状态已阻断'
    : partiallyAvailable
      ? secondaryDisconnected
        ? '主账号可复核 · 第二账号未连接'
        : `主账号可复核 · 第二账号：${secondaryRow?.state || '状态待恢复'}`
      : '实时快照新鲜';
  const rootCauseLine = primaryBlocked
    ? blockers.map((row) => `${accountRecoveryLabel(row.account)}：${row.state}`).join(' / ')
    : partiallyAvailable
      ? `主账号当前只读状态可复核；第二账号：${secondaryRow.state}；该账号当前状态不可用。`
      : snapshot.secondaryEnabled
        ? 'Live12 与 Live16 当前快照、Broker 连接及账号授权均可用于只读复核。'
        : '主账号当前快照、Broker 连接及账号授权均可用于只读复核。';
  const evidenceLine = displayRows.length
    ? displayRows.map((row) => row.evidenceLine).join('；')
    : snapshot.secondaryEnabled
      ? '等待 Live12 / Live16 freshness 证据'
      : '等待主账号 freshness 证据';
  const nextAction = primaryBlocked
    ? primaryRow?.nextStep || blockers[0]?.nextStep
    : partiallyAvailable
      ? `${secondaryRow.nextStep} 主账号继续保持 Shadow / ReadOnly 观察。`
      : snapshot.secondaryEnabled
        ? '保持 Live12/Live16 MT5 终端和 EA dashboard writer 正常刷新，前端继续只读观察。'
        : '保持当前主账号 MT5 终端和 EA dashboard writer 正常刷新，前端继续只读观察。';
  return {
    status,
    label,
    title: primaryBlocked
      ? 'MT5 当前账号快照不能当作实时状态'
      : partiallyAvailable
        ? '主账号可用于只读复核，第二账号当前不可确认'
        : 'MT5 当前账号快照可用于只读观察',
    rootCauseLine,
    evidenceLine,
    blockedLine: primaryBlocked
      ? '净值、余额、当前持仓、挂单、后端权限和执行准备度。'
      : partiallyAvailable
        ? '仅第二账号的当前净值、余额、持仓、挂单、权限及双账号合计；主账号单独状态不受影响。'
        : '无当前账号状态阻断。',
    usableLine: partiallyAvailable
      ? '主账号余额、净值与其只读状态可继续复核；历史交易流水、shadow 账本、Evidence OS、RSI 诊断和研究证据仍可使用。'
      : '历史交易流水、close history、shadow 账本、Evidence OS、RSI 诊断和研究证据仍可只读复核。',
    nextAction,
  };
}

function mt5CurrentEvidenceTrusted(snapshot = {}) {
  const activeAccounts =
    Array.isArray(snapshot.accountConnections) && snapshot.accountConnections.length
      ? snapshot.accountConnections
      : [snapshot.primaryConnection || snapshot];
  return activeAccounts.every(
    (account) =>
      account.ok === true &&
      account.snapshotFresh === true &&
      account.brokerConnected === true &&
      account.accountAuthorized === true &&
      account.writerFresh === true &&
      account.freshness?.fresh === true &&
      !freshnessBlocksCurrentState(account.freshness || {}),
  );
}

export function buildSafetyItems(snapshot) {
  const rsiEnabled = routeEnabled(snapshot, 'RSI_Reversal');
  const currentEvidenceTrusted = mt5CurrentEvidenceTrusted(snapshot);
  return [
    {
      label: '前端数据桥',
      value: snapshot.readOnly ? '只读观察' : '状态待确认',
      status: boolLike(snapshot.readOnly, 'ok', 'warn'),
    },
    {
      label: '执行边界',
      value: currentEvidenceTrusted
        ? snapshot.marketSession === 'MARKET_CLOSED'
          ? 'MARKET_CLOSED / Shadow 观察'
          : 'Shadow / ReadOnly（无执行通道）'
        : '不可用 / 已阻断',
      status: currentEvidenceTrusted ? 'warn' : 'blocked',
    },
    {
      label: 'RSI Shadow 路线',
      value: currentEvidenceTrusted
        ? snapshot.marketSession === 'MARKET_CLOSED'
          ? 'MARKET_CLOSED / 只读观察'
          : rsiEnabled
            ? '策略证据已加载'
            : '未开启'
        : '不可用 / 已阻断',
      status: currentEvidenceTrusted
        ? snapshot.marketSession === 'MARKET_CLOSED'
          ? 'warn'
          : rsiEnabled
            ? 'ok'
            : 'warn'
        : 'blocked',
    },
    {
      label: '熔断保护',
      value: !currentEvidenceTrusted
        ? '不可用 / 已阻断'
        : snapshot.killSwitch === true
          ? '熔断中'
          : snapshot.killSwitch === false
            ? '未触发'
            : '状态未知 / 已阻断',
      status:
        !currentEvidenceTrusted || snapshot.killSwitch !== false
          ? snapshot.killSwitch === true
            ? 'error'
            : 'blocked'
          : 'ok',
    },
    {
      label: '前端下单',
      value: snapshot.orderSendAllowed ? '允许' : '禁止',
      status: snapshot.orderSendAllowed ? 'error' : 'ok',
    },
    {
      label: '前端平仓',
      value: snapshot.closeAllowed ? '允许' : '禁止',
      status: snapshot.closeAllowed ? 'error' : 'ok',
    },
    {
      label: '前端撤单',
      value: snapshot.cancelAllowed ? '允许' : '禁止',
      status: snapshot.cancelAllowed ? 'error' : 'ok',
    },
    {
      label: '保存凭据',
      value: snapshot.credentialStorageAllowed ? '允许' : '禁止',
      status: snapshot.credentialStorageAllowed ? 'error' : 'ok',
    },
    {
      label: '修改执行配置',
      value: snapshot.livePresetMutationAllowed ? '允许' : '禁止',
      status: snapshot.livePresetMutationAllowed ? 'error' : 'ok',
    },
  ];
}

export function buildMt5SimulationItems(snapshot) {
  const summary = snapshot.dailyReview?.summary || {};
  const iteration = snapshot.dailyReview?.dailyIteration || {};
  const strategyQueue = rowsFromPayload(iteration.strategyIterationQueue);
  const evidenceQueue = rowsFromPayload(iteration.evidenceIterationQueue);
  const findings = rowsFromPayload(iteration.findings);
  const hasNoTradeFinding = findings.some((row) => row.code === 'PARAMLAB_NO_TRADE_TESTER_WINDOWS');
  const noTradeRetune = strategyQueue.find((row) => row?.type === 'PARAMLAB_NO_TRADE_RETUNE');
  const noTradePlanReady =
    Boolean(noTradeRetune?.iterationApplied) ||
    ['RETUNE_PLAN_READY_TESTER_ONLY', 'APPLIED_TESTER_ONLY', 'APPLIED_SHADOW_ONLY'].includes(
      String(noTradeRetune?.status || '').toUpperCase(),
    ) ||
    (Array.isArray(noTradeRetune?.routePlans) && noTradeRetune.routePlans.length > 0);
  const liveUniverse = usdJpyOnlyUniverseLabel(
    snapshot.researchSummary.liveUniverseLabel || snapshot.researchSummary.liveUniverse,
  );
  const shadowUniverse = usdJpyOnlyUniverseLabel(
    snapshot.researchSummary.shadowResearchUniverseLabel || snapshot.researchSummary.shadowResearchUniverse,
  );
  const queue = rowsFromPayload(snapshot.dailyReview?.actionQueue);
  const completed = rowsFromPayload(snapshot.dailyReview?.completedActionQueue);
  const queuedText = queue.length
    ? `${queue.length} 个任务等待 ${summary.nextTesterWindowLabel || '测试窗口'}`
    : completed.length
      ? `${completed.length} 个任务已完成，暂无新队列`
      : '暂无待跑任务';
  const chanlunInQueue = [...queue, ...completed].some((row) =>
    /chanlun|缠论|macd_td/i.test(
      String(row.candidateId || row.strategy || row.routeKey || row.summary || ''),
    ),
  );
  const chanlunSeenInRuntime = snapshot.governanceSummary.strategyVersionCount
    ? chanlunInQueue
      ? '已进入待办/回测队列'
      : '研究库已接入，尚未进入 MT5 模拟队列'
    : '未发现运行证据';

  return [
    {
      label: 'EA Shadow 观察 Universe',
      value: liveUniverse,
      hint: '只展示 EA Shadow 观察所覆盖的品种；当前没有执行通道。',
    },
    {
      label: '当前策略证据',
      value: !mt5CurrentEvidenceTrusted(snapshot)
        ? '不可用 / 已阻断'
        : routeEnabled(snapshot, 'RSI_Reversal')
          ? 'RSI 买入侧观察'
          : '未发现开启策略',
      hint: snapshot.rsiRoute?.reason || '只读展示 MT5 EA 守门证据。',
      status: !mt5CurrentEvidenceTrusted(snapshot)
        ? 'blocked'
        : routeEnabled(snapshot, 'RSI_Reversal')
          ? 'ok'
          : 'warn',
    },
    {
      label: '模拟Universe',
      value: shadowUniverse,
      hint: 'Shadow / candidate / GA 只研究，不能直接或间接创建执行通道。',
    },
    {
      label: '模拟规模',
      value: `${snapshot.shadowSignals.length || snapshot.governanceSummary.shadowRows || 0} 条模拟信号，${snapshot.shadowCandidates.length || snapshot.governanceSummary.candidateRows || 0} 条候选信号`,
      hint: `${snapshot.shadowCandidateOutcomes.length || snapshot.governanceSummary.candidateOutcomeRows || 0} 条候选后验；只做研究账本`,
    },
    {
      label: '今日待办',
      value: queue.length ? '等待测试窗口' : humanizeStatus(summary.todayTodoStatus || '—'),
      hint: queuedText,
      status: queue.length ? 'warn' : 'ok',
    },
    {
      label: '复盘迭代',
      value: noTradePlanReady
        ? '调参方案已生成'
        : hasNoTradeFinding
          ? '需要调参重跑'
          : summary.dailyIterationRequired
            ? '需要复核'
            : '暂无阻塞',
      hint: noTradePlanReady
        ? `${noTradeRetune?.recommendation || '下一轮 tester-only 参数方案已生成'}；等待测试窗口执行。`
        : hasNoTradeFinding
          ? `今日 tester 已解析但无成交；策略 ${strategyQueue.length} 项、证据 ${evidenceQueue.length} 项待迭代`
          : '只影响模拟和 tester，不修改执行 preset',
      status: noTradePlanReady ? 'ok' : hasNoTradeFinding || summary.dailyIterationRequired ? 'warn' : 'ok',
    },
    {
      label: '策略效果',
      value: `${snapshot.governanceSummary.paramLabResultParsed ?? 0} 份报告已解析`,
      hint: `${snapshot.governanceSummary.versionGatePromoteCandidates ?? 0} 个待晋级复核候选`,
    },
    {
      label: '缠论/MACD-TD',
      value: chanlunSeenInRuntime,
      hint: '目前不属于 EA 执行路线；需要先进入 Strategy JSON、回测、GA 和 Agent 治理门',
      status: chanlunInQueue ? 'warn' : 'locked',
    },
  ];
}

function bestOutcomeRows(rows, directionKey) {
  const byEvent = new Map();
  (rows || []).forEach((row, index) => {
    const eventId = pick(row, ['EventId', 'eventId', 'id'], `row-${index}`);
    const direction = String(pick(row, [directionKey], '') || '').toUpperCase();
    if (
      !direction.includes('BUY') &&
      !direction.includes('SELL') &&
      !direction.includes('LONG') &&
      !direction.includes('SHORT')
    ) {
      return;
    }
    const horizon = asNumber(pick(row, ['HorizonMinutes', 'horizonMinutes'], 0)) ?? 0;
    const score = Math.abs(horizon - 60);
    const current = byEvent.get(eventId);
    if (!current || score < current.score || (score === current.score && horizon > current.horizon)) {
      byEvent.set(eventId, { row, score, horizon, index });
    }
  });
  return [...byEvent.values()]
    .sort((left, right) => {
      const lt = rowTimeMs(left.row, ['OutcomeLabelTimeLocal', 'LabelTimeLocal', 'EventBarTime']);
      const rt = rowTimeMs(right.row, ['OutcomeLabelTimeLocal', 'LabelTimeLocal', 'EventBarTime']);
      if (lt !== null && rt !== null && lt !== rt) return rt - lt;
      return right.index - left.index;
    })
    .map((item) => item.row);
}

function outcomePips(row, directionKey) {
  const direction = String(pick(row, [directionKey], '') || '').toUpperCase();
  if (direction.includes('BUY') || direction.includes('LONG')) {
    return asNumber(pick(row, ['LongClosePips', 'longClosePips'], null));
  }
  if (direction.includes('SELL') || direction.includes('SHORT')) {
    return asNumber(pick(row, ['ShortClosePips', 'shortClosePips'], null));
  }
  return null;
}

function routeKey(row) {
  return pick(row, ['CandidateRoute', 'candidateRoute', 'Strategy', 'strategy'], '—');
}

function snapshotReferenceTimeMs(snapshot = {}) {
  const candidates = [
    snapshot.primaryConnection?.timestamp,
    snapshot.secondaryConnection?.timestamp,
    snapshot.runtime?.localTime,
    snapshot.runtime?.serverTime,
    snapshot.snapshot?.runtime?.localTime,
    snapshot.snapshot?.runtime?.serverTime,
    snapshot.latest?.generatedAtLocal,
    snapshot.latest?.generatedAt,
    snapshot.latest?.timestamp,
  ];
  for (const value of candidates) {
    const parsed = parseMt5TimeMs(value);
    if (parsed !== null) return parsed;
  }
  return Date.now();
}

function freshShadowSignalRows(snapshot = {}) {
  const referenceTimeMs = snapshotReferenceTimeMs(snapshot);
  const minTimeMs = referenceTimeMs - SHADOW_SIGNAL_FRESH_WINDOW_MS;
  const maxFutureTimeMs = referenceTimeMs + 6 * 60 * 60 * 1000;
  return focusSymbolRows(snapshot.shadowSignals).filter((row) => {
    const timeMs = rowTimeMs(row, ['LabelTimeLocal', 'EventBarTime']);
    return timeMs !== null && timeMs >= minTimeMs && timeMs <= maxFutureTimeMs;
  });
}

export function buildMt5ShadowSummary(snapshot) {
  const candidateRows = bestOutcomeRows(
    focusSymbolRows(snapshot.shadowCandidateOutcomes),
    'CandidateDirection',
  );
  const pips = candidateRows
    .map((row) => outcomePips(row, 'CandidateDirection'))
    .filter((value) => value !== null);
  const wins = pips.filter((value) => value > 0);
  const losses = pips.filter((value) => value < 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const netPips = pips.reduce((sum, value) => sum + value, 0);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null;
  const winRate = pips.length ? (wins.length / pips.length) * 100 : null;
  const byRoute = new Map();
  candidateRows.forEach((row) => {
    const key = routeKey(row);
    const value = outcomePips(row, 'CandidateDirection') ?? 0;
    const bucket = byRoute.get(key) || { count: 0, netPips: 0, wins: 0 };
    bucket.count += 1;
    bucket.netPips += value;
    if (value > 0) bucket.wins += 1;
    byRoute.set(key, bucket);
  });
  const blockers = new Map();
  freshShadowSignalRows(snapshot).forEach((row) => {
    const blocker = humanizeStatus(
      pick(row, ['Blocker', 'blocker', 'SignalStatus', 'signalStatus'], '未分类'),
    );
    blockers.set(blocker, (blockers.get(blocker) || 0) + 1);
  });
  const topRoute = [...byRoute.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const topBlocker = [...blockers.entries()].sort((a, b) => b[1] - a[1])[0];
  const estimatedUsc = netPips * 0.1;
  return {
    candidateRows,
    pips,
    byRoute,
    blockers,
    metrics: [
      {
        label: '模拟候选样本',
        value: `${candidateRows.length} 笔`,
        hint: '按 60 分钟后验去重，不是真实成交',
      },
      {
        label: '模拟点数净值',
        value: `${formatSignedNumber(netPips, 1)} pips`,
        hint: `0.01 手粗略等价 ${formatSignedNumber(estimatedUsc, 2)} USC`,
      },
      {
        label: '模拟胜率',
        value: formatPct(winRate),
        hint: `${wins.length} 赢 / ${losses.length} 亏`,
      },
      {
        label: '模拟PF',
        value: profitFactor === Infinity ? '∞' : formatSignedNumber(profitFactor, 2).replace(/^\+/, ''),
        hint: '候选信号后验粗算',
      },
      {
        label: '主要路线',
        value: topRoute ? topRoute[0] : '—',
        hint: topRoute
          ? `${topRoute[1].count} 笔 / ${formatSignedNumber(topRoute[1].netPips, 1)} pips`
          : '暂无候选',
      },
      {
        label: '主要阻断',
        value: topBlocker ? topBlocker[0] : '—',
        hint: topBlocker ? `${topBlocker[1]} 条模拟信号` : '暂无阻断记录',
      },
    ],
  };
}

export function buildMt5ShadowEquityRows(snapshot) {
  const rows = bestOutcomeRows(
    focusSymbolRows(snapshot.shadowCandidateOutcomes),
    'CandidateDirection',
  ).reverse();
  let equity = 0;
  return rows
    .map((row) => {
      const pips = outcomePips(row, 'CandidateDirection') ?? 0;
      equity += pips;
      return {
        时间: pick(row, ['OutcomeLabelTimeLocal', 'LabelTimeLocal', 'EventBarTime'], '—'),
        品种: pick(row, ['Symbol', 'symbol'], '—'),
        路线: routeKey(row),
        方向: sideLabel(pick(row, ['CandidateDirection'], '—')),
        后验点数: formatSignedNumber(pips, 1),
        模拟净值: formatSignedNumber(equity, 1),
      };
    })
    .reverse();
}

export function buildMt5ShadowTradeRows(snapshot) {
  return bestOutcomeRows(focusSymbolRows(snapshot.shadowCandidateOutcomes), 'CandidateDirection')
    .slice(0, 60)
    .map((row) => {
      const pips = outcomePips(row, 'CandidateDirection');
      return {
        时间: pick(row, ['OutcomeLabelTimeLocal', 'LabelTimeLocal', 'EventBarTime'], '—'),
        品种: pick(row, ['Symbol', 'symbol'], '—'),
        路线: routeKey(row),
        方向: sideLabel(pick(row, ['CandidateDirection'], '—')),
        后验: translateOutcome(pick(row, ['DirectionalOutcome', 'BestOpportunity'], '—')),
        点数盈亏: formatSignedNumber(pips, 1),
        价格: pick(row, ['ReferencePrice', 'referencePrice'], '—'),
      };
    });
}

export function buildMt5ShadowBlockerRows(snapshot) {
  const counts = new Map();
  freshShadowSignalRows(snapshot).forEach((row) => {
    const blocker = humanizeStatus(
      pick(row, ['Blocker', 'blocker', 'SignalStatus', 'signalStatus'], '未分类'),
    );
    const key = `${blocker}||${pick(row, ['Strategy', 'strategy'], '—')}`;
    const bucket = counts.get(key) || {
      阻断原因: blocker,
      策略: pick(row, ['Strategy', 'strategy'], '—'),
      次数: 0,
      最近时间: pick(row, ['LabelTimeLocal', 'EventBarTime'], '—'),
    };
    bucket.次数 += 1;
    const current = rowTimeMs({ value: bucket.最近时间 }, ['value']) || 0;
    const next = rowTimeMs(row, ['LabelTimeLocal', 'EventBarTime']) || 0;
    if (next > current) bucket.最近时间 = pick(row, ['LabelTimeLocal', 'EventBarTime'], bucket.最近时间);
    counts.set(key, bucket);
  });
  return [...counts.values()].sort((a, b) => b.次数 - a.次数).slice(0, 20);
}

export function buildMt5RouteModeRows(snapshot) {
  return ['MA_Cross', 'RSI_Reversal', 'BB_Triple', 'MACD_Divergence', 'SR_Breakout'].map((key) => {
    const route = snapshot.strategies?.[key] || {};
    return {
      路线: key,
      当前位置: routeMode(snapshot, key),
      影子候选: Number(route.riskMultiplier || 0) > 0 ? '是（只读建议）' : '否',
      说明: humanizeStatus(route.reason || route.state || route.blocker || '等待信号'),
    };
  });
}

export function buildUsdJpyLiveLoopItems(snapshot) {
  const loop = snapshot.usdJpyLiveLoop || {};
  const status = loop.status || loop.latest || loop;
  if (snapshot.marketSession === 'MARKET_CLOSED') {
    return [
      {
        label: 'USDJPY Shadow Advisory',
        value: 'MARKET_CLOSED / 外汇休市',
        status: 'warn',
        hint: 'Writer 可继续刷新，但休市报价静止；不据此判断账号掉线。',
      },
      {
        label: 'Shadow 候选策略',
        value: '休市，只读证据保留',
        status: 'warn',
        hint: '开市并收到新 tick 后再复核策略信号。',
      },
      {
        label: '建议策略仓位',
        value: 'MARKET_CLOSED / 不评估',
        status: 'warn',
        hint: '休市期间不生成新的影子仓位建议；这是市场时段状态，不是系统故障。',
      },
      {
        label: '当前守门',
        value: 'MARKET_CLOSED',
        status: 'warn',
        hint: '这是市场时段状态，不是点差硬阻断，也不是账号连接失败。',
      },
      {
        label: '影子观察状态',
        value: '休市待新报价',
        status: 'warn',
        hint: 'Shadow / ReadOnly；不会触发执行。',
      },
      {
        label: '影子第一名',
        value: '保留历史研究证据',
        status: 'warn',
        hint: '休市期间不产生新的影子建议结论。',
      },
    ];
  }
  const topLive = firstNonEmptyObject(
    status.topAdvisoryPolicy,
    status.topShadowPolicy,
    status.topLiveEligiblePolicy,
    status.topPolicy,
    status.liveRecoveryCandidate,
    status.policy?.topAdvisoryPolicy,
    status.policy?.topShadowPolicy,
    status.policy?.topLiveEligiblePolicy,
    status.policy?.topPolicy,
    status.policy?.liveRecoveryCandidate,
  );
  const topShadow = status.topShadowPolicy || {};
  const dryRun = status.dryRunDecision || status.eaDryRunDecision || status.dryRun || {};
  const blockers = rowsFromPayload(status.blockers || status.primaryBlockers || status.mainBlockers);
  const reasons = reasonTextsFrom(
    topLive.reasons,
    status.topAdvisoryPolicy?.reasons,
    status.topShadowPolicy?.reasons,
    status.topPolicy?.reasons,
    status.liveRecoveryCandidate?.reasons,
    status.policy?.topPolicy?.reasons,
    status.policy?.liveRecoveryCandidate?.reasons,
    dryRun.reasons,
    status.reasons,
    status.nextActions,
  );
  const state = status.state || status.status || status.overallState || '等待同步';
  const stateZh = liveLoopStateLabel(state, status.stateZh || status.conclusionZh);
  const stateUpper = String(state || '').toUpperCase();
  const isReadyState = liveLoopAdvisoryReady(stateUpper, status);
  const hasAdvisoryPolicy = Boolean(topLive.strategy && topLive.entryMode && topLive.entryMode !== 'BLOCKED');
  const shouldSurfaceReasons = !isReadyState || status.policyReady === false || topLive.allowed === false;
  const blockerTexts = blockers.map(reasonText).filter(Boolean);
  const hardBlockerTexts = blockerTexts.filter(isBlockingReason);
  const explicitBlockerTexts = [status.primaryBlocker, status.mainBlocker].map(reasonText).filter(Boolean);
  const hardExplicitBlockerText = explicitBlockerTexts.find(isBlockingReason) || '';
  const liveStrategy = topLive.strategy || topLive.route || topLive.routeKey || '—';
  const liveDirection = directionZh(topLive.direction || topLive.side || topLive.action);
  const entryMode = entryModeZh(topLive.entryMode || topLive.mode || topLive.decision);
  const recommendedLot = topLive.recommendedLot ?? topLive.lot ?? status.recommendedLot;
  const maxLot = topLive.maxLot ?? status.maxLot ?? status.autoMaxLot;
  const newsBlocker = newsGateBlockerText(
    topLive.newsGate,
    status.topAdvisoryPolicy?.newsGate,
    status.topShadowPolicy?.newsGate,
    status.topPolicy?.newsGate,
    status.liveRecoveryCandidate?.newsGate,
    status.policy?.topPolicy?.newsGate,
    status.policy?.liveRecoveryCandidate?.newsGate,
    status.newsGate,
    status.policy?.newsGate,
  );
  const blockingReasons = reasons.filter(isBlockingReason);
  const eaDiagnosticBlocker = rsiDiagnosticBlockerText(snapshot.usdJpyRsiEntryDiagnostics);
  const derivedBlockerText =
    newsBlocker ||
    (blockingReasons.length ? blockingReasons.slice(0, 2).join('；') : '') ||
    eaDiagnosticBlocker ||
    (shouldSurfaceReasons ? humanizeStatus(topLive.entryStrictness || state || 'POLICY_BLOCKED') : '');
  const blockerText = hardBlockerTexts.length
    ? hardBlockerTexts.slice(0, 2).join('；')
    : hardExplicitBlockerText ||
      derivedBlockerText ||
      explicitBlockerTexts.find(Boolean) ||
      (blockerTexts.length ? blockerTexts.slice(0, 2).join('；') : '') ||
      '无；等待新鲜行情与策略条件生成影子观察/建议，系统不会执行交易';
  const reasonSummary = newsBlocker
    ? newsBlocker
    : blockingReasons.length
      ? blockingReasons.slice(0, 2).join('；')
      : reasons.length
        ? reasons.slice(0, 2).join('；')
        : topLive.reason ||
          status.summary ||
          '页面、Telegram 和 EA 影子观察统一读取 Shadow Advisory（兼容 Live Loop）；不会触发交易。';
  const dryRunDecision = dryRun.decisionZh || dryRun.decision || status.dryRunStateZh;
  const currentEvidenceTrusted = mt5CurrentEvidenceTrusted(snapshot);

  return [
    {
      label: 'USDJPY Shadow Advisory',
      value: stateZh,
      status: liveLoopStatusTone(state, status),
      hint:
        status.advisoryRouteZh ||
        status.singleSourceOfTruth ||
        'Shadow advisory only；executionLaneExists=false。',
    },
    {
      label: 'Shadow 候选策略',
      value: currentEvidenceTrusted ? `${liveStrategy}｜${liveDirection}｜${entryMode}` : '不可用 / 已阻断',
      status: currentEvidenceTrusted ? (hasAdvisoryPolicy ? 'ok' : 'warn') : 'blocked',
      hint: currentEvidenceTrusted
        ? reasonSummary
        : `历史策略证据：${liveStrategy}｜${liveDirection}｜${entryMode}；原因：${reasonSummary}；当前账号快照不可用。`,
    },
    {
      label: '建议策略仓位',
      value: currentEvidenceTrusted
        ? `${formatLot(recommendedLot)} / 最大 ${formatLot(maxLot)}`
        : '不可用 / 已阻断',
      status: currentEvidenceTrusted ? (recommendedLot ? 'ok' : 'warn') : 'blocked',
      hint: currentEvidenceTrusted
        ? '仅作 Shadow / ReadOnly 容量研究；前端不会下单。'
        : `历史仓位证据：建议 ${formatLot(recommendedLot)} / 最大 ${formatLot(maxLot)}；不得作为当前容量。`,
    },
    {
      label: '主阻断原因',
      value: blockerText,
      status: hardBlockerTexts.length || hardExplicitBlockerText || shouldSurfaceReasons ? 'warn' : 'ok',
      hint: '无阻断只代表策略证据通过，不代表执行授权。',
    },
    {
      label: '影子观察状态',
      value: dryRunDecision || '等待 EA 影子观察同步',
      status: dryRunDecisionTone(dryRunDecision),
      hint:
        dryRun.reason ||
        dryRun.summary ||
        (Array.isArray(dryRun.reasons) && dryRun.reasons.length
          ? dryRun.reasons.slice(0, 2).join('；')
          : '仅记录 EA 看到的影子政策与建议，不会向 broker 发送 mutation。'),
    },
    {
      label: '影子第一名',
      value: topShadow.strategy
        ? `${topShadow.strategy}｜${directionZh(topShadow.direction)}｜${entryModeZh(topShadow.entryMode)}`
        : '暂无影子第一名',
      hint: '影子第一名只做研究，不会触发任何 broker 执行。',
    },
  ];
}

export function buildMt5EvidenceOsLiteItems(snapshot) {
  const evidenceOS = snapshot.evidenceOS || {};
  const parity = evidenceOS.parity || {};
  const deepParity = parity.deepParity || {};
  const evidenceSync = parity.evidenceSync || deepParity.evidenceSync || evidenceOS.evidenceSync || {};
  const executionFeedback = evidenceOS.executionFeedback || {};
  const executionMetrics = executionFeedback.metrics || {};
  const promotionGate = executionFeedback.promotionGate || evidenceOS.promotionGate || {};
  const fieldCompleteness = executionFeedback.fieldCompleteness || {};
  const caseMemory = evidenceOS.caseMemory || {};
  const caseMemoryToGA = caseMemory.caseMemoryToGA || evidenceOS.caseMemoryToGA || {};
  const gaSeedHints = rowsFromPayload(
    caseMemory.gaSeedHints || caseMemoryToGA.gaSeedHints || evidenceOS.gaSeedHints,
  );
  const blockers = rowsFromPayload(
    promotionGate.blockers || executionFeedback.blockers || evidenceOS.executionBlockers,
  );
  const warnings = rowsFromPayload(
    promotionGate.warnings || executionFeedback.warnings || evidenceOS.executionWarnings,
  );
  const cases = rowsFromPayload(caseMemory.cases || caseMemory.items || caseMemory.ledger);
  const topCase = gaSeedHints[0] || caseMemory.topCase || cases[0] || {};
  const topHint = topCase.mutationHint || topCase.nextMutationHint || caseMemoryToGA.topMutationHint;
  const gateStatus =
    promotionGate.status || promotionGate.decision || executionFeedback.status || 'WAITING_FEEDBACK';
  const gateStatusUpper = String(gateStatus || '').toUpperCase();
  const hasExecutionBlocker =
    blockers.length > 0 ||
    gateStatusUpper.includes('BLOCK') ||
    gateStatusUpper.includes('FAIL') ||
    gateStatusUpper.includes('STOP');
  const casePriority = String(topCase.priority || topCase.casePriority || '').toUpperCase();
  const caseType = String(topCase.caseType || topCase.type || '').toUpperCase();
  const caseNeedsOperatorAttention =
    hasExecutionBlocker ||
    casePriority === 'HIGH' ||
    caseType.includes('POLICY_MISMATCH') ||
    caseType.includes('EXECUTION');
  const gateReason =
    promotionGate.reasonZh ||
    promotionGate.reason ||
    executionFeedback.reasonZh ||
    '等待 EA Shadow 评估、历史兼容反馈，或等待 Evidence OS 刷新。';
  const blockerText = blockers.length
    ? blockers
        .slice(0, 2)
        .map((row) => row.reasonZh || row.reason || row.code || row.label || humanizeStatus(row))
        .join('；')
    : warnings.length
      ? warnings
          .slice(0, 2)
          .map((row) => row.reasonZh || row.reason || row.code || row.label || humanizeStatus(row))
          .join('；')
      : '未发现影子 / 历史反馈证据阻断。';
  const caseLabel =
    topCase.caseId ||
    topCase.id ||
    topCase.typeZh ||
    humanizeStatus(topCase.type || caseMemory.topCaseType || '等待 Case');
  const caseReason =
    topCase.reasonZh ||
    topCase.rootCauseZh ||
    topCase.rootCause ||
    topCase.reason ||
    caseMemoryToGA.nextActionZh ||
    '等待 Case Memory 把影子或历史反馈异常转成下一代 GA seed hint。';
  const hintCount = caseMemoryToGA.queuedHintCount ?? caseMemoryToGA.queuedForGA ?? gaSeedHints.length;
  const nextFix = mutationHintZh(topHint);
  const parityStatus = deepParity.status || parity.status || 'MISSING';
  const parityMismatches = rowsFromPayload(deepParity.hardMismatches);
  const demotedOutOfScopeSignal = deepParity.demotedOutOfScopeSignal || {};
  const isDemotedOutOfScopeSignal = demotedOutOfScopeSignal.demoted === true;
  const parityMissing = rowsFromPayload(deepParity.missingOptionalFields);
  const evidenceSyncSummary = evidenceSyncZh(evidenceSync);
  const parityHintBase = isDemotedOutOfScopeSignal
    ? demotedOutOfScopeSignal.reasonZh ||
      deepParity.reasonZh ||
      'EA 当前看到已降级的反向 RSI 信号；当前周期不作为 LONG 晋级证据。'
    : parityMismatches.length
      ? `硬差异：${parityMismatches.slice(0, 2).join('；')}`
      : parityMissing.length
        ? `缺字段：${parityMissing.slice(0, 2).join('；')}；缺字段只做审计提醒。`
        : deepParity.reasonZh ||
          parity.reasonZh ||
          'Strategy JSON / Python Replay / MQL5 EA 三方证据一致或等待同步。';
  const parityHint = `${parityHintBase}；${evidenceSyncSummary.detail}`;

  return [
    {
      label: '三方一致性',
      value: `${isDemotedOutOfScopeSignal ? '反向信号已降级' : parityGateZh(parityStatus)} / ${evidenceSyncSummary.label}`,
      status:
        evidenceSyncSummary.status === 'error'
          ? 'error'
          : isDemotedOutOfScopeSignal
            ? 'warn'
            : evidenceGateTone(parityStatus),
      hint: parityHint,
    },
    {
      label: '影子 / 历史反馈可信度门',
      value: executionGateZh(gateStatus),
      status: evidenceGateTone(gateStatus),
      hint: gateReason,
    },
    {
      label: 'EA 字段契约',
      value: fieldContractZh(fieldCompleteness.status),
      status: evidenceGateTone(fieldCompleteness.status || 'WAITING_FEEDBACK'),
      hint:
        fieldCompleteness.reasonZh ||
        `覆盖率 ${formatDiagnosticNumber(fieldCompleteness.fieldCoveragePct, 0)}%，审计样本 ${
          fieldCompleteness.auditedRows ?? 0
        } 条；等待 EA 同步 policyId / intentId / fill / slippage / latency / R 倍数字段。`,
    },
    {
      label: '反馈阻断 / 警告',
      value: blockerText,
      status: blockers.length ? 'error' : warnings.length ? 'warn' : 'ok',
      hint: `拒单 ${executionMetrics.rejectCount ?? 0}；滑点 ${formatDiagnosticNumber(
        executionMetrics.avgAbsSlippagePips,
      )} pips；延迟 ${formatDiagnosticNumber(executionMetrics.avgLatencyMs, 0)} ms。`,
    },
    {
      label: '当前最大 Case',
      value: caseLabel,
      status: present(topCase) ? (caseNeedsOperatorAttention ? 'warn' : 'ok') : 'unknown',
      hint: caseReason,
    },
    {
      label: '下一代 GA 修复方向',
      value: nextFix,
      status: hintCount ? (caseNeedsOperatorAttention ? 'warn' : 'ok') : 'unknown',
      hint: `Case → GA seed hint ${hintCount || 0} 条；这里只显示看盘摘要，完整过程在 Evolution 面板。`,
    },
  ];
}

export function buildMt5ExecutionFeedbackRows(snapshot) {
  const evidenceOS = snapshot.evidenceOS || {};
  const executionFeedback = evidenceOS.executionFeedback || {};
  const rows = rowsFromPayload(
    executionFeedback.recentFeedback ||
      executionFeedback.rows ||
      evidenceOS.recentFeedback ||
      evidenceOS.executionFeedbackRows,
  );
  if (!rows.length) {
    return [
      {
        时间: '等待 EA 同步',
        策略: 'RSI_Reversal',
        事件: '等待反馈',
        预期价: '—',
        成交价: '—',
        滑点: '—',
        延迟: '—',
        点差: '—',
        出场: '—',
        profitR: '—',
        mfeR: '—',
        maeR: '—',
        结论: executionFeedback?.promotionGate?.reasonZh || '等待 Shadow 评估或历史兼容反馈。',
      },
    ];
  }
  return rows.slice(0, 30).map((row) => ({
    时间: row.fillTime || row.orderSendTime || row.entrySignalTime || row.createdAt || '—',
    策略: row.strategyId || 'RSI_Reversal',
    事件: humanizeStatus(row.eventType || row.source || 'OBSERVED'),
    预期价: formatFeedbackNumber(row, 'expectedPrice', 3),
    成交价: formatFeedbackNumber(row, 'fillPrice', 3),
    滑点: formatFeedbackNumber(row, 'slippagePips', 2, 'pips'),
    延迟: formatFeedbackNumber(row, 'latencyMs', 0, 'ms'),
    点差: formatFeedbackNumber(row, 'spreadAtEntry', 2, 'pips'),
    出场: humanizeStatus(row.exitReason || row.rejectReason || '观察中'),
    profitR: formatFeedbackNumber(row, 'profitR', 2),
    mfeR: formatFeedbackNumber(row, 'mfeR', 2),
    maeR: formatFeedbackNumber(row, 'maeR', 2),
    结论: row.rejectReason
      ? `拒单：${humanizeStatus(row.rejectReason)}`
      : row.exitReason
        ? `退出：${humanizeStatus(row.exitReason)}`
        : '历史 / 模拟反馈已记录',
  }));
}

function fieldContractZh(status) {
  const normalized = String(status || 'WAITING_FEEDBACK').toUpperCase();
  if (normalized === 'PASS') return '字段稳定';
  if (normalized === 'BLOCKED') return '字段缺失阻断';
  if (normalized === 'WATCH') return '继续观察';
  return '等待 EA 同步';
}

function parityGateZh(status) {
  const normalized = String(status || 'MISSING').toUpperCase();
  if (normalized.includes('PASS')) return '三方口径一致';
  if (normalized.includes('FAIL')) return '三方口径不一致';
  if (normalized.includes('WARN')) return '三方口径待补证据';
  return '等待三方证据';
}

function syncStateZh(status) {
  const normalized = String(status || 'WAITING').toUpperCase();
  if (normalized === 'WRITTEN') return '已同步';
  if (normalized === 'WRITTEN_WITHOUT_VECTOR') return '已写入待向量';
  if (normalized === 'SKIPPED') return '未触发';
  if (normalized.startsWith('FAILED')) return '同步失败';
  return '等待同步';
}

function evidenceSyncZh(sync = {}) {
  const strategyState = sync.strategyJsonBacktest || sync.strategyJson || sync.strategyBacktest;
  const replayState = sync.pythonReplay || sync.replay;
  const strategyOk = String(strategyState || '').toUpperCase() === 'WRITTEN';
  const replayOk = String(replayState || '').toUpperCase() === 'WRITTEN';
  const hasFailure = [strategyState, replayState].some((value) =>
    String(value || '')
      .toUpperCase()
      .startsWith('FAILED'),
  );
  const label = strategyOk && replayOk ? '证据已同步' : hasFailure ? '证据同步失败' : '等待证据同步';
  return {
    label,
    status: hasFailure ? 'error' : strategyOk && replayOk ? 'ok' : 'warn',
    detail: `Evidence Sync：Strategy JSON ${syncStateZh(strategyState)} / Python Replay ${syncStateZh(
      replayState,
    )}`,
  };
}

export function buildRsiEntryDiagnosticRows(snapshot) {
  if (snapshot.marketSession === 'MARKET_CLOSED') {
    return [
      {
        项目: '当前结论',
        结论: 'MARKET_CLOSED',
        说明: '外汇休市；保留 Shadow / ReadOnly 证据，不评估执行信号。',
      },
      {
        项目: '账号连接',
        结论: snapshot.brokerConnected && snapshot.accountAuthorized ? '已连接并授权' : '连接证据不完整',
        说明: '账号连接与报价新鲜度分开判断；休市报价静止不等价于账号掉线。',
      },
      {
        项目: 'Writer 新鲜度',
        结论: snapshot.writerFresh ? 'FRESH' : 'STALE / 未确认',
        说明: 'Writer 负责账号与守门快照；它与行情 tick 新鲜度是两条独立证据。',
      },
      {
        项目: '报价新鲜度',
        结论: 'MARKET_CLOSED（报价静止）',
        说明: '开市并收到新 tick 后，才重新评估点差、RSI 与信号状态。',
      },
      {
        项目: '点差',
        结论: 'MARKET_CLOSED / 休市不评估',
        说明: '冻结报价不显示为点差硬阻断。',
      },
    ];
  }
  const diagnostics = snapshot.usdJpyRsiEntryDiagnostics || {};
  if (!present(diagnostics)) {
    return [
      {
        项目: '诊断状态',
        结论: '等待 EA 同步',
        说明: 'MT5 尚未写入 USDJPY RSI 入场诊断；请等待下一次 Dashboard 快照。',
      },
    ];
  }

  const route = diagnostics.route || {};
  const permissions = diagnostics.permissions || {};
  const guards = diagnostics.guards || {};
  const spreadGate = snapshot.spreadGate || {};
  const spreadGateConclusion = spreadGateDiagnosticConclusion(spreadGate, snapshot.marketSession);
  const spreadGateDetail = spreadGateDiagnosticDetail(spreadGate, false, snapshot.marketSession);
  const rsi = diagnostics.rsi || {};
  const reasons = rowsFromPayload(diagnostics.whyNoEntry);
  const permissionReady = Boolean(permissions.liveMode && permissions.tradeAllowed);
  const cooldownOrStartup = Boolean(guards.cooldownActive || guards.startupGuardActive);
  const newsGate = guards.newsGate || {};
  const newsRiskLevel = String(
    newsGate.riskLevel || guards.newsRiskLevel || (guards.newsBlocked ? 'HARD' : 'NONE'),
  ).toUpperCase();
  const newsConclusion =
    newsRiskLevel === 'HARD'
      ? '高冲击阻断'
      : newsRiskLevel === 'SOFT'
        ? '软提示 / 降仓'
        : newsRiskLevel === 'UNKNOWN'
          ? '来源未知 / 轻降仓'
          : '未阻断';
  const newsDetail =
    newsGate.reasonZh ||
    guards.newsReason ||
    (newsRiskLevel === 'HARD'
      ? '高冲击事件窗口内暂停影子候选晋级，shadow / replay 继续。'
      : '普通新闻只影响影子建议风险档位与日报记录，不会触发交易。');
  const buyConditionText = `${passText(rsi.buyReversal)} / ${passText(rsi.buyBand)}`;
  const sessionWindowText = String(guards.sessionWindowUtc || '').trim();
  const sessionIsAlwaysOpen =
    !sessionWindowText ||
    ['全天', '24h', '24H', '0-23', '0-24', '00-23', '00-24'].includes(sessionWindowText);
  const sessionDetail = sessionIsAlwaysOpen
    ? '全天评估影子候选；仍受新闻、点差、快通道、冷却、启动保护和研究风控约束。'
    : `允许 ${sessionWindowText}，EA 只在该窗口内生成影子观察与建议。`;
  const buyConditionDetail = `RSI ${formatDiagnosticNumber(rsi.rsiClosed2)} → ${formatDiagnosticNumber(
    rsi.rsiClosed1,
  )}，布林下轨 ${formatDiagnosticNumber(rsi.lowerBand, 3)}，买入分 ${formatDiagnosticNumber(
    rsi.buyScore,
    1,
  )}`;
  const rows = [
    {
      项目: '当前结论',
      结论: diagnostics.stateZh || humanizeStatus(diagnostics.state),
      说明: diagnostics.summary || '等待 EA 生成影子观察或建议信号；系统不会执行交易。',
    },
    {
      项目: 'RSI 买入条件',
      结论: buyConditionText,
      说明: buyConditionDetail,
    },
    {
      项目: '执行边界',
      结论: 'Shadow / ReadOnly（无执行通道）',
      说明: permissions.blocker
        ? `${humanizeStatus(permissions.blocker)}；该字段只作诊断，系统仍不会执行交易。`
        : `旧权限字段已观测：${permissionReady ? '齐全' : '不齐全'}；不构成 broker 执行授权。`,
    },
    {
      项目: '交易时段',
      结论: passText(guards.sessionOpen),
      说明: sessionDetail,
    },
    {
      项目: '点差',
      结论: spreadGateConclusion || passText(guards.spreadAllowed),
      说明:
        spreadGateDetail ||
        `${formatDiagnosticNumber(guards.spreadPips, 1)} / ${formatDiagnosticNumber(
          guards.maxSpreadPips,
          1,
        )} pips`,
    },
    {
      项目: '新闻门禁',
      结论: newsConclusion,
      说明: newsDetail,
    },
    {
      项目: '冷却 / 启动保护',
      结论: cooldownOrStartup ? '等待保护解除' : '通过',
      说明: guards.cooldownReason || guards.startupGuardReason || '没有亏损冷却或启动保护阻断。',
    },
    {
      项目: '仓位容量',
      结论: `${guards.symbolPositions ?? 0}/${guards.maxPositionsPerSymbol ?? '—'}（USDJPY）`,
      说明: `EA 总仓位 ${guards.portfolioPositions ?? 0}/${
        guards.maxTotalPositions ?? '—'
      }；人工持仓占用：${onOffText(guards.manualPositionBlock)}`,
    },
    {
      项目: '最近 EA 评估',
      结论: humanizeStatus(rsi.evalCode || route.lastStatus || '等待信号'),
      说明: rsi.evalReason || route.lastReason || '等待下一次 H1 RSI 评估。',
    },
  ];

  return [
    ...rows,
    ...reasons.slice(0, 5).map((reason) => ({
      项目: reason.label || humanizeStatus(reason.code),
      结论: humanizeStatus(reason.code),
      说明: reason.detail || '—',
    })),
  ];
}

export function buildAccountItems(snapshot) {
  return accountSnapshotItems(snapshot.primaryConnection || snapshot);
}

export function buildSecondaryAccountItems(snapshot) {
  const secondary = snapshot.secondaryConnection || {};
  if (accountSlotDisabled(secondary)) return [];
  return accountSnapshotItems(secondary);
}

export function buildMt5AccountCards(snapshot) {
  const lanes = snapshot.accountLanes || {};
  const accounts = Array.isArray(snapshot.accountRegistry?.accounts) ? snapshot.accountRegistry.accounts : [];
  const centLane = lanes.centLive || accounts.find((item) => item?.accountMode === 'cent') || {};
  const usdLane = lanes.usdDeployment || accounts.find((item) => item?.accountMode === 'standard_usd') || {};
  const primaryPositions = (snapshot.positions || []).filter((row) => row.AccountRole === 'primary');
  const secondaryPositions = (snapshot.positions || []).filter((row) => row.AccountRole === 'secondary');
  const cards = [
    accountCard(snapshot.primaryConnection || snapshot, {
      role: 'primary',
      eyebrow: 'Cent Shadow Profile',
      title: '美分账户 Shadow 观察',
      lane: centLane,
      spreadGate: snapshot.spreadGate,
      latestFreshness: snapshot.latestFreshness,
      positions: primaryPositions,
    }),
  ];
  if (snapshot.secondaryEnabled !== false && !accountSlotDisabled(snapshot.secondaryConnection || {})) {
    cards.push(
      accountCard(snapshot.secondaryConnection || {}, {
        role: 'secondary',
        eyebrow: 'USD ReadOnly Profile',
        title: '美元账户 ReadOnly 观察',
        lane: usdLane,
        spreadGate: snapshot.spreadGate,
        usdDeploymentGate: snapshot.usdDeploymentGate,
        latestFreshness: snapshot.latestFreshness,
        positions: secondaryPositions,
      }),
    );
  }
  return cards;
}

function readonlyAccountHealthy(account = {}) {
  return (
    account.connectionEvidenceKnown === true &&
    account.readReady === true &&
    account.brokerConnected === true &&
    account.accountAuthorized === true &&
    account.writerFresh === true &&
    account.processRunning === true
  );
}

export function resolveMt5ReadonlyConnectionSummary(snapshot = {}, canonicalMt5 = null) {
  const primary = snapshot.primaryConnection || snapshot;
  const secondary = snapshot.secondaryConnection || {};
  const hasCanonical = isObject(canonicalMt5) && Object.keys(canonicalMt5).length > 0;
  const canonicalUnknown = Boolean(
    hasCanonical &&
    (canonicalMt5.brokerConnectionKnown !== true || canonicalMt5.accountAuthorizationKnown !== true),
  );
  const primaryHealthy = hasCanonical
    ? canonicalMt5.writerFresh === true &&
      canonicalMt5.brokerConnectionKnown === true &&
      canonicalMt5.brokerConnected === true &&
      canonicalMt5.accountAuthorizationKnown === true &&
      canonicalMt5.accountAuthorized === true &&
      canonicalMt5.monitorReady === true
    : readonlyAccountHealthy(primary);
  const secondaryState = accountSlotDisabled(secondary)
    ? 'DISABLED'
    : readonlyAccountHealthy(secondary)
      ? 'CONNECTED'
      : 'DISCONNECTED';
  const secondaryHealthy = secondaryState === 'DISABLED' || secondaryState === 'CONNECTED';
  const healthy = primaryHealthy && secondaryHealthy;
  const partiallyAvailable = !canonicalUnknown && primaryHealthy && secondaryState === 'DISCONNECTED';
  const marketClosed = snapshot.marketSession === 'MARKET_CLOSED';

  let bannerLabel = 'MT5 连接证据不完整';
  let runtimeLabel = 'Shadow / ReadOnly · 连接证据不完整';
  if (canonicalUnknown) {
    bannerLabel = 'MT5 连接与授权待确认';
    runtimeLabel = 'Shadow / ReadOnly · 状态待确认';
  } else if (primaryHealthy && secondaryState === 'DISABLED') {
    bannerLabel = marketClosed ? '主账号已连接 · MARKET_CLOSED' : '主账号已连接';
    runtimeLabel = marketClosed
      ? 'MARKET_CLOSED · 主账号 Shadow / ReadOnly'
      : '主账号已连接 · Shadow / ReadOnly';
  } else if (primaryHealthy && secondaryState === 'DISCONNECTED') {
    bannerLabel = marketClosed
      ? '主账号只读可用 · 第二账号未连接 · MARKET_CLOSED'
      : '主账号只读可用 · 第二账号未连接';
    runtimeLabel = marketClosed
      ? 'MARKET_CLOSED · 部分可用 · 第二账号未连接'
      : '部分可用 · 主账号 Shadow / ReadOnly 正常 · 第二账号未连接';
  } else if (healthy) {
    bannerLabel = marketClosed ? '双账号已连接 · MARKET_CLOSED' : '双账号只读连接正常';
    runtimeLabel = marketClosed
      ? 'MARKET_CLOSED · 双账号 Shadow / ReadOnly'
      : '双账号已连接 · Shadow / ReadOnly';
  }

  return {
    primaryHealthy,
    secondaryHealthy,
    secondaryState,
    canonicalUnknown,
    healthy,
    partiallyAvailable,
    bannerStatus: partiallyAvailable ? 'warn' : healthy ? (marketClosed ? 'warn' : 'ok') : 'blocked',
    bannerLabel,
    runtimeStatus: healthy || partiallyAvailable ? 'warn' : 'blocked',
    runtimeLabel,
  };
}

export function buildMt5ConnectionItems(snapshot) {
  const primary = snapshot.primaryConnection || snapshot;
  const activeLogin = normalizeAccountId(snapshot.login);
  const secondary = snapshot.secondaryConnection || {};
  const secondaryDisabled = accountSlotDisabled(secondary);
  const secondaryConnected = secondary.connected && secondary.accountAuthorized;

  return [
    {
      label: '当前实际连接',
      value: activeLogin ? `${maskAccountLogin(snapshot.login)} / ${snapshot.server}` : '未返回 MT5 账号',
      status: primary.brokerConnected && primary.accountAuthorized ? 'ok' : 'blocked',
      hint:
        primary.brokerConnected && primary.accountAuthorized
          ? 'Broker 已连接、账号已授权；结论只来自新鲜的 MT5 只读快照。'
          : '等待终端连接与账号授权证据；快照新鲜度不能替代连接证据。',
    },
    ...(!secondaryDisabled
      ? [
          {
            label: '第二账号状态',
            value: secondaryConnected
              ? `${maskAccountLogin(secondary.login)} / ${secondary.server}`
              : '已启用 / 未连接',
            status: secondaryConnected ? 'ok' : 'blocked',
            hint: secondaryConnected
              ? '第二个 MT5 实例已授权成功；EA 快照会继续同步。'
              : secondaryConnectionHint(secondary),
          },
        ]
      : []),
    {
      label: '凭据边界',
      value: '前端不读取或保存密码',
      status: 'ok',
      hint: '登录身份仅在本机私有配置中 hydration；页面和 API 不返回原始凭据。',
    },
  ];
}

export function buildMt5AccountProfileRows(snapshot) {
  const profiles = Array.isArray(snapshot.accountProfiles) ? snapshot.accountProfiles : [];
  const activeLogin = normalizeAccountId(snapshot.login);
  const activeServer = normalizeServerName(snapshot.server);
  const secondary = snapshot.secondaryConnection || {};
  const secondaryLogin = normalizeAccountId(secondary.login);
  const secondaryServer = normalizeServerName(secondary.server);
  return profiles.map((profile) => {
    const login = profile.accountLogin ?? profile.login ?? '—';
    const server = profile.server || '—';
    const current =
      normalizeAccountId(login) === activeLogin &&
      (!normalizeServerName(server) || !activeServer || normalizeServerName(server) === activeServer);
    const secondaryCurrent =
      secondary.connected &&
      normalizeAccountId(login) === secondaryLogin &&
      (!normalizeServerName(server) || !secondaryServer || normalizeServerName(server) === secondaryServer);
    const secondaryProfile = `${profile.profileId || ''} ${profile.role || ''}`.toLowerCase();
    const isSecondary = secondaryProfile.includes('secondary') || secondaryProfile.includes('live16');
    return {
      Profile: profile.profileId || profile.name || 'MT5 Profile',
      角色: profile.role || 'operator',
      账号: maskAccountLogin(login),
      服务器: server,
      状态: current
        ? '主终端当前连接'
        : secondaryCurrent
          ? '第二终端当前连接'
          : isSecondary
            ? '已登记 / 等待登录'
            : '已登记 / 未连接',
      密码来源: profile.passwordEnvVar || '未配置',
      原始密码: profile.passwordPersisted ? '异常：已保存' : '未保存',
    };
  });
}

function compactRow(row, fields) {
  const out = {};
  for (const [label, candidates] of Object.entries(fields)) {
    out[label] = pick(row, candidates, '');
  }
  return out;
}

function parseMt5TimeMs(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[./-](\d{2})[./-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const parsed = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTimeMs(row, keys) {
  for (const key of keys) {
    const value = pick(row, [key], null);
    const parsed = parseMt5TimeMs(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function latestRows(rows, keys, limit = Number.POSITIVE_INFINITY) {
  return [...(rows || [])]
    .map((row, index) => ({ row, index, timeMs: rowTimeMs(row, keys) }))
    .sort((left, right) => {
      if (left.timeMs !== null && right.timeMs !== null && left.timeMs !== right.timeMs) {
        return right.timeMs - left.timeMs;
      }
      if (left.timeMs !== null && right.timeMs === null) return -1;
      if (left.timeMs === null && right.timeMs !== null) return 1;
      return right.index - left.index;
    })
    .slice(0, limit)
    .map((item) => item.row);
}

function accountSnapshotDiagnosticRows(snapshot = {}, noun = '实时数据') {
  return (snapshot.accountConnections || [])
    .filter((account) => account.hostProcessMissing || freshnessBlocksCurrentState(account.freshness || {}))
    .map((account) => {
      const freshness = account.freshness || {};
      const state = account.hostProcessMissing ? 'writer 未运行' : freshnessStatusLabel(freshness);
      const hint = account.hostProcessMissing
        ? '未检测到 terminal64/wine 进程；先恢复 MT5/EA dashboard writer。'
        : freshnessRecoveryHint(freshness);
      return {
        账户: account.label || account.role || 'MT5 账号',
        状态: state,
        可信范围: `${noun}不可确认；旧快照不能证明当前为 0。`,
        下一步: hint,
      };
    });
}

export function buildPositionRows(snapshot) {
  if (!snapshot.positions.length) {
    const diagnostics = accountSnapshotDiagnosticRows(snapshot, '实时持仓');
    if (diagnostics.length) return diagnostics;
  }
  return snapshot.positions.slice(0, 30).map((row) =>
    compactRow(row, {
      账户: ['Account', 'account', 'AccountLogin', 'accountLogin'],
      票号: ['ticket', 'position', 'id'],
      品种: ['symbol'],
      方向: ['type', 'side', 'action'],
      手数: ['volume', 'lots'],
      开仓价: ['priceOpen', 'price_open', 'open_price', 'entry_price'],
      当前价: ['priceCurrent', 'price_current', 'current_price'],
      浮盈: ['profit', 'pnl'],
      止损: ['sl', 'stop_loss'],
      止盈: ['tp', 'take_profit'],
      策略: ['strategy', 'Strategy'],
      来源: ['source', 'Source'],
    }),
  );
}

export function buildOrderRows(snapshot) {
  if (!snapshot.orders.length) {
    const diagnostics = accountSnapshotDiagnosticRows(snapshot, '挂单状态');
    if (diagnostics.length) return diagnostics;
  }
  return snapshot.orders.slice(0, 30).map((row) =>
    compactRow(row, {
      账户: ['Account', 'account', 'AccountLogin', 'accountLogin'],
      票号: ['ticket', 'order', 'id'],
      品种: ['symbol'],
      类型: ['type', 'side', 'action'],
      手数: ['volumeCurrent', 'volume', 'lots'],
      价格: ['priceOpen', 'price_open', 'price', 'entry_price'],
      止损: ['sl', 'stop_loss'],
      止盈: ['tp', 'take_profit'],
    }),
  );
}

export function buildSymbolRows(snapshot) {
  return focusSymbolRows(snapshot.symbols)
    .slice(0, 40)
    .map((row) =>
      compactRow(row, {
        品种: ['symbol', 'name'],
        可见: ['enabled', 'visible', 'selected'],
        点位: ['digits'],
        点差: ['spread', 'spread_float'],
        交易模式: ['trade_mode', 'tradeMode'],
        最小手数: ['volumeMin', 'volume_min', 'min_lot'],
        最大手数: ['volumeMax', 'volume_max', 'max_lot'],
      }),
    );
}

export function buildCloseHistoryRows(snapshot) {
  return latestRows(snapshot.combinedCloseHistory || snapshot.closeHistory, [
    'CloseTime',
    'closeTime',
    'OpenTime',
    'openTime',
  ]).map((row) =>
    compactRow(row, {
      账户: ['Account', 'account', 'AccountLogin', 'accountLogin'],
      平仓时间: ['CloseTime', 'closeTime'],
      品种: ['Symbol', 'symbol'],
      方向: ['Type', 'type'],
      手数: ['Lots', 'lots'],
      净盈亏: ['NetProfit', 'netProfit', 'profit'],
      策略: ['Strategy', 'strategy'],
      来源: ['Source', 'source'],
      备注: ['Comment', 'comment'],
    }),
  );
}

function tradePositionId(row) {
  return String(
    pick(
      row,
      [
        'PositionId',
        'positionId',
        'position_id',
        'Position',
        'position',
        'Ticket',
        'ticket',
        'OrderTicket',
        'orderTicket',
      ],
      '',
    ),
  ).trim();
}

function tradeEventType(row) {
  return String(pick(row, ['EventType', 'eventType', 'Type', 'type'], '') || '').toUpperCase();
}

function isEntryEvent(row) {
  const event = tradeEventType(row);
  return event.includes('ENTRY') || event.includes('OPEN');
}

function isExitEvent(row) {
  const event = tradeEventType(row);
  return event.includes('EXIT') || event.includes('CLOSE');
}

export function buildUnclosedEntryRows(snapshot) {
  const closedIds = new Set(
    [...snapshot.tradeJournal.filter(isExitEvent), ...snapshot.closeHistory]
      .map(tradePositionId)
      .filter(Boolean),
  );
  const openIds = new Set(snapshot.positions.map(tradePositionId).filter(Boolean));

  return latestRows(
    focusSymbolRows(snapshot.tradeJournal).filter(
      (row) => isEntryEvent(row) && !closedIds.has(tradePositionId(row)),
    ),
    ['EventTime', 'eventTime', 'Time', 'time'],
  ).map((row) => {
    const positionId = tradePositionId(row);
    const isOpen = positionId && openIds.has(positionId);
    return {
      入场时间: pick(row, ['EventTime', 'eventTime', 'Time', 'time'], ''),
      品种: pick(row, ['Symbol', 'symbol'], ''),
      方向: pick(row, ['Side', 'side', 'Type', 'type'], ''),
      手数: pick(row, ['Lots', 'lots', 'Volume', 'volume'], ''),
      入场价: pick(row, ['Price', 'price'], ''),
      策略: pick(row, ['Strategy', 'strategy'], ''),
      状态: isOpen ? '实时持仓中' : '待快照/平仓同步',
      说明: isOpen
        ? '交易流水已有 ENTRY，实时持仓快照仍显示该仓位；平仓后会进入历史交易记录。'
        : '交易流水已有 ENTRY，但还没有 EXIT / CloseHistory；若 EA 快照陈旧，会先显示在这里。',
      PositionId: positionId || '—',
    };
  });
}

export function buildTradeJournalRows(snapshot) {
  return latestRows(snapshot.combinedTradeJournal || snapshot.tradeJournal, [
    'EventTime',
    'eventTime',
    'Time',
    'time',
  ]).map((row) =>
    compactRow(row, {
      账户: ['Account', 'account', 'AccountLogin', 'accountLogin'],
      时间: ['EventTime', 'eventTime'],
      事件: ['EventType', 'eventType'],
      品种: ['Symbol', 'symbol'],
      方向: ['Side', 'side'],
      价格: ['Price', 'price'],
      净盈亏: ['NetProfit', 'netProfit'],
      策略: ['Strategy', 'strategy'],
    }),
  );
}

export function buildMt5TodoRows(snapshot) {
  if (!dailyReviewIsFresh(snapshot.dailyReview)) {
    return [
      {
        任务: '今日待办',
        路线: 'USDJPY',
        状态: '等待今日刷新',
        结论: '本地 DailyReview 不是今天生成，已隐藏旧日期和非 USDJPY 队列',
        测试窗口: '刷新后更新',
      },
    ];
  }
  const queue = focusScopedRows(rowsFromPayload(snapshot.dailyReview?.actionQueue));
  const completed = focusScopedRows(rowsFromPayload(snapshot.dailyReview?.completedActionQueue));
  const researchBacklog = focusScopedRows(rowsFromPayload(snapshot.dailyReview?.researchBacklogQueue));
  const sourceRows = queue.length ? queue : completed;
  if (!sourceRows.length) {
    if (researchBacklog.length) {
      return [
        {
          任务: 'MT5 今日待办',
          路线: '参数实验',
          状态: '已跑完',
          结论: `${researchBacklog.length} 个新候选进入下一轮研究 backlog`,
          测试窗口: snapshot.dailyReview?.summary?.nextTesterWindowLabel || '下一轮刷新',
        },
      ];
    }
    return [{ 任务: 'MT5 今日待办', 状态: '已完成或无待办', 结论: '当前没有阻塞项' }];
  }
  return sourceRows.slice(0, 10).map((row) => ({
    任务: row.candidateId || row.type || '待办任务',
    路线: row.routeKey || row.strategy || '—',
    状态: queue.length ? humanizeStatus(row.state || '待处理') : '已完成',
    结论: humanizeStatus(row.resultStatus || row.statusLabel || '等待报告'),
    测试窗口: row.nextTesterWindowLabel || snapshot.dailyReview?.summary?.nextTesterWindowLabel || '—',
  }));
}

export function buildMt5ReviewRows(snapshot) {
  if (!dailyReviewIsFresh(snapshot.dailyReview)) {
    return [
      {
        项目: '每日复盘',
        结果: '等待今日刷新',
        建议: '本地 DailyReview 不是今天生成，旧复盘不会作为当前状态展示',
      },
    ];
  }
  const pnl = snapshot.dailyReview?.dailyPnl || {};
  const summary = snapshot.dailyReview?.summary || {};
  const iteration = snapshot.dailyReview?.dailyIteration || {};
  const findings = rowsFromPayload(iteration.findings);
  const strategyQueue = focusScopedRows(rowsFromPayload(iteration.strategyIterationQueue));
  const evidenceQueue = focusScopedRows(rowsFromPayload(iteration.evidenceIterationQueue));
  const noTradeFinding = findings.find((row) => row.code === 'PARAMLAB_NO_TRADE_TESTER_WINDOWS');
  return [
    {
      项目: '昨日平仓',
      结果: `${pnl.closedTrades ?? summary.dailyClosedTrades ?? 0} 笔 / ${format(pnl.netUSC ?? summary.dailyNetUSC ?? 0)} USC`,
      建议: pnl.requiresReview ? 'Agent 已标记亏损来源，等待 Evidence OS 归因' : '无需新增代码迭代',
    },
    {
      项目: '参数实验',
      结果: `完成 ${summary.dailyTesterCompletedCount || 0} 项 / 延后 ${summary.paramDeferredCount || 0} 项`,
      建议: noTradeFinding
        ? '全部无成交，需隔离 tester 调参重跑'
        : summary.promotionReviewCount
          ? '有待晋级候选需 Agent 治理门裁决'
          : '暂无待晋级项',
    },
    {
      项目: '策略迭代',
      结果: summary.dailyIterationRequired
        ? `策略 ${strategyQueue.length} 项 / 证据 ${evidenceQueue.length} 项`
        : '暂无',
      建议: summary.dailyIterationRequired ? '保持执行配置不变，只迭代模拟候选' : '今日无需代码或策略动作',
    },
  ];
}

export function buildEndpointHealth(raw = {}) {
  const hasSnapshot = present(raw.snapshot);
  const hasSymbolRegistry = present(raw.symbols);
  const secondarySnapshot = unwrap(raw.secondarySnapshot) || {};
  const secondaryEnabled = !(
    String(secondarySnapshot.status || '').toUpperCase() === 'DISABLED' &&
    secondarySnapshot.optional === true &&
    secondarySnapshot.enabled === false
  );
  const symbolPayload = hasSymbolRegistry ? raw.symbols : hasSnapshot ? raw.snapshot : raw.symbols;
  const endpointState = (payload) => {
    if (!present(payload)) {
      return { status: 'warn', statusLabel: '缺失', description: '' };
    }
    const value = unwrap(payload);
    const freshness = freshnessFromReadonlyPayload(value || {});
    const process = mt5HostProcess(value || {});
    const processMissing = mt5HostProcessMissing(process);
    if (processMissing) {
      return {
        status: 'blocked',
        statusLabel: 'writer 未运行',
        description:
          '未检测到 terminal64/wine 进程；先恢复 MT5 终端和 EA dashboard writer，再判断当前账号状态。',
      };
    }
    if (freshnessMissing(freshness)) {
      return {
        status: 'blocked',
        statusLabel: '快照缺失',
        description: freshnessRecoveryHint(
          freshness,
          '未找到 QuantGod_Dashboard.json；先恢复 MT5 终端和 EA dashboard writer。',
        ),
      };
    }
    if (freshnessUnavailable(freshness)) {
      return {
        status: 'blocked',
        statusLabel: '只读桥不可用',
        description: freshnessRecoveryHint(
          freshness,
          '恢复或配置对应 MT5 只读桥后，再把账号、持仓或执行状态当成当前值。',
        ),
      };
    }
    if (freshnessStale(freshness)) {
      return {
        status: 'warn',
        statusLabel: '快照过期',
        description: freshnessRecoveryHint(
          freshness,
          '恢复对应 MT5/EA dashboard writer 后再把账号、持仓或执行状态当成当前值。',
        ),
      };
    }
    if (freshnessUnconfirmed(freshness)) {
      return {
        status: 'warn',
        statusLabel: '待确认',
        description: freshnessRecoveryHint(freshness, '等待只读桥返回快照新鲜度证据。'),
      };
    }
    if (isObject(value) && value.ok === false) {
      return {
        status: 'warn',
        statusLabel: '不可用',
        description:
          value.statusZh || value.error?.message || value.error || '后端返回 ok=false，当前证据不可用。',
      };
    }
    return { status: 'ok', statusLabel: '正常', description: '' };
  };
  const endpoints = [
    ['连接状态', '/api/mt5-readonly/status', raw.status, '终端连接与授权'],
    ['账户快照', '/api/mt5-readonly/account', raw.account, '余额、净值、服务器'],
    ...(secondaryEnabled
      ? [
          [
            '第二账号快照',
            '/api/mt5-readonly-secondary/account',
            raw.secondaryAccount,
            '第二 MT5 实例账号授权',
          ],
        ]
      : []),
    ['历史平仓', '/api/trades/close-history', raw.closeHistory, '主账号历史平仓 CSV'],
    ...(secondaryEnabled
      ? [
          [
            '第二历史平仓',
            '/api/trades/close-history?scope=secondary',
            raw.secondaryCloseHistory,
            '第二账号历史平仓 CSV',
          ],
        ]
      : []),
    ['交易流水', '/api/trades/journal', raw.tradeJournal, '主账号交易流水 CSV'],
    ...(secondaryEnabled
      ? [
          [
            '第二交易流水',
            '/api/trades/journal?scope=secondary',
            raw.secondaryTradeJournal,
            '第二账号交易流水 CSV',
          ],
        ]
      : []),
    ['实时持仓', '/api/mt5-readonly/positions', raw.positions, '当前 MT5 只读持仓'],
    ['挂单状态', '/api/mt5-readonly/orders', raw.orders, '当前挂单'],
    [
      '品种状态',
      '/api/mt5-symbol-registry/symbols',
      symbolPayload,
      hasSymbolRegistry ? '执行守门与模拟品种池' : '快照可用，登记文件待同步',
    ],
    ['完整快照', '/api/mt5-readonly/snapshot', raw.snapshot, 'EA 快照兜底'],
  ];
  return endpoints.map(([label, endpoint, payload, description]) => {
    const state = endpointState(payload);
    return {
      label,
      endpoint,
      description: state.description || description,
      status: state.status,
      statusLabel: state.statusLabel,
    };
  });
}
