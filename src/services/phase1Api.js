import { fetchJsonOrFallback, postCommandJson } from './apiClient.js';

export const USDJPY_FOCUS_SYMBOL = 'USDJPYc';

const USDJPY_SYMBOL_FALLBACK = [
  { symbol: USDJPY_FOCUS_SYMBOL, label: USDJPY_FOCUS_SYMBOL, assetClass: 'Forex' },
];

const FETCH_FALLBACK = Object.freeze({ ok: false, error: 'phase1_fetch_failed' });

function fetchPhase1Json(path, options = {}) {
  return fetchJsonOrFallback(path, FETCH_FALLBACK, options);
}

function postPhase1Json(path, payload = {}, options = {}) {
  return postCommandJson(path, payload || {}, options);
}

function isUsdJpySymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .startsWith('USDJPY');
}

export async function runAiAnalysis({ symbol, timeframes = ['M15', 'H1', 'H4', 'D1'] }) {
  return postPhase1Json('/api/ai-analysis/run', { symbol, timeframes });
}

export function getAiLatest() {
  return fetchPhase1Json('/api/ai-analysis/latest');
}

export function getAiHistory({ symbol = '', limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (symbol) params.set('symbol', symbol);
  return fetchPhase1Json(`/api/ai-analysis/history?${params.toString()}`);
}

export function getAiHistoryItem(id) {
  return fetchPhase1Json(`/api/ai-analysis/history/${encodeURIComponent(id)}`);
}

export function getAiConfig() {
  return fetchPhase1Json('/api/ai-analysis/config');
}

export function getDeepSeekTelegramLatest() {
  return fetchPhase1Json('/api/ai-analysis/deepseek-telegram/latest');
}

export async function runDeepSeekTelegram({
  symbols = [],
  symbol = '',
  timeframes = ['M15', 'H1', 'H4', 'D1'],
  send = true,
  force = true,
  noDeepseek = false,
} = {}) {
  const normalizedSymbols = Array.isArray(symbols) && symbols.length ? symbols : [symbol].filter(Boolean);
  return postPhase1Json('/api/ai-analysis/deepseek-telegram/run', {
    symbols: normalizedSymbols,
    timeframes,
    send,
    force,
    noDeepseek,
    minIntervalSeconds: force ? 0 : 900,
  });
}

export function getKline({ symbol, tf = 'H1', bars = 200, signal } = {}) {
  const params = new URLSearchParams({ symbol, tf, bars: String(bars) });
  return fetchPhase1Json(`/api/mt5-readonly/kline?${params.toString()}`, { signal });
}

export function getQuote({ symbol, signal } = {}) {
  const params = new URLSearchParams({ symbol });
  return fetchPhase1Json(`/api/mt5-readonly/quote?${params.toString()}`, { signal });
}

export function getChartTrades({ symbol, days = 30, signal } = {}) {
  const params = new URLSearchParams({ symbol, days: String(days) });
  return fetchPhase1Json(`/api/mt5-readonly/trades?${params.toString()}`, { signal });
}

export function getShadowSignals({ symbol, days = 7, signal } = {}) {
  const params = new URLSearchParams({ symbol, days: String(days) });
  return fetchPhase1Json(`/api/shadow/signals?${params.toString()}`, { signal });
}

export async function getSymbolRegistry({ signal } = {}) {
  const payload = await fetchPhase1Json('/api/mt5-symbol-registry', { signal });
  const items = payload.items || payload.symbols || payload.registry || [];
  if (Array.isArray(items) && items.length) {
    const normalizedItems = items
      .map((item) => ({
        symbol: item.brokerSymbol || item.symbol || item.canonicalSymbol || item.name,
        label: item.displayName || item.brokerSymbol || item.symbol || item.canonicalSymbol || item.name,
        assetClass: item.assetClass || item.category || '',
      }))
      .filter((item) => item.symbol && isUsdJpySymbol(item.symbol));
    if (normalizedItems.length) return normalizedItems;
  }
  return USDJPY_SYMBOL_FALLBACK;
}
