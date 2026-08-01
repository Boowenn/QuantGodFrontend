import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  endpointErrorMessage,
  endpointFailureDetail,
  endpointSummary,
  fetchPhase2Json,
  postPhase2Json,
} from '../src/services/phase2Api.js';

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

test('endpointSummary exposes API failure metadata for operator pages', () => {
  const payload = {
    ok: false,
    error: 'snapshot_bridge_down',
    _api: {
      ok: false,
      endpoint: '/api/mt5-readonly-secondary/snapshot',
      method: 'GET',
      status: 503,
      fetchedAt: '2026-06-17T09:00:00.000Z',
      durationMs: 37,
      error: {
        message: 'HTTP 503',
        bodyError: 'snapshot_bridge_down',
      },
    },
  };

  const summary = endpointSummary(payload);

  assert.equal(summary.ok, false);
  assert.equal(summary.endpoint, '/api/mt5-readonly-secondary/snapshot');
  assert.equal(summary.httpStatus, 'GET 503');
  assert.equal(summary.fetchedAt, '2026-06-17T09:00:00.000Z');
  assert.equal(summary.durationLabel, '37 ms');
  assert.equal(summary.error, 'snapshot_bridge_down');
  assert.match(summary.failureDetail, /\/api\/mt5-readonly-secondary\/snapshot/);
  assert.match(summary.failureDetail, /GET 503/);
});

test('endpointErrorMessage prefers backend Chinese status when present', () => {
  const payload = {
    ok: false,
    _api: {
      endpoint: '/api/latest',
      method: 'GET',
      status: 0,
      fetchedAt: '2026-06-17T09:01:00.000Z',
      error: {
        message: 'AbortError',
        bodyStatusZh: 'MT5 dashboard 快照已过期',
      },
    },
  };

  assert.equal(endpointErrorMessage(payload), 'MT5 dashboard 快照已过期');
  assert.match(endpointFailureDetail(payload), /GET 无响应/);
});

test('fetchPhase2Json uses apiClient metadata and no-store options', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true, status: 'READY' });
  };

  const payload = await fetchPhase2Json('/api/notify/config', { ok: false });

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'READY');
  assert.equal(payload._api.endpoint, '/api/notify/config');
  assert.equal(payload._api.method, 'GET');
  assert.equal(payload._api.status, 200);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.method, 'GET');
});

test('postPhase2Json uses the local POST guard and rejects every non-ok command envelope', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ error: 'notify_test_failed' }, 503);
  };

  await assert.rejects(
    postPhase2Json(
      '/api/notify/test',
      { message: 'dry-run', dryRun: true },
      { ok: false, error: 'fallback' },
    ),
    /notify_test_failed/,
  );
  assert.equal(calls[0].options.headers['X-QuantGod-Local'], '1');
  assert.deepEqual(JSON.parse(calls[0].options.body), { message: 'dry-run', dryRun: true });

  globalThis.fetch = async () => jsonResponse({ sent: true });
  await assert.rejects(postPhase2Json('/api/notify/test', { dryRun: true }), /did not confirm ok=true/);
});
