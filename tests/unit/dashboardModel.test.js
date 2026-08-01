import { describe, expect, it } from 'vitest';
import {
  buildDashboardMetrics,
  buildAgentOpsItems,
  buildAgentOpsRows,
  buildDailyItems,
  buildDailyTodoRows,
  buildEndpointHealth,
  buildFrontendSnapshotRecoveryRows,
  buildOperatorOverviewBlockerRows,
  buildOperatorOverviewAxisItems,
  buildOperatorOverviewItems,
  buildOperatorOverviewSupportItems,
  buildSnapshotImpactSummary,
  buildSnapshotRootCauseBanner,
  normalizeDashboardSnapshot,
  resolveDashboardEvidenceState,
  resolveOperatorOverviewState,
} from '../../src/workspaces/dashboard/dashboardModel.js';

function freshPayload(equity = 1000) {
  return {
    ok: true,
    account: { equity },
    snapshotFresh: true,
    source: { fresh: true, ageSeconds: 2, maxAgeSeconds: 180 },
    _api: { ok: true },
  };
}

function disabledSecondaryPayload() {
  return {
    ok: true,
    status: 'DISABLED',
    optional: true,
    enabled: false,
    snapshotFresh: true,
    account: null,
    hostProcess: { status: 'DISABLED', terminalProcessDetected: false },
    _freshness: {
      status: 'DISABLED',
      fresh: true,
      stale: false,
      optional: true,
      enabled: false,
      blockers: [],
    },
    _api: { ok: true },
  };
}

function operatorOverview(overrides = {}) {
  const payload = {
    schema: 'quantgod.operator_overview.v1',
    generatedAt: '2026-08-01T12:00:00.000Z',
    mode: 'SHADOW_READONLY',
    service: { processAlive: true, serviceReady: true },
    canonicalDataRoot: { id: 'root-123456789abc', exists: true, resolved: '/private/runtime' },
    mt5: {
      writerFresh: true,
      writerAgeSeconds: 2,
      brokerConnected: true,
      brokerConnectionKnown: true,
      accountAuthorized: true,
      accountAuthorizationKnown: true,
      quoteFresh: true,
      quoteAgeSeconds: 2,
      marketSession: { state: 'OPEN', reasonCode: 'SESSION_OPEN' },
      monitorReady: true,
      tradingReady: false,
    },
    data: { history: { status: 'PASS', freshness: 'FRESH' }, ready: true },
    automation: { status: 'PASS', freshness: 'FRESH', ready: true },
    evidence: { production: { status: 'PASS', freshness: 'FRESH' }, ready: true },
    disk: { available: true, freeRatio: 0.5, status: 'PASS' },
    operationalReady: true,
    overallStatus: 'PASS',
    blockedReasons: [],
    safety: {
      advisoryOnly: true,
      executionLaneExists: false,
      orderSendAllowed: false,
      closeAllowed: false,
      cancelAllowed: false,
      liveExpansionAllowed: false,
      unattendedLiveExpansionAllowed: false,
      operatorApprovalRequired: true,
      mutatesMt5: false,
    },
    ...overrides,
  };
  return { ok: true, payload, _api: { ok: true, status: 200 } };
}

