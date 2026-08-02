import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { URL } from 'node:url';
import {
  getKline,
  getSymbolRegistry,
  runAiAnalysis,
  runDeepSeekTelegram,
  USDJPY_FOCUS_SYMBOL,
} from '../src/services/phase1Api.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload, status = 200) {
  return new globalThis.Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('phase1Api GET calls use apiClient metadata and no-store fetch options', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, bars: [{ close: 150.12 }] });
  };

  const payload = await getKline({ symbol: USDJPY_FOCUS_SYMBOL, tf: 'M15', bars: 10 });

  assert.equal(payload.ok, true);
  assert.equal(payload.bars.length, 1);
  assert.equal(payload._api.endpoint, '/api/mt5-readonly/kline?symbol=USDJPYc&tf=M15&bars=10');
  assert.equal(payload._api.method, 'GET');
  assert.equal(payload._api.status, 200);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.method, 'GET');
});

test('phase1Api POST calls use apiClient CSRF header and preserve metadata', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, mode: 'ai_analysis', decision: { action: 'HOLD' } });
  };

  const payload = await runAiAnalysis({ symbol: USDJPY_FOCUS_SYMBOL, timeframes: ['M15', 'H1'] });

  assert.equal(payload.ok, true);
  assert.equal(payload._api.endpoint, '/api/ai-analysis/run');
  assert.equal(payload._api.method, 'POST');
  assert.equal(calls[0].options.headers['X-QuantGod-Local'], '1');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    symbol: USDJPY_FOCUS_SYMBOL,
    timeframes: ['M15', 'H1'],
  });
});

test('DeepSeek Telegram defaults to analysis-only without force', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, items: [] });
  };

  await runDeepSeekTelegram({ symbol: USDJPY_FOCUS_SYMBOL });
  await runDeepSeekTelegram({ symbol: USDJPY_FOCUS_SYMBOL, send: true });

  const defaultBody = JSON.parse(calls[0].options.body);
  const explicitBody = JSON.parse(calls[1].options.body);
  assert.deepEqual(defaultBody, {
    symbols: [USDJPY_FOCUS_SYMBOL],
    timeframes: ['M15', 'H1', 'H4', 'D1'],
    send: false,
    dryRun: true,
    force: false,
    noDeepseek: false,
    minIntervalSeconds: 900,
  });
  assert.equal(explicitBody.send, true);
  assert.equal(explicitBody.dryRun, false);
  assert.equal(explicitBody.force, false);
  assert.equal(explicitBody.minIntervalSeconds, 900);
  assert.equal(calls[0].url, '/api/ai-analysis/deepseek-telegram/run');
  assert.equal(calls[1].url, '/api/ai-analysis/deepseek-telegram/run');
});

test('Phase 1 workspace never overrides the Telegram force guard', () => {
  const source = readFileSync(
    new URL('../src/workspaces/phase1/AiAnalysisWorkspace.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /force:\s*false/);
  assert.doesNotMatch(source, /force:\s*true/);
});

test('phase1Api commands reject HTTP 200 payloads without explicit ok=true', async () => {
  globalThis.fetch = async () => jsonResponse({ status: 'COMPLETED' });
  await assert.rejects(
    runAiAnalysis({ symbol: USDJPY_FOCUS_SYMBOL, timeframes: ['M15'] }),
    /did not confirm ok=true/,
  );

  globalThis.fetch = async () => jsonResponse({ ok: false, error: 'analysis_blocked' });
  await assert.rejects(
    runAiAnalysis({ symbol: USDJPY_FOCUS_SYMBOL, timeframes: ['M15'] }),
    /analysis_blocked/,
  );
});

test('phase1Api returns fallback envelopes instead of throwing on backend failures', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'mt5_readonly_down' }, 503);

  const payload = await getKline({ symbol: USDJPY_FOCUS_SYMBOL, tf: 'H1', bars: 20 });

  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'mt5_readonly_down');
  assert.equal(payload._api.endpoint, '/api/mt5-readonly/kline?symbol=USDJPYc&tf=H1&bars=20');
  assert.equal(payload._api.status, 503);
});

test('phase1Api symbol registry remains USDJPY scoped on registry failures', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'registry_down' }, 503);

  const symbols = await getSymbolRegistry();

  assert.deepEqual(symbols, [
    { symbol: USDJPY_FOCUS_SYMBOL, label: USDJPY_FOCUS_SYMBOL, assetClass: 'Forex' },
  ]);
});
