import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { loadDashboardState } from '../src/services/api.js';

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

function endpointFromUrl(url) {
  const parsed = new URL(String(url), 'http://127.0.0.1');
  return `${parsed.pathname}${parsed.search}`;
}

test('legacy dashboard loader keeps the frontend renderable when one snapshot endpoint is stale or down', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const endpoint = endpointFromUrl(url);
    calls.push(endpoint);
    if (endpoint === '/api/latest') {
      return jsonResponse({
        schemaVersion: 2,
        trading: {
          statusZh: 'MT5 dashboard 快照已过期',
          staleDashboardSnapshot: true,
        },
        _freshness: {
          status: 'STALE_DASHBOARD_SNAPSHOT',
          stale: true,
          fresh: false,
        },
      });
    }
    if (endpoint === '/api/mt5-readonly/snapshot') {
      return jsonResponse(
        {
          error: 'snapshot_bridge_down',
          statusZh: 'MT5 dashboard 快照已过期',
        },
        503,
      );
    }
    if (endpoint === '/api/mt5-readonly-secondary/snapshot') {
      return jsonResponse({
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        snapshotFresh: false,
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          statusZh: 'Live16 dashboard 快照已过期',
        },
      });
    }
    if (endpoint === '/api/dashboard/state') {
      return jsonResponse({
        ok: true,
        usableEvidence: {
          researchFallbackReady: true,
          simEvidenceReady: true,
        },
      });
    }
    if (endpoint.includes('limit=500')) {
      return jsonResponse({ rows: [{ endpoint }] });
    }
    return jsonResponse({ ok: true, endpoint });
  };

  const state = await loadDashboardState();

  assert.equal(state.mt5.latest.trading.statusZh, 'MT5 dashboard 快照已过期');
  assert.equal(state.mt5.state.usableEvidence.researchFallbackReady, true);
  assert.equal(state.mt5.snapshot.ok, false);
  assert.equal(state.mt5.snapshot.error, 'snapshot_bridge_down');
  assert.equal(state.mt5.snapshot._api.endpoint, '/api/mt5-readonly/snapshot');
  assert.equal(state.mt5.snapshot._api.status, 503);
  assert.equal(state.mt5.secondarySnapshot.status, 'STALE_EA_SNAPSHOT');
  assert.equal(state.mt5.secondarySnapshot._api.endpoint, '/api/mt5-readonly-secondary/snapshot');
  assert.equal(state.hfmCrypto.ok, true);
  assert.equal(state.hfmCrypto.endpoint, '/api/hfm-crypto/status?view=summary&scope=secondary');
  assert.deepEqual(state.mt5.ledgers.shadowSignals, [{ endpoint: '/api/shadow/signals?limit=500' }]);
  assert.ok(calls.includes('/api/profit-target/status?scope=secondary'));
  assert.ok(calls.includes('/api/dashboard/state'));
  assert.ok(calls.includes('/api/mt5-readonly-secondary/snapshot'));
});