describe('Forex-only dashboard model', () => {
  it('accepts explicit fresh USDJPY MT5 evidence', () => {
    const snapshot = normalizeDashboardSnapshot({
      mt5Snapshot: freshPayload(1002),
      secondaryMt5Snapshot: freshPayload(998),
      usdJpyLiveLoop: { ok: true, status: 'PASS', _api: { ok: true } },
    });
    expect(snapshot.snapshotRecovery).toMatchObject({ status: 'ok' });
    expect(buildSnapshotRootCauseBanner(snapshot).status).toBe('ok');
    expect(buildDashboardMetrics(snapshot).find((item) => item.label === '主账号净值')?.value).toBe(1002);
  });

  it('does not let a disabled optional secondary account block the active primary account', () => {
    const raw = {
      mt5Snapshot: freshPayload(1002),
      secondaryMt5Snapshot: disabledSecondaryPayload(),
    };
    const snapshot = normalizeDashboardSnapshot(raw);

    expect(snapshot).toMatchObject({ secondaryEnabled: false, secondaryBlocked: false });
    expect(snapshot.snapshotRecovery).toMatchObject({ status: 'ok' });
    expect(buildSnapshotRootCauseBanner(snapshot)).toMatchObject({ status: 'ok' });
    expect(buildSnapshotRootCauseBanner(snapshot).rootCauseLine).toContain('第二账号未启用（可选）');
    expect(buildDashboardMetrics(snapshot).some((item) => item.label === '部署账号净值')).toBe(false);
    expect(
      buildEndpointHealth(raw).some((item) => item.endpoint === '/api/mt5-readonly-secondary/snapshot'),
    ).toBe(false);
  });

  it('fails closed when an account response lacks explicit success or freshness', () => {
    const snapshot = normalizeDashboardSnapshot({
      mt5Snapshot: { account: { equity: 9999 } },
      secondaryMt5Snapshot: freshPayload(),
    });
    const rootCause = buildSnapshotRootCauseBanner(snapshot);
    const metric = buildDashboardMetrics(snapshot).find((item) => item.label === '主账号净值');
    expect(snapshot.snapshotRecovery.status).toBe('blocked');
    expect(rootCause.status).toBe('blocked');
    expect(metric).toMatchObject({ value: '不可确认', status: 'blocked' });
  });

  it('exposes only Dashboard, MT5, and Evolution recovery lanes', () => {
    const snapshot = normalizeDashboardSnapshot({});
    const rows = buildFrontendSnapshotRecoveryRows(snapshot);
    expect(rows.map((row) => row.前端区域)).toEqual(['Dashboard', 'MT5', 'Evolution']);
    expect(buildSnapshotImpactSummary(snapshot)).toMatchObject({ status: 'blocked', p0Count: 2 });
  });

  it('marks invalid endpoint envelopes unavailable', () => {
    const endpoints = buildEndpointHealth({ latest: { ok: true, _api: { ok: true } } });
    expect(endpoints.find((item) => item.endpoint === '/api/latest')?.status).toBe('ok');
    expect(endpoints.find((item) => item.endpoint === '/api/mt5-readonly/snapshot')?.status).toBe('blocked');
  });

  it('does not show stale snapshot transport success as healthy', () => {
    const stale = {
      ok: true,
      snapshotFresh: false,
      source: { fresh: false, ageSeconds: 900, maxAgeSeconds: 180 },
      _api: { ok: true },
    };
    const endpoint = buildEndpointHealth({ mt5Snapshot: stale }).find(
      (item) => item.endpoint === '/api/mt5-readonly/snapshot',
    );
    expect(endpoint).toMatchObject({ status: 'blocked', value: '过期' });
  });

  it('never treats transport success as domain success when ok is false or status is blocked', () => {
    const rejected = {
      ok: false,
      status: 'BLOCKED',
      snapshotFresh: true,
      source: { fresh: true, ageSeconds: 2, maxAgeSeconds: 180 },
      _api: { ok: true },
    };
    const snapshot = normalizeDashboardSnapshot({
      latest: rejected,
      state: rejected,
      mt5Snapshot: rejected,
      secondaryMt5Snapshot: rejected,
      usdJpyLiveLoop: rejected,
      productionEvidenceValidation: rejected,
    });

    expect(snapshot.snapshotRecovery).toMatchObject({ status: 'blocked' });
    expect(
      buildDashboardMetrics(snapshot).find((item) => item.label === 'USDJPY Live Loop')?.status,
    ).not.toBe('ok');
    expect(buildEndpointHealth(snapshot.raw).every((item) => item.status === 'blocked')).toBe(true);
  });

  it('requires explicit transport and domain success together', () => {
    const endpointRows = buildEndpointHealth({
      latest: { ok: true, _api: { ok: false } },
      state: { ok: false, _api: { ok: true } },
      usdJpyLiveLoop: { ok: true, status: 'BLOCKED', _api: { ok: true } },
    });

    expect(endpointRows.find((item) => item.endpoint === '/api/latest')?.status).toBe('blocked');
    expect(endpointRows.find((item) => item.endpoint === '/api/dashboard/state')?.status).toBe('blocked');
    expect(endpointRows.find((item) => item.endpoint === '/api/usdjpy-strategy-lab/live-loop')?.status).toBe(
      'blocked',
    );
  });

  it('prioritizes overall BLOCKED over system WARN while preserving returned Agent checks', () => {
    const agentOpsHealth = {
      ok: false,
      overallStatus: 'BLOCKED',
      overallStatusZh: '自动化阻断',
      readinessStatus: 'BLOCKED',
      systemStatus: 'WARN',
      systemStatusZh: '系统警告',
      checks: [{ labelZh: '日报', status: 'FAIL', reasonZh: '日报未运行' }],
      blockers: [{ code: 'DAILY_NOT_RUN' }],
      _api: { ok: true, status: 200 },
    };

    expect(resolveDashboardEvidenceState(agentOpsHealth)).toMatchObject({
      transportOk: true,
      domainOk: false,
      code: 'BLOCKED',
      label: '自动化阻断',
      status: 'blocked',
    });
    expect(buildAgentOpsItems({ agentOpsHealth })[0]).toMatchObject({
      value: '自动化阻断',
      status: 'blocked',
    });
    expect(buildAgentOpsRows({ agentOpsHealth })).toEqual([
      { 检查: '日报', 状态: '失败', 说明: '日报未运行' },
    ]);
  });

  it('surfaces nested FAIL and NOT_RUN business states even when HTTP transport succeeded', () => {
    const production = {
      ok: true,
      report: { status: 'FAIL' },
      _api: { ok: true, status: 200 },
    };
    const automation = {
      ok: true,
      payload: { state: 'NOT_RUN', stateZh: '尚未运行' },
      _api: { ok: true, status: 200 },
    };

    expect(resolveDashboardEvidenceState(production)).toMatchObject({
      code: 'FAIL',
      status: 'blocked',
    });
    expect(resolveDashboardEvidenceState(automation)).toMatchObject({
      code: 'NOT_RUN',
      label: '尚未运行',
      status: 'blocked',
    });
    expect(
      buildEndpointHealth({ productionEvidenceValidation: production }).find(
        (item) => item.endpoint === '/api/production-evidence-validation/status',
      ),
    ).toMatchObject({ status: 'blocked', value: '失败' });
  });

  it('does not use the retired daily-autopilot payload in current dashboard conclusions', () => {
    const raw = {
      dailyAutopilot: {
        status: 'PASS',
        dailyTodo: [{ title: '过期任务' }],
      },
    };
    const snapshot = normalizeDashboardSnapshot(raw);

    expect(snapshot).not.toHaveProperty('dailyAutopilot');
    expect(buildDailyItems(snapshot)[0].value).toBe('等待日报证据');
    expect(buildDailyTodoRows(raw)).toEqual([]);
  });

  it('uses the aggregate overview as homepage truth while keeping weekend quote closure neutral', () => {
    const overview = operatorOverview({
      operationalReady: false,
      overallStatus: 'BLOCKED',
      blockedReasons: ['AUTOMATION_NOT_RUN_FRESH', 'EVIDENCE_FAIL_FRESH'],
      mt5: {
        ...operatorOverview().payload.mt5,
        quoteFresh: false,
        marketSession: { state: 'CLOSED', reasonCode: 'WEEKEND' },
      },
      automation: { status: 'NOT_RUN', freshness: 'FRESH', ready: false },
      evidence: { production: { status: 'FAIL', freshness: 'FRESH' }, ready: false },
    });
    const snapshot = normalizeDashboardSnapshot({ operatorOverview: overview });
    const items = buildOperatorOverviewItems(snapshot);

    expect(snapshot.snapshotRecovery.status).toBe('ok');
    expect(buildSnapshotRootCauseBanner(snapshot)).toMatchObject({ status: 'blocked' });
    expect(buildSnapshotRootCauseBanner(snapshot).rootCauseLine).toContain('自动化链未就绪');
    expect(items.find((item) => item.label === '券商连接')).toMatchObject({ status: 'ok' });
    expect(items.find((item) => item.label === '报价新鲜度')).toMatchObject({
      value: 'MARKET_CLOSED',
      status: 'warn',
    });
    expect(items.find((item) => item.label === '交易执行就绪')).toMatchObject({
      value: 'false · Shadow / ReadOnly',
      status: 'warn',
    });
    expect(buildOperatorOverviewBlockerRows(snapshot)).toHaveLength(2);
    expect(buildFrontendSnapshotRecoveryRows(snapshot).map((row) => row.修复优先级)).toEqual([
      'P0',
      'P2',
      'P2',
    ]);
  });

  it('accepts a valid PASS overview as the aggregate homepage state', () => {
    const snapshot = normalizeDashboardSnapshot({ operatorOverview: operatorOverview() });

    expect(resolveOperatorOverviewState(operatorOverview())).toMatchObject({ valid: true, status: 'ok' });
    expect(buildSnapshotRootCauseBanner(snapshot)).toMatchObject({
      status: 'ok',
      label: '统一状态 · 通过',
    });
    expect(buildOperatorOverviewBlockerRows(snapshot)).toEqual([]);
    expect(buildOperatorOverviewAxisItems(snapshot)).toHaveLength(6);
    expect(buildOperatorOverviewSupportItems(snapshot).length).toBeGreaterThanOrEqual(6);
    expect(buildDashboardMetrics(snapshot).find((item) => item.label === 'USDJPY 当前持仓')).toMatchObject({
      value: '诊断明细加载中',
      status: 'warn',
    });
  });

  it('does not let healthy detail endpoints mask an overview request failure or malformed payload', () => {
    const failed = {
      ok: false,
      error: 'HTTP 503',
      _api: { ok: false, status: 503, error: { message: 'HTTP 503' } },
    };
    const failedSnapshot = normalizeDashboardSnapshot({
      operatorOverview: failed,
      mt5Snapshot: freshPayload(),
    });
    const malformed = operatorOverview();
    delete malformed.payload.mt5;

    expect(buildSnapshotRootCauseBanner(failedSnapshot)).toMatchObject({ status: 'blocked' });
    expect(buildOperatorOverviewItems(failedSnapshot)[0]).toMatchObject({ status: 'blocked' });
    expect(resolveOperatorOverviewState(malformed)).toMatchObject({
      valid: false,
      code: 'INVALID_OPERATOR_OVERVIEW',
      status: 'blocked',
    });
  });

  it('keeps stale detailed MT5 evidence blocked even when the aggregate writer axis is fresh', () => {
    const stale = {
      ok: true,
      snapshotFresh: false,
      source: { fresh: false, ageSeconds: 900, maxAgeSeconds: 180 },
      _api: { ok: true },
    };
    const endpoint = buildEndpointHealth({
      operatorOverview: operatorOverview(),
      mt5Snapshot: stale,
    }).find((item) => item.endpoint === '/api/mt5-readonly/snapshot');

    expect(endpoint).toMatchObject({ status: 'blocked', value: '过期' });
  });
});
