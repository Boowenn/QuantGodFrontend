import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchUSDJPYStrategyLabStatus, runUSDJPYLiveLoop } from '../src/services/usdjpyStrategyLabApi.js';

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

test('USDJPY Strategy Lab GET calls use apiClient metadata and no-store options', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, status: 'READY' });
  };

  const payload = await fetchUSDJPYStrategyLabStatus();

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'READY');
  assert.equal(payload._api.endpoint, '/api/usdjpy-strategy-lab/status');
  assert.equal(payload._api.method, 'GET');
  assert.equal(payload._api.status, 200);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.method, 'GET');
});

test('USDJPY Strategy Lab POST calls preserve focus symbol and CSRF guard header', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, state: 'DRY_RUN_ONLY' });
  };

  const payload = await runUSDJPYLiveLoop();

  assert.equal(payload.ok, true);
  assert.equal(payload._api.endpoint, '/api/usdjpy-strategy-lab/live-loop/run');
  assert.equal(payload._api.method, 'POST');
  assert.equal(calls[0].options.headers['X-QuantGod-Local'], '1');
  assert.deepEqual(JSON.parse(calls[0].options.body), { focusSymbol: 'USDJPYc' });
});

test('USDJPY Strategy Lab commands reject HTTP 200 payloads without ok=true', async () => {
  globalThis.fetch = async () => jsonResponse({ ok: false, error: 'risk_gate_rejected' });

  await assert.rejects(runUSDJPYLiveLoop(), /risk_gate_rejected/);
});
