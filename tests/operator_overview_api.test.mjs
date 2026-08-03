import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  loadDashboardReadonlyRefresh,
  loadDashboardWorkspaceCore,
  loadOperatorOverview,
  loadSnapshotHealthCore,
} from '../src/services/domainApi.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function overviewPayload() {
  return {
    ok: true,
    endpoint: '/api/operator/overview',
    payload: {
      schema: 'quantgod.operator_overview.v1',
      overallStatus: 'PASS',
      operationalReady: true,
      service: {},
      canonicalDataRoot: {},
      mt5: {},
      data: {},
      automation: {},
      evidence: {},
      disk: {},
      safety: {},
    },
  };
}

test('operator overview is the only first-paint dashboard request', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse(overviewPayload());
  };

  const direct = await loadOperatorOverview();
  const dashboard = await loadDashboardWorkspaceCore();
  const strip = await loadSnapshotHealthCore();

  assert.deepEqual(calls, ['/api/operator/overview', '/api/operator/overview', '/api/operator/overview']);
  assert.equal(direct._api.ok, true);
  assert.equal(dashboard.operatorOverview.payload.overallStatus, 'PASS');
  assert.equal(strip.operatorOverview._api.endpoint, '/api/operator/overview');
  assert.deepEqual(Object.keys(dashboard), ['operatorOverview']);
  assert.deepEqual(Object.keys(strip), ['operatorOverview']);
});

test('operator overview HTTP failures remain explicit blocked envelopes', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'overview_not_available' }, 503);

  const state = await loadDashboardWorkspaceCore();

  assert.equal(state.operatorOverview.ok, false);
  assert.equal(state.operatorOverview._api.ok, false);
  assert.equal(state.operatorOverview._api.status, 503);
  assert.equal(state.operatorOverview.payload, undefined);
  assert.notEqual(state.operatorOverview.overallStatus, 'PASS');
});

test('dashboard readonly refresh loads only aggregate and two MT5 snapshots', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return jsonResponse({ ok: true, status: 'EA_SNAPSHOT', snapshotFresh: true });
  };

  const state = await loadDashboardReadonlyRefresh();

  assert.deepEqual(calls.sort(), [
    '/api/mt5-readonly-secondary/snapshot',
    '/api/mt5-readonly/snapshot',
    '/api/operator/overview',
  ]);
  assert.deepEqual(Object.keys(state).sort(), ['mt5Snapshot', 'operatorOverview', 'secondaryMt5Snapshot']);
});
