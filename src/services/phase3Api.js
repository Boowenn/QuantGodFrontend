import { fetchJsonOrFallback, postCommandJson } from './apiClient.js';

const FETCH_FALLBACK = Object.freeze({ ok: false, error: 'phase3_fetch_failed' });

function fetchPhase3Json(url, options = {}) {
  return fetchJsonOrFallback(url, FETCH_FALLBACK, { signal: options.signal });
}

function postPhase3Json(url, body = {}, options = {}) {
  return postCommandJson(url, body || {}, { signal: options.signal });
}

export const phase3Api = {
  vibeConfig: () => fetchPhase3Json('/api/vibe-coding/config'),
  generateStrategy: (body) => postPhase3Json('/api/vibe-coding/generate', body),
  iterateStrategy: (body) => postPhase3Json('/api/vibe-coding/iterate', body),
  backtestStrategy: (body) => postPhase3Json('/api/vibe-coding/backtest', body),
  analyzeBacktest: (body) => postPhase3Json('/api/vibe-coding/analyze', body),
  listStrategies: () => fetchPhase3Json('/api/vibe-coding/strategies'),
  getStrategy: (strategyId, version) =>
    fetchPhase3Json(
      `/api/vibe-coding/strategy/${encodeURIComponent(strategyId)}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
    ),
  aiV2Config: () => fetchPhase3Json('/api/ai-analysis-v2/config'),
  runAiV2: (body) => postPhase3Json('/api/ai-analysis-v2/run', body),
  aiV2Latest: () => fetchPhase3Json('/api/ai-analysis-v2/latest'),
  aiV2History: (params = {}) =>
    fetchPhase3Json(`/api/ai-analysis-v2/history?${new URLSearchParams(params).toString()}`),
  klineAiOverlays: (params = {}) =>
    fetchPhase3Json(`/api/kline/ai-overlays?${new URLSearchParams(params).toString()}`),
  klineVibeIndicators: (params = {}) =>
    fetchPhase3Json(`/api/kline/vibe-indicators?${new URLSearchParams(params).toString()}`),
  klineRealtimeConfig: () => fetchPhase3Json('/api/kline/realtime-config'),
};

export default phase3Api;
