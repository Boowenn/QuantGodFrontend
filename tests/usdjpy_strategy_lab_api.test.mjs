import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  dispatchUSDJPYTelegramGateway,
  fetchUSDJPYStrategyLabStatus,
  runUSDJPYLiveLoop,
} from '../src/services/usdjpyStrategyLabApi.js';

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

test('USDJPY Telegram Gateway dispatch defaults to preview and requires body double confirmation', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, sent: false });
  };

  await dispatchUSDJPYTelegramGateway();
  await dispatchUSDJPYTelegramGateway({ send: true, limit: 3 });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      '/api/usdjpy-strategy-lab/telegram-gateway/dispatch',
      '/api/usdjpy-strategy-lab/telegram-gateway/dispatch',
    ],
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    focusSymbol: 'USDJPYc',
    send: false,
    dryRun: true,
    limit: 8,
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    focusSymbol: 'USDJPYc',
    send: true,
    dryRun: false,
    limit: 3,
  });
  assert.equal(
    calls.every((call) => !call.url.includes('send=1')),
    true,
  );
});
