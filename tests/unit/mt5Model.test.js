import { describe, expect, it } from 'vitest';

import {
  buildCloseHistoryRows,
  buildEndpointHealth,
  buildMt5AccountCards,
  buildMt5ConnectionItems,
  buildMt5CoreMetrics,
  buildMt5Metrics,
  buildMt5PrimaryAxisItems,
  buildMt5ExecutionFeedbackRows,
  buildMt5SimulationItems,
  buildMt5ShadowBlockerRows,
  buildMt5ShadowEquityRows,
  buildMt5ShadowSummary,
  buildMt5ShadowTradeRows,
  buildMt5SnapshotRecoveryRows,
  buildMt5SnapshotRootCauseBanner,
  buildMt5EvidenceOsLiteItems,
  buildSafetyItems,
  buildSecondaryAccountItems,
  buildMt5TodoRows,
  buildMt5ReviewRows,
  buildOrderRows,
  buildPositionRows,
  buildRsiEntryDiagnosticRows,
  buildUsdJpyLiveLoopItems,
  buildTradeJournalRows,
  buildUnclosedEntryRows,
  normalizeMt5Snapshot,
  resolveMt5ReadonlyConnectionSummary,
} from '../../src/workspaces/mt5/mt5Model.js';

const TRUSTED_RUNTIME = Object.freeze({
  processRunning: true,
  gmtTime: '2026.07.30 12:00:00',
  tickAgeSeconds: 2,
  executionEnabled: true,
  livePilotMode: true,
  tradeAllowed: true,
  terminalTradeAllowed: true,
  programTradeAllowed: true,
  accountTradeAllowed: true,
  accountExpertTradeAllowed: true,
  focusSymbolTradeAllowed: true,
  pilotKillSwitch: false,
  pilotStartupEntryGuardActive: false,
});

function withTrustedMt5Connections(payload = {}) {
  const freshness = { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false };
  const accountFor = (login) => ({
    ok: true,
    status: 'CONNECTED',
    snapshotFresh: true,
    _freshness: freshness,
    account: { login, server: 'Synthetic-Demo' },
  });
  const snapshotFor = (login, extra = {}) => ({
    ok: true,
    snapshotFresh: true,
    _freshness: freshness,
    ...extra,
    runtime: { ...TRUSTED_RUNTIME, ...(extra.runtime || {}) },
    account: { login, server: 'Synthetic-Demo', ...(extra.account || {}) },
  });

  return {
    ...payload,
    account: accountFor('90000001'),
    snapshot: snapshotFor('90000001', payload.snapshot),
    secondaryAccount: accountFor('90000002'),
    secondarySnapshot: snapshotFor('90000002', payload.secondarySnapshot),
  };
}

describe('mt5Model ledgers', () => {
  it('treats a disabled optional secondary lane as out of scope instead of unavailable', () => {
    const disabledSecondary = {
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
    const primary = withTrustedMt5Connections({
      secondaryAccount: disabledSecondary,
      secondarySnapshot: disabledSecondary,
      accountProfiles: {
        profiles: {
          profiles: [
            { profileId: 'primary', role: 'primary', accountLogin: '90000001' },
            { profileId: 'secondary-live16', role: 'secondary', accountLogin: '90000002' },
          ],
        },
      },
    });
    primary.secondaryAccount = disabledSecondary;
    primary.secondarySnapshot = disabledSecondary;
    const snapshot = normalizeMt5Snapshot(primary);

    expect(snapshot.secondaryEnabled).toBe(false);
    expect(snapshot.accountConnections).toHaveLength(1);
    expect(snapshot.accountSlots).toHaveLength(2);
    expect(snapshot.accountProfiles).toHaveLength(2);
    expect(buildMt5AccountCards(snapshot)).toHaveLength(2);
    expect(buildMt5AccountCards(snapshot)[1]).toMatchObject({
      role: 'secondary',
      status: 'warn',
      statusLabel: '未启用（可选）',
    });
    expect(buildMt5Metrics(snapshot).find((item) => item.label === '第二账号 EA')).toMatchObject({
      value: '未启用（可选）',
      status: 'warn',
    });
    expect(buildMt5Metrics(snapshot).find((item) => item.label === '第二账号净值')).toMatchObject({
      value: '未启用',
      status: 'warn',
    });
    expect(buildMt5SnapshotRecoveryRows(snapshot)).toHaveLength(2);
    expect(buildMt5SnapshotRecoveryRows(snapshot)[1]).toMatchObject({
      状态: '未启用（可选）',
      可信范围: expect.stringContaining('不参与 active readiness'),
    });
    expect(buildSecondaryAccountItems(snapshot)[0]).toMatchObject({
      label: '槽位状态',
      value: '未启用（可选）',
      status: 'warn',
    });
    expect(buildMt5ConnectionItems(snapshot).find((item) => item.label === '第二账号状态')).toMatchObject({
      value: '未启用（可选）',
      status: 'warn',
    });
    expect(
      resolveMt5ReadonlyConnectionSummary(snapshot, {
        writerFresh: true,
        brokerConnectionKnown: true,
        brokerConnected: true,
        accountAuthorizationKnown: true,
        accountAuthorized: true,
        monitorReady: true,
      }),
    ).toMatchObject({
      healthy: true,
      secondaryState: 'DISABLED',
      bannerStatus: 'ok',
      bannerLabel: '主账号已连接 · 第二账号未启用',
    });
    expect(buildMt5SnapshotRootCauseBanner(snapshot)).toMatchObject({ status: 'ok' });
    expect(
      buildEndpointHealth(primary).some((item) => item.endpoint.includes('mt5-readonly-secondary')),
    ).toBe(false);
  });

  it('keeps a healthy primary partially available while surfacing a disconnected secondary account', () => {
    const unavailableSecondary = {
      ok: false,
      status: 'UNAVAILABLE',
      snapshotFresh: false,
      _freshness: {
        status: 'UNAVAILABLE',
        fresh: false,
        stale: false,
        unavailable: true,
      },
    };
    const raw = withTrustedMt5Connections();
    raw.secondaryAccount = unavailableSecondary;
    raw.secondarySnapshot = unavailableSecondary;
    const snapshot = normalizeMt5Snapshot(raw);
    const canonicalMt5 = {
      writerFresh: true,
      brokerConnectionKnown: true,
      brokerConnected: true,
      accountAuthorizationKnown: true,
      accountAuthorized: true,
      monitorReady: true,
    };
    const summary = resolveMt5ReadonlyConnectionSummary(snapshot, canonicalMt5);

    expect(snapshot.secondaryEnabled).toBe(true);
    expect(summary).toMatchObject({
      primaryHealthy: true,
      secondaryHealthy: false,
      secondaryState: 'DISCONNECTED',
      healthy: false,
      partiallyAvailable: true,
      bannerStatus: 'warn',
      bannerLabel: '主账号只读可用 · 第二账号未连接',
      runtimeStatus: 'warn',
      runtimeLabel: '部分可用 · 主账号 Shadow / ReadOnly 正常 · 第二账号未连接',
    });
  });

  it('reports two independently healthy readonly accounts as connected', () => {
    const snapshot = normalizeMt5Snapshot(withTrustedMt5Connections());
    const summary = resolveMt5ReadonlyConnectionSummary(snapshot, {
      writerFresh: true,
      brokerConnectionKnown: true,
      brokerConnected: true,
      accountAuthorizationKnown: true,
      accountAuthorized: true,
      monitorReady: true,
    });

    expect(snapshot.accountConnections).toHaveLength(2);
    expect(summary).toMatchObject({
      primaryHealthy: true,
      secondaryHealthy: true,
      secondaryState: 'CONNECTED',
      healthy: true,
      bannerStatus: 'ok',
      bannerLabel: '双账号只读连接正常',
    });
    expect(buildMt5SnapshotRootCauseBanner(snapshot)).toMatchObject({
      status: 'ok',
      label: '实时快照新鲜',
      title: 'MT5 当前账号快照可用于只读观察',
    });
  });

  it('distinguishes a fresh secondary writer from successful Broker authorization', () => {
    const disconnectedSecondary = {
      ok: true,
      status: 'ACCOUNT_AVAILABLE_NOT_CONNECTED',
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      terminal: {
        connected: false,
        lastAuthFailure: { reason: 'Invalid account' },
      },
      connection: {
        semantics: 'EXPLICIT_CONNECTION_EVIDENCE_V2',
        accountIdentityPresent: true,
        brokerSessionConnected: false,
        accountAuthorized: false,
        writerFresh: true,
        processRunning: true,
        readReady: false,
      },
      runtime: {
        ...TRUSTED_RUNTIME,
        connected: false,
        terminalConnected: false,
        accountAuthorized: false,
        shadowMode: true,
        readOnlyMode: true,
      },
      account: {
        loginMasked: '••••0002',
        server: 'SyntheticBroker-Live16',
        currency: 'USD',
        equity: 998.25,
        balance: 1000,
      },
    };
    const raw = withTrustedMt5Connections();
    raw.snapshot.account = {
      ...raw.snapshot.account,
      currency: 'USC',
      equity: 10020.5,
      balance: 10000,
    };
    raw.secondaryAccount = disconnectedSecondary;
    raw.secondarySnapshot = disconnectedSecondary;
    const snapshot = normalizeMt5Snapshot(raw);
    const secondaryCard = buildMt5AccountCards(snapshot)[1];
    const rootCause = buildMt5SnapshotRootCauseBanner(snapshot);
    const recoveryRows = buildMt5SnapshotRecoveryRows(snapshot);
    const coreMetrics = buildMt5CoreMetrics(snapshot);

    expect(snapshot.secondaryConnection.login).toBe('••••0002');
    expect(snapshot.secondaryConnection).toMatchObject({
      accountIdentityPresent: true,
      brokerConnected: false,
      accountAuthorized: false,
      connected: false,
      readReady: false,
    });
    expect(secondaryCard.statusLabel).toBe('经纪商未连接');
    expect(secondaryCard.items.find((item) => item.label === '本地身份授权')).toMatchObject({
      value: '已登记 / Broker 未验证',
      status: 'blocked',
    });
    expect(buildMt5ConnectionItems(snapshot).find((item) => item.label === '第二账号状态')).toMatchObject({
      value: '已启用 / 未连接',
      status: 'blocked',
      hint: expect.stringContaining('Invalid account'),
    });
    expect(rootCause).toMatchObject({
      status: 'warn',
      label: '主账号可复核 · 第二账号未连接',
      title: '主账号可用于只读复核，第二账号当前不可确认',
    });
    expect(rootCause.rootCauseLine).toContain('第二账号：Broker 未连接');
    expect(rootCause.blockedLine).toContain('双账号合计');
    expect(rootCause.usableLine).toContain('主账号余额、净值');
    expect(rootCause.nextAction).toContain('恢复第二账号 Broker 登录与授权');
    expect(recoveryRows[1]).toMatchObject({
      状态: 'Broker 未连接',
      可信范围: expect.stringContaining('当前净值、余额、持仓、挂单和 EA 权限不可确认'),
    });
    for (const label of ['当前持仓', '净值', '余额']) {
      expect(secondaryCard.items.find((item) => item.label === label)).toMatchObject({
        value: '不可确认',
        status: 'blocked',
      });
    }
    expect(coreMetrics.find((item) => item.label === '余额')).toMatchObject({
      value: '10000.00 USC',
    });
    expect(coreMetrics.find((item) => item.label === '净值')).toMatchObject({
      value: '10020.50 USC',
    });
    for (const label of ['持仓', '挂单']) {
      expect(coreMetrics.find((item) => item.label === label)).toMatchObject({
        value: '不可确认',
        status: 'blocked',
      });
    }
  });

  it('fails closed on contradictory or unknown connection evidence', () => {
    const contradictory = withTrustedMt5Connections({
      secondarySnapshot: {
        connection: {
          semantics: 'EXPLICIT_CONNECTION_EVIDENCE_V2',
          brokerSessionConnected: false,
          accountAuthorized: true,
          writerFresh: true,
          processRunning: true,
          readReady: true,
        },
      },
    });
    contradictory.secondaryAccount = contradictory.secondarySnapshot;
    const contradictorySnapshot = normalizeMt5Snapshot(contradictory);
    expect(contradictorySnapshot.secondaryConnection).toMatchObject({
      brokerConnected: false,
      readReady: false,
    });
    expect(buildMt5SnapshotRootCauseBanner(contradictorySnapshot)).toMatchObject({ status: 'warn' });

    const unknown = withTrustedMt5Connections();
    const unknownSecondary = {
      ok: true,
      status: 'EA_SNAPSHOT',
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      account: { login: '90000002', server: 'SyntheticBroker-Demo16' },
    };
    unknown.secondaryAccount = unknownSecondary;
    unknown.secondarySnapshot = unknownSecondary;
    const unknownSnapshot = normalizeMt5Snapshot(unknown);
    expect(unknownSnapshot.secondaryConnection.connectionEvidenceKnown).toBe(false);
    expect(buildMt5SnapshotRecoveryRows(unknownSnapshot)[1]).toMatchObject({
      状态: '连接证据未知',
      可信范围: expect.stringContaining('不可确认'),
    });
    expect(buildMt5SnapshotRootCauseBanner(unknownSnapshot)).toMatchObject({ status: 'warn' });
  });

  it('keeps a primary connection failure globally blocked even when the secondary is healthy', () => {
    const raw = withTrustedMt5Connections();
    const disconnectedPrimary = {
      ...raw.account,
      connection: {
        semantics: 'EXPLICIT_CONNECTION_EVIDENCE_V2',
        brokerSessionConnected: false,
        accountAuthorized: false,
        writerFresh: true,
        processRunning: true,
        readReady: false,
      },
      runtime: { ...TRUSTED_RUNTIME, connected: false, accountAuthorized: false },
    };
    raw.account = disconnectedPrimary;
    raw.snapshot = disconnectedPrimary;
    const snapshot = normalizeMt5Snapshot(raw);

    expect(buildMt5SnapshotRootCauseBanner(snapshot)).toMatchObject({
      status: 'blocked',
      label: '主账号当前状态已阻断',
      title: 'MT5 当前账号快照不能当作实时状态',
    });
    expect(resolveMt5ReadonlyConnectionSummary(snapshot)).toMatchObject({
      primaryHealthy: false,
      bannerStatus: 'blocked',
    });
  });

  it('drops historical authorization failures after explicit Broker recovery', () => {
    const recoveredSecondary = {
      ok: true,
      status: 'CONNECTED',
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      terminal: {
        connected: true,
        lastAuthFailure: { reason: 'Invalid account', message: 'authorization failed: Invalid account' },
        lastAuthorization: { server: 'SyntheticBroker-Live16' },
      },
      connection: {
        accountIdentityPresent: true,
        brokerSessionConnected: true,
        accountAuthorized: true,
        writerFresh: true,
        processRunning: true,
      },
      runtime: {
        ...TRUSTED_RUNTIME,
        connected: true,
        terminalConnected: true,
        brokerConnected: true,
        accountAuthorized: true,
        shadowMode: true,
        readOnlyMode: true,
      },
      account: { loginMasked: '••••0002', server: 'SyntheticBroker-Live16' },
      pythonBridgeError: 'optional Python bridge unavailable',
    };
    const raw = withTrustedMt5Connections();
    raw.secondaryAccount = recoveredSecondary;
    raw.secondarySnapshot = recoveredSecondary;
    const snapshot = normalizeMt5Snapshot(raw);
    const secondaryCard = buildMt5AccountCards(snapshot)[1];

    expect(snapshot.secondaryConnection).toMatchObject({
      connected: true,
      brokerConnected: true,
      accountIdentityPresent: true,
      accountAuthorized: true,
      writerFresh: true,
      error: '',
    });
    expect(secondaryCard.note).not.toContain('Invalid account');
    expect(secondaryCard.note).not.toContain('Python bridge');
    expect(secondaryCard.items.find((item) => item.label === 'Broker 连接')).toMatchObject({
      value: '已连接',
      status: 'ok',
    });
    expect(secondaryCard.items.find((item) => item.label === '本地身份授权')).toMatchObject({
      value: '已授权',
      status: 'ok',
    });
  });

  it('labels a connected Shadow / ReadOnly account as observation instead of missing permissions', () => {
    const disabledSecondary = {
      ok: true,
      status: 'DISABLED',
      optional: true,
      enabled: false,
      snapshotFresh: true,
      account: null,
      _freshness: {
        status: 'DISABLED',
        fresh: true,
        stale: false,
        optional: true,
        enabled: false,
        blockers: [],
      },
    };
    const raw = withTrustedMt5Connections({
      snapshot: {
        runtime: {
          executionEnabled: false,
          livePilotMode: false,
          tradeAllowed: false,
          shadowMode: true,
          readOnlyMode: true,
        },
      },
    });
    raw.secondaryAccount = disabledSecondary;
    raw.secondarySnapshot = disabledSecondary;

    const snapshot = normalizeMt5Snapshot(raw);
    expect(buildMt5AccountCards(snapshot)[0]).toMatchObject({
      statusLabel: 'Shadow / 只读观察',
    });
    expect(buildMt5PrimaryAxisItems(snapshot)).toHaveLength(6);
    expect(buildMt5PrimaryAxisItems(snapshot).find((item) => item.label === '影子观察状态')).toMatchObject({
      value: 'Shadow / ReadOnly（无执行通道）',
      status: 'warn',
    });
    expect(buildMt5CoreMetrics(snapshot).map((item) => item.label)).toEqual(['余额', '净值', '持仓', '挂单']);
  });

  it('never treats a fresh writer snapshot as broker connectivity or account authorization', () => {
    const snapshot = normalizeMt5Snapshot({
      account: {
        ok: true,
        snapshotFresh: true,
        _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
        account: { login: '90000001', server: 'Synthetic-Demo' },
      },
      snapshot: {
        ok: true,
        snapshotFresh: true,
        _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
        runtime: { gmtTime: '2026.07.30 12:00:00', tickAgeSeconds: 2 },
        account: { login: '90000001', server: 'Synthetic-Demo' },
      },
      secondaryAccount: {
        ok: true,
        status: 'DISABLED',
        optional: true,
        enabled: false,
        snapshotFresh: true,
      },
      secondarySnapshot: {
        ok: true,
        status: 'DISABLED',
        optional: true,
        enabled: false,
        snapshotFresh: true,
      },
    });

    expect(snapshot.primaryConnection).toMatchObject({
      brokerConnected: false,
      accountAuthorized: false,
      writerFresh: true,
      quoteFresh: true,
      marketSession: 'MARKET_OPEN',
      tradingReady: false,
      connected: false,
    });
  });

  it('shows MARKET_CLOSED on weekends without leaking frozen spread READY or HARD_WIDE states', () => {
    const snapshot = normalizeMt5Snapshot(
      withTrustedMt5Connections({
        snapshot: {
          runtime: { gmtTime: '2026.08.01 13:16:27', tickAgeSeconds: 58586 },
          usdJpyRsiEntryDiagnostics: {
            state: 'READY',
            stateZh: '准备完成',
            guards: { sessionOpen: true, spreadAllowed: false },
          },
        },
        secondarySnapshot: {
          runtime: { gmtTime: '2026.08.01 13:16:27', tickAgeSeconds: 58586 },
        },
        usdJpyLiveLoop: {
          state: 'READY',
          stateZh: '准备完成',
          policy: {
            spreadGate: { tier: 'HARD_WIDE', hardBlock: true, spreadPips: 5 },
          },
        },
      }),
    );
    const rendered = JSON.stringify([
      buildUsdJpyLiveLoopItems(snapshot),
      buildRsiEntryDiagnosticRows(snapshot),
      buildMt5AccountCards(snapshot),
    ]);

    expect(snapshot.primaryConnection).toMatchObject({
      brokerConnected: true,
      accountAuthorized: true,
      writerFresh: true,
      quoteFresh: false,
      marketSession: 'MARKET_CLOSED',
      tradingReady: false,
    });
    expect(snapshot).toMatchObject({ marketSession: 'MARKET_CLOSED', eaTradeReady: false });
    expect(buildUsdJpyLiveLoopItems(snapshot).every((item) => item.status === 'warn')).toBe(true);
    expect(rendered).toContain('MARKET_CLOSED');
    expect(rendered).not.toContain('HARD_WIDE');
    expect(rendered).not.toContain('准备完成');
  });

  it('fails closed when any MT5 permission or guard evidence is missing', () => {
    const account = {
      ok: true,
      status: 'CONNECTED',
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      account: { login: '90000001', server: 'Synthetic-Demo' },
    };
    const incompleteSnapshot = {
      ok: true,
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      runtime: { executionEnabled: true, livePilotMode: true, tradeAllowed: true },
      account: account.account,
    };
    const snapshot = normalizeMt5Snapshot({
      account,
      snapshot: incompleteSnapshot,
      secondaryAccount: { ...account, account: { ...account.account, login: '90000002' } },
      secondarySnapshot: {
        ...incompleteSnapshot,
        account: { ...account.account, login: '90000002' },
      },
    });

    expect(snapshot.dualAccountAutoEnabled).toBe(false);
    expect(snapshot.dualAccountEntryReady).toBe(false);
    expect(snapshot.eaTradeReady).toBe(false);
    expect(
      buildMt5AccountCards(snapshot)[0].items.find((item) => item.label === 'MT5 权限证据'),
    ).toMatchObject({
      value: '证据不完整 / 已阻断',
      status: 'blocked',
    });
    expect(buildSafetyItems(snapshot).find((item) => item.label === '熔断保护')).toMatchObject({
      value: '状态未知 / 已阻断',
      status: 'blocked',
    });
  });

  it('requires every explicit permission true and both guards false before readiness can pass', () => {
    const runtime = {
      gmtTime: '2026.07.30 12:00:00',
      tickAgeSeconds: 2,
      executionEnabled: true,
      livePilotMode: true,
      tradeAllowed: true,
      terminalTradeAllowed: true,
      programTradeAllowed: true,
      accountTradeAllowed: true,
      accountExpertTradeAllowed: true,
      focusSymbolTradeAllowed: true,
      pilotKillSwitch: false,
      pilotStartupEntryGuardActive: false,
    };
    const accountFor = (login) => ({
      ok: true,
      status: 'CONNECTED',
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      account: { login, server: 'Synthetic-Demo' },
    });
    const snapshotFor = (login, overrides = {}) => ({
      ok: true,
      snapshotFresh: true,
      _freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
      runtime: { ...runtime, ...overrides },
      account: { login, server: 'Synthetic-Demo' },
    });
    const ready = normalizeMt5Snapshot({
      account: accountFor('90000001'),
      snapshot: snapshotFor('90000001'),
      secondaryAccount: accountFor('90000002'),
      secondarySnapshot: snapshotFor('90000002'),
    });
    const blocked = normalizeMt5Snapshot({
      account: accountFor('90000001'),
      snapshot: snapshotFor('90000001', { focusSymbolTradeAllowed: false }),
      secondaryAccount: accountFor('90000002'),
      secondarySnapshot: snapshotFor('90000002'),
    });

    expect(ready.dualAccountAutoEnabled).toBe(true);
    expect(ready.dualAccountEntryReady).toBe(true);
    expect(ready.eaTradeReady).toBe(true);
    expect(buildMt5AccountCards(ready)[0].items.find((item) => item.label === 'MT5 权限证据')).toMatchObject({
      value: '已观测（不构成执行授权）',
      status: 'ok',
    });
    expect(blocked.dualAccountAutoEnabled).toBe(false);
    expect(
      buildMt5AccountCards(blocked)[0].items.find((item) => item.label === 'MT5 权限证据'),
    ).toMatchObject({
      value: '证据有阻断',
      status: 'blocked',
    });
  });

  it('shows the newest trade journal rows first even when the CSV is oldest-first', () => {
    const tradeJournal = Array.from({ length: 44 }, (_, index) => ({
      EventTime: `2026.04.23 ${String(index % 24).padStart(2, '0')}:00`,
      EventType: 'ENTRY',
      Symbol: 'USDJPYc',
      NetProfit: '0.00',
      PositionId: String(index),
    }));
    tradeJournal[42] = {
      EventTime: '2026.05.04 08:00',
      EventType: 'ENTRY',
      Symbol: 'USDJPYc',
      NetProfit: '0.00',
      PositionId: '587641897',
    };
    tradeJournal[43] = {
      EventTime: '2026.05.04 08:19',
      EventType: 'EXIT',
      Symbol: 'USDJPYc',
      NetProfit: '0.06',
      PositionId: '587641897',
    };

    const rows = buildTradeJournalRows({ tradeJournal });

    expect(rows).toHaveLength(44);
    expect(rows[0]).toMatchObject({ 时间: '2026.05.04 08:19', 事件: 'EXIT', 净盈亏: '0.06' });
    expect(rows[1]).toMatchObject({ 时间: '2026.05.04 08:00', 事件: 'ENTRY' });
  });

  it('keeps close history latest-first when files are already latest-first', () => {
    const closeHistory = [
      { CloseTime: '2026.05.04 08:19', Symbol: 'USDJPYc', NetProfit: '0.06' },
      { CloseTime: '2026.05.01 12:30', Symbol: 'USDJPYc', NetProfit: '0.52' },
      { CloseTime: '2026.04.29 15:05', Symbol: 'USDJPYc', NetProfit: '-0.55' },
    ];

    const rows = buildCloseHistoryRows({ closeHistory });

    expect(rows[0]).toMatchObject({ 平仓时间: '2026.05.04 08:19', 净盈亏: '0.06' });
    expect(rows[1]).toMatchObject({ 平仓时间: '2026.05.01 12:30', 净盈亏: '0.52' });
  });

  it('keeps full broker trade history instead of hiding non-focus manual records', () => {
    const snapshot = normalizeMt5Snapshot({
      account: { account: { login: '90000001', server: 'SyntheticBroker-Demo12' } },
      secondaryAccount: { account: { login: '90000002', server: 'SyntheticBroker-Demo16' } },
      closeHistory: [
        { CloseTime: '2026.05.11 08:52', Symbol: 'XAUUSDc', NetProfit: '13.19', Strategy: 'Manual/Other' },
        { CloseTime: '2026.05.11 08:20', Symbol: 'EURUSDc', NetProfit: '-0.12', Strategy: 'Manual/Other' },
        { CloseTime: '2026.05.11 08:10', Symbol: 'USDJPYc', NetProfit: '0.22', Strategy: 'RSI_Reversal' },
      ],
      secondaryCloseHistory: [
        { CloseTime: '2026.05.11 08:55', Symbol: 'USDJPY', NetProfit: '0.18', Strategy: 'RSI_Reversal' },
      ],
      tradeJournal: [
        { EventTime: '2026.05.11 08:52', EventType: 'EXIT', Symbol: 'XAUUSDc', NetProfit: '13.19' },
        { EventTime: '2026.05.11 08:10', EventType: 'ENTRY', Symbol: 'USDJPYc', NetProfit: '0.00' },
      ],
      secondaryTradeJournal: [
        { EventTime: '2026.05.11 08:55', EventType: 'EXIT', Symbol: 'USDJPY', NetProfit: '0.18' },
      ],
    });

    expect(buildCloseHistoryRows(snapshot).map((row) => row.品种)).toEqual([
      'USDJPY',
      'XAUUSDc',
      'EURUSDc',
      'USDJPYc',
    ]);
    expect(buildCloseHistoryRows(snapshot)[0].账户).toBe('第二账号 ••••0002');
    expect(buildTradeJournalRows(snapshot).map((row) => row.品种)).toEqual(['USDJPY', 'XAUUSDc', 'USDJPYc']);
    expect(buildTradeJournalRows(snapshot)[0].账户).toBe('第二账号 ••••0002');
  });

  it('labels MT5 account cards as cent learning and USD deployment lanes', () => {
    const snapshot = normalizeMt5Snapshot(
      withTrustedMt5Connections({
        usdJpyLiveLoop: {
          accountRegistry: {
            accounts: [
              {
                accountAlias: 'hfm_cent',
                accountMode: 'cent',
                laneZh: '美分账户学习车道',
                purposeZh: '收集真实小仓执行样本',
                allowedEntryModes: ['OPPORTUNITY_ENTRY', 'STANDARD_ENTRY'],
              },
              {
                accountAlias: 'hfm_usd',
                accountMode: 'standard_usd',
                laneZh: '美元账户部署车道',
                purposeZh: '只部署已验证结构',
                allowedEntryModes: ['STANDARD_ENTRY'],
              },
            ],
          },
          policy: {
            accountLanePolicy: {
              centLive: {
                accountMode: 'cent',
                laneZh: '美分账户学习车道',
                allowedEntryModes: ['OPPORTUNITY_ENTRY', 'STANDARD_ENTRY'],
              },
              usdDeployment: {
                accountMode: 'standard_usd',
                laneZh: '美元账户部署车道',
                allowedEntryModes: ['STANDARD_ENTRY'],
              },
            },
            spreadGate: {
              spreadPips: 2.3,
              tier: 'SOFT_WIDE',
              tierZh: '轻微偏宽',
              normalLimitPips: 2.2,
              softLimitPips: 2.7,
              hardLimitPips: 3.0,
              centActionZh: '美分账户允许小仓机会入场。',
              usdActionZh: '美元账户仅 paper mirror，不实盘。',
            },
            usdDeploymentGate: {
              liveAllowed: false,
              action: 'PAPER_MIRROR',
              targetStage: 'USD_PAPER_MIRROR',
              reasonZh:
                '美元账户继续 mirror；只有美分账户验证和严格 STANDARD_ENTRY 条件全部通过后才切 USD_MICRO_LIVE。',
            },
          },
        },
      }),
    );

    const cards = buildMt5AccountCards(snapshot);

    expect(cards[0].title).toBe('美分账户 Shadow 观察');
    expect(cards[1].title).toBe('美元账户 ReadOnly 观察');
    expect(cards[1].items.find((item) => item.label === '账户车道')?.hint).toContain('没有 execution lane');
    expect(cards[0].items.find((item) => item.label === '研究信号模式')?.value).toContain(
      'OPPORTUNITY_ENTRY',
    );
    expect(cards[1].items.find((item) => item.label === '研究信号模式')?.hint).toContain('broker order');
    expect(cards[1].items.find((item) => item.label === 'USD Shadow 对照门')?.value).toContain(
      'PAPER_MIRROR',
    );
    expect(cards[1].items.find((item) => item.label === 'USD Shadow 对照门')?.hint).toContain(
      '不构成执行授权',
    );
    expect(cards[0].items.find((item) => item.label === '点差门禁')).toMatchObject({
      value: '2.30 pips / 轻微偏宽',
      status: 'warn',
    });
    expect(cards[0].items.find((item) => item.label === '点差门禁')?.hint).toContain('Shadow 建议权重');
    expect(cards[1].items.find((item) => item.label === '点差门禁')?.hint).toContain('USD ReadOnly');
  });

  it('surfaces a cross-frontend MT5 snapshot recovery banner and matrix', () => {
    const snapshot = normalizeMt5Snapshot({
      account: {
        ok: true,
        snapshotFresh: true,
        account: { login: '90000001', server: 'SyntheticBroker-Demo12', currency: 'USC' },
      },
      snapshot: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        snapshotFresh: false,
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          ageSeconds: 875085,
          nextActionZh: '恢复 Live12 MT5/EA writer。',
          recoveryStepsZh: [
            '确认 Live12 HFM/MT5 终端正在运行。',
            '确认 EA 持续写出 QuantGod_Dashboard.json。',
          ],
        },
        hostProcess: {
          status: 'MISSING',
          terminalProcessDetected: false,
          matchingProcessCount: 0,
        },
      },
      secondaryAccount: {
        ok: true,
        snapshotFresh: true,
        account: { login: '90000002', server: 'SyntheticBroker-Demo16', currency: 'USD' },
      },
      secondarySnapshot: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        snapshotFresh: false,
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          ageSeconds: 875085,
          nextActionZh: '恢复 Live16 MT5/EA writer。',
          recoveryStepsZh: ['确认 Live16 HFM/MT5 终端正在运行。', '刷新 /api/mt5-readonly/snapshot。'],
        },
      },
    });

    const banner = buildMt5SnapshotRootCauseBanner(snapshot);
    const rows = buildMt5SnapshotRecoveryRows(snapshot);

    expect(banner).toMatchObject({
      status: 'blocked',
      label: 'MT5/EA writer 未运行',
      title: 'MT5 当前账号快照不能当作实时状态',
    });
    expect(banner.rootCauseLine).toContain('主账号 / SyntheticBroker-Demo12：writer 未运行');
    expect(banner.evidenceLine).toContain('主账号 / SyntheticBroker-Demo12：writer 未运行，10.1 天');
    expect(banner.evidenceLine).toContain('第二账号 / SyntheticBroker-Demo16：快照过期，10.1 天');
    expect(banner.blockedLine).toContain('当前持仓');
    expect(banner.usableLine).toContain('shadow 账本');
    expect(rows[0]).toMatchObject({
      账户: '主账号 / SyntheticBroker-Demo12',
      端点: '/api/mt5-readonly/snapshot',
      状态: 'writer 未运行',
      打开页面: '/vue/?workspace=mt5',
      数据年龄: '主账号 / SyntheticBroker-Demo12：writer 未运行，10.1 天 / 阈值 待确认',
      进程诊断: '未检测到 terminal64/wine 进程',
      验收标准:
        '对应只读桥 fresh=true、terminal64/wine 进程已检测，且 Broker 已连接、账号已授权、readReady=true。',
    });
    expect(rows[0].下一步).toContain('未检测到 terminal64/wine 进程');
    expect(rows[0].下一步).toContain('确认 Live12 HFM/MT5 终端正在运行');
    expect(rows[0].可信范围).toContain('旧快照只作历史参考');
    expect(rows[1]).toMatchObject({
      账户: '第二账号 / SyntheticBroker-Demo16',
      端点: '/api/mt5-readonly-secondary/snapshot',
      状态: '快照过期',
      打开页面: '/vue/?workspace=mt5',
      数据年龄: '第二账号 / SyntheticBroker-Demo16：快照过期，10.1 天 / 阈值 待确认',
      验收标准:
        '对应只读桥 fresh=true、terminal64/wine 进程已检测，且 Broker 已连接、账号已授权、readReady=true。',
    });
    expect(rows[1].下一步).toContain('/api/mt5-readonly-secondary/snapshot');
    expect(rows[1].下一步).not.toContain('刷新 /api/mt5-readonly/snapshot');
  });

  it('shows readonly bridge unavailable instead of waiting when secondary MT5 is unconfigured', () => {
    const snapshot = normalizeMt5Snapshot({
      secondarySnapshot: {
        ok: false,
        status: 'UNCONFIGURED',
        scope: 'secondary',
        error: 'secondary_mt5_runtime_not_found',
      },
    });

    const rows = buildMt5SnapshotRecoveryRows(snapshot);
    const endpointHealth = buildEndpointHealth({
      secondaryAccount: {
        ok: false,
        status: 'UNCONFIGURED',
        scope: 'secondary',
        error: 'secondary_mt5_runtime_not_found',
      },
    });

    expect(snapshot.secondaryMt5Freshness).toMatchObject({
      status: 'MT5_READONLY_BRIDGE_UNCONFIGURED',
      statusZh: 'Live16 只读桥未配置',
      unavailable: true,
      stale: true,
    });
    expect(rows[1]).toMatchObject({
      账户: '第二账号',
      端点: '/api/mt5-readonly-secondary/snapshot',
      状态: '只读桥不可用',
    });
    expect(rows[1].下一步).toContain('配置 Live16 的 MT5 MQL5/Files runtime');
    expect(
      endpointHealth.find((item) => item.endpoint === '/api/mt5-readonly-secondary/account'),
    ).toMatchObject({
      status: 'blocked',
      statusLabel: '只读桥不可用',
    });
  });

  it('prefers latest live spread gate over stale daily autopilot spread snapshot', () => {
    const snapshot = normalizeMt5Snapshot(
      withTrustedMt5Connections({
        dailyAutopilot: {
          morningPlan: {
            spreadGate: {
              spreadPips: 2.3,
              tier: 'SOFT_WIDE',
              tierZh: '轻微偏宽',
              normalLimitPips: 2.2,
              softLimitPips: 2.7,
              hardLimitPips: 3.0,
            },
          },
        },
        usdJpyLiveLoop: {
          policy: {
            spreadGate: {
              spreadPips: 2.9,
              tier: 'SOFT_WIDE_HIGH',
              tierZh: '偏宽较高',
              normalLimitPips: 2.2,
              softLimitPips: 2.7,
              hardLimitPips: 3.0,
              hardBlock: false,
              centActionZh: '美分账户允许极小仓机会入场。',
              usdActionZh: '美元账户仅 paper mirror，不实盘。',
            },
          },
        },
      }),
    );

    const cards = buildMt5AccountCards(snapshot);
    const centSpread = cards[0].items.find((item) => item.label === '点差门禁');

    expect(centSpread).toMatchObject({
      value: '2.90 pips / 偏宽较高',
      status: 'warn',
    });
    expect(centSpread?.hint).toContain('正常/软/硬阈值 2.2 / 2.7 / 3.0 pips');
    expect(centSpread?.hint).not.toContain('阈值 2.2 pips');
  });

  it('explains spread tiers in RSI diagnostics instead of showing 2.2 as a hard cap', () => {
    const snapshot = normalizeMt5Snapshot({
      usdJpyLiveLoop: {
        policy: {
          spreadGate: {
            spreadPips: 2.9,
            tier: 'SOFT_WIDE_HIGH',
            tierZh: '偏宽较高',
            normalLimitPips: 2.2,
            softLimitPips: 2.7,
            hardLimitPips: 3.0,
            hardBlock: false,
            centActionZh: '美分账户允许极小仓机会入场。',
          },
        },
      },
      snapshot: {
        usdJpyRsiEntryDiagnostics: {
          stateZh: '等待信号',
          permissions: { liveMode: true, tradeAllowed: true },
          guards: { sessionOpen: true, spreadAllowed: true, spreadPips: 2.3, maxSpreadPips: 2.2 },
          rsi: {},
        },
      },
    });

    const spreadRow = buildRsiEntryDiagnosticRows(snapshot).find((row) => row.项目 === '点差');

    expect(spreadRow?.结论).toBe('偏宽较高 / 未硬阻断');
    expect(spreadRow?.说明).toContain('2.90 pips / 偏宽较高');
    expect(spreadRow?.说明).toContain('正常/软/硬阈值 2.2 / 2.7 / 3.0 pips');
  });

  it('does not render cent lane hints on an empty USD lane fallback', () => {
    const snapshot = normalizeMt5Snapshot({
      account: { account: { login: '90000001', server: 'SyntheticBroker-Demo12', currency: 'USC' } },
      secondaryAccount: {
        account: { login: '90000002', server: 'SyntheticBroker-Demo16', currency: 'USD' },
      },
    });

    const usdItems = buildMt5AccountCards(snapshot)[1].items;

    expect(usdItems.find((item) => item.label === '账户车道')).toBeUndefined();
    expect(usdItems.find((item) => item.hint === '美分账户用于小仓收集真实执行样本。')).toBeUndefined();
  });

  it('marks MT5 account cards stale when the latest dashboard snapshot is expired', () => {
    const snapshot = normalizeMt5Snapshot({
      latest: {
        _freshness: {
          status: 'STALE_DASHBOARD_SNAPSHOT',
          statusZh: 'MT5 dashboard 快照已过期',
          stale: true,
          fresh: false,
          ageSeconds: 7103.2,
          maxAgeSeconds: 1800,
          nextActionZh: '恢复主 MT5/EA 进程并刷新 QuantGod_Dashboard.json。',
        },
      },
      account: {
        account: {
          login: '90000001',
          server: 'SyntheticBroker-Demo12',
          currency: 'USC',
          equity: 10020.5,
          balance: 10000,
          executionEnabled: true,
          livePilotMode: true,
          tradeAllowed: true,
        },
      },
      secondaryAccount: {
        account: {
          login: '90000002',
          server: 'SyntheticBroker-Demo16',
          currency: 'USD',
          equity: 998.25,
          balance: 1000,
          executionEnabled: true,
          livePilotMode: true,
          tradeAllowed: true,
        },
      },
    });

    const centItems = buildMt5AccountCards(snapshot)[0].items;
    const metrics = buildMt5Metrics(snapshot);

    expect(snapshot.latestDashboardStale).toBe(true);
    expect(centItems.find((item) => item.label === '当前持仓')).toMatchObject({
      value: '不可确认',
      status: 'warn',
    });
    expect(centItems.find((item) => item.label === '当前持仓').hint).toContain(
      '旧快照未显示持仓，不能据此确认当前为 0 仓',
    );
    expect(centItems.find((item) => item.label === '净值')).toMatchObject({
      value: '快照过期',
      status: 'warn',
    });
    expect(centItems.find((item) => item.label === '净值').hint).toContain(
      '历史净值: 10020.50 USC，仅作参考',
    );
    expect(centItems.find((item) => item.label === '余额')).toMatchObject({
      value: '快照过期',
      status: 'warn',
    });
    expect(centItems.find((item) => item.label === '执行边界')).toMatchObject({
      value: '不可用 / 已阻断',
      status: 'blocked',
      hint: '恢复主 MT5/EA 进程并刷新 QuantGod_Dashboard.json。',
    });
    expect(centItems.find((item) => item.label === '快照新鲜度')).toMatchObject({
      value: '过期',
      status: 'warn',
      hint: '恢复主 MT5/EA 进程并刷新 QuantGod_Dashboard.json。',
    });
    expect(metrics.find((item) => item.label === '主账号净值')).toMatchObject({
      value: '快照过期',
      status: 'warn',
    });
    expect(metrics.find((item) => item.label === '当前持仓')).toMatchObject({
      value: '不可确认',
      status: 'blocked',
    });
  });

  it('surfaces missing terminal process as the stale snapshot root cause', () => {
    const raw = {
      snapshot: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        snapshotFresh: false,
        hostProcess: {
          status: 'MISSING',
          terminalProcessDetected: false,
          matchingProcessCount: 0,
        },
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          ageSeconds: 603109,
          maxAgeSeconds: 180,
          blockers: ['live_dashboard_snapshot_stale', 'mt5_terminal_process_missing'],
          nextAction: 'Restore the MT5 terminal/EA dashboard writer process.',
        },
        account: {
          login: '90000001',
          server: 'SyntheticBroker-Demo12',
          currency: 'USC',
          equity: 10020.5,
          balance: 10020.5,
        },
      },
      positions: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          blockers: ['live_dashboard_snapshot_stale'],
        },
        items: [{ ticket: 'old-position', symbol: 'USDJPYc', volume: 0.01 }],
      },
      orders: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          blockers: ['live_dashboard_snapshot_stale'],
        },
        items: [{ ticket: 'old-order', symbol: 'USDJPYc', volume: 0.01 }],
      },
    };
    const snapshot = normalizeMt5Snapshot(raw);

    const centItems = buildMt5AccountCards(snapshot)[0].items;
    const endpointHealth = buildEndpointHealth(raw);

    expect(buildMt5AccountCards(snapshot)[0]).toMatchObject({
      status: 'blocked',
      statusLabel: 'writer 未运行',
    });
    expect(centItems.find((item) => item.label === 'MT5 进程')).toMatchObject({
      value: '未检测到 terminal64/wine 进程',
      status: 'blocked',
    });
    expect(centItems.find((item) => item.label === '当前持仓')).toMatchObject({
      value: '不可确认',
      status: 'warn',
    });
    expect(centItems.find((item) => item.label === '快照新鲜度')).toMatchObject({
      value: '过期',
      status: 'warn',
    });
    expect(endpointHealth.find((item) => item.endpoint === '/api/mt5-readonly/snapshot')).toMatchObject({
      status: 'blocked',
      statusLabel: 'writer 未运行',
    });
    expect(buildPositionRows(snapshot)[0]).toMatchObject({
      账户: '主账号',
      状态: 'writer 未运行',
      可信范围: '实时持仓不可确认；旧快照不能证明当前为 0。',
    });
    expect(buildPositionRows(snapshot)[0].票号).toBeUndefined();
    expect(buildOrderRows(snapshot)[0]).toMatchObject({
      账户: '主账号',
      状态: 'writer 未运行',
      可信范围: '挂单状态不可确认；旧快照不能证明当前为 0。',
    });
    expect(buildOrderRows(snapshot)[0].票号).toBeUndefined();
  });

  it('marks missing EA snapshots as blocked instead of a normal endpoint', () => {
    const raw = {
      snapshot: {
        ok: false,
        status: 'MISSING_EA_SNAPSHOT',
        statusZh: 'MT5 dashboard 快照缺失',
        snapshotFresh: false,
        _freshness: {
          status: 'MISSING_EA_SNAPSHOT',
          statusZh: 'MT5 dashboard 快照缺失',
          stale: true,
          fresh: false,
          blockers: ['missing_ea_dashboard_snapshot'],
          nextActionZh: '未找到 QuantGod_Dashboard.json；先恢复 MT5 终端和 EA dashboard writer。',
        },
      },
    };
    const snapshot = normalizeMt5Snapshot(raw);
    const endpointHealth = buildEndpointHealth(raw);

    expect(buildMt5AccountCards(snapshot)[0]).toMatchObject({
      status: 'blocked',
      statusLabel: '状态未知 / 已阻断',
    });
    expect(endpointHealth.find((item) => item.endpoint === '/api/mt5-readonly/snapshot')).toMatchObject({
      status: 'blocked',
      statusLabel: '快照缺失',
    });
    expect(buildPositionRows(snapshot)[0]).toMatchObject({
      状态: '快照缺失',
      可信范围: '实时持仓不可确认；旧快照不能证明当前为 0。',
    });
  });

  it('does not mark MT5 account cards fresh when freshness is present but unconfirmed', () => {
    const snapshot = normalizeMt5Snapshot({
      latest: {
        _freshness: {
          status: 'WAITING_DASHBOARD_FRESHNESS',
          nextActionZh: '等待 /api/latest 返回 mtime 新鲜度。',
        },
      },
      account: {
        account: {
          login: '90000001',
          server: 'SyntheticBroker-Demo12',
          currency: 'USC',
          executionEnabled: true,
          livePilotMode: true,
          tradeAllowed: true,
        },
      },
      secondaryAccount: {
        account: {
          login: '90000002',
          server: 'SyntheticBroker-Demo16',
          currency: 'USD',
          executionEnabled: true,
          livePilotMode: true,
          tradeAllowed: true,
        },
      },
    });

    const centItems = buildMt5AccountCards(snapshot)[0].items;

    expect(snapshot.latestDashboardStale).toBe(false);
    expect(centItems.find((item) => item.label === '执行边界')).toMatchObject({
      value: '不可用 / 已阻断',
      status: 'blocked',
      hint: '等待 /api/latest 返回 mtime 新鲜度。',
    });
    expect(centItems.find((item) => item.label === '快照新鲜度')).toMatchObject({
      value: '待确认',
      status: 'warn',
      hint: '等待 /api/latest 返回 mtime 新鲜度。',
    });
  });

  it('uses the secondary account readonly freshness instead of the primary latest freshness', () => {
    const snapshot = normalizeMt5Snapshot({
      latest: {
        _freshness: {
          status: 'FRESH_DASHBOARD_SNAPSHOT',
          fresh: true,
          stale: false,
        },
      },
      account: {
        account: {
          login: '90000001',
          server: 'SyntheticBroker-Demo12',
          currency: 'USC',
          equity: 10020.5,
          balance: 10000,
        },
      },
      secondarySnapshot: {
        ok: true,
        status: 'STALE_EA_SNAPSHOT',
        snapshotFresh: false,
        _freshness: {
          status: 'STALE_EA_SNAPSHOT',
          stale: true,
          fresh: false,
          ageSeconds: 875085,
          nextAction: 'Restore Live16 EA dashboard writer.',
        },
        account: {
          login: '90000002',
          server: 'SyntheticBroker-Demo16',
          currency: 'USD',
          equity: 16.33,
          balance: 16.33,
        },
      },
    });

    const usdItems = buildMt5AccountCards(snapshot)[1].items;
    const metrics = buildMt5Metrics(snapshot);

    expect(snapshot.latestDashboardStale).toBe(false);
    expect(snapshot.secondaryMt5Freshness).toMatchObject({
      status: 'STALE_EA_SNAPSHOT',
      stale: true,
    });
    expect(usdItems.find((item) => item.label === '净值')).toMatchObject({
      value: '快照过期',
      status: 'warn',
    });
    expect(usdItems.find((item) => item.label === '快照新鲜度')).toMatchObject({
      value: '过期',
      status: 'warn',
    });
    expect(metrics.find((item) => item.label === '第二账号净值')).toMatchObject({
      value: '快照过期',
      status: 'warn',
    });
  });

  it('shows manual non-USDJPY live positions in the realtime positions table', () => {
    const snapshot = normalizeMt5Snapshot({
      positions: {
        items: [
          {
            ticket: 637134294,
            symbol: 'XAUUSDc',
            type: 'buy',
            volume: 0.01,
            priceOpen: 4650.17,
            priceCurrent: 0,
            profit: -92.13,
            sl: 0,
            tp: 4695,
            strategy: 'Manual/Other',
            source: 'MANUAL',
          },
        ],
      },
    });

    expect(buildPositionRows(snapshot)[0]).toMatchObject({
      票号: 637134294,
      品种: 'XAUUSDc',
      策略: 'Manual/Other',
      来源: 'MANUAL',
    });
  });

  it('merges secondary USD account live positions into the realtime positions table', () => {
    const snapshot = normalizeMt5Snapshot({
      account: { account: { login: '90000001', server: 'SyntheticBroker-Demo12', currency: 'USC' } },
      secondaryAccount: {
        account: { login: '90000002', server: 'SyntheticBroker-Demo16', currency: 'USD' },
      },
      positions: {
        items: [
          {
            ticket: 637134294,
            symbol: 'XAUUSDc',
            type: 'buy',
            volume: 0.01,
            profit: -165.45,
          },
        ],
      },
      secondarySnapshot: {
        positions: {
          items: [
            {
              ticket: 1551939838,
              symbol: 'XAUUSD',
              type: 'buy',
              volume: 0.01,
              profit: -31.17,
            },
          ],
        },
      },
    });

    const rows = buildPositionRows(snapshot);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      账户: '第二账号 ••••0002',
      票号: 1551939838,
      品种: 'XAUUSD',
      浮盈: -31.17,
    });
    expect(buildMt5AccountCards(snapshot)[1].items.find((item) => item.label === '当前持仓')).toMatchObject({
      value: '不可确认',
      status: 'blocked',
    });
  });

  it('surfaces USDJPY entry records that are not yet matched by an exit or close history row', () => {
    const snapshot = normalizeMt5Snapshot({
      positions: [],
      closeHistory: [],
      tradeJournal: [
        {
          EventTime: '2026.05.11 11:00',
          EventType: 'ENTRY',
          Symbol: 'USDJPYc',
          Side: 'BUY',
          Lots: '0.01',
          Price: '157.144',
          Strategy: 'RSI_Reversal',
          PositionId: '621204078',
        },
        {
          EventTime: '2026.05.11 10:00',
          EventType: 'ENTRY',
          Symbol: 'EURUSDc',
          Side: 'BUY',
          PositionId: 'EUR-1',
        },
      ],
    });

    const rows = buildUnclosedEntryRows(snapshot);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      入场时间: '2026.05.11 11:00',
      品种: 'USDJPYc',
      状态: '待快照/平仓同步',
      PositionId: '621204078',
    });
  });

  it('hides matched entry records once an exit or close history row exists', () => {
    const snapshot = normalizeMt5Snapshot({
      closeHistory: [{ CloseTime: '2026.05.11 11:30', Symbol: 'USDJPYc', PositionId: '621204078' }],
      tradeJournal: [
        {
          EventTime: '2026.05.11 11:00',
          EventType: 'ENTRY',
          Symbol: 'USDJPYc',
          PositionId: '621204078',
        },
        {
          EventTime: '2026.05.11 11:30',
          EventType: 'EXIT',
          Symbol: 'USDJPYc',
          PositionId: '621204078',
        },
      ],
    });

    expect(buildUnclosedEntryRows(snapshot)).toEqual([]);
  });

  it('explains live universe, shadow universe, tester window and Vibe-only strategy state', () => {
    const snapshot = normalizeMt5Snapshot(
      withTrustedMt5Connections({
        latest: {
          strategies: {
            RSI_Reversal: {
              enabled: true,
              active: true,
              riskMultiplier: 1,
              reason: 'Waiting for next H1 bar',
            },
          },
        },
        snapshot: {
          runtime: {
            tradeAllowed: true,
            executionEnabled: true,
            pilotKillSwitch: false,
            pilotStartupEntryGuardActive: false,
          },
        },
        dailyReview: {
          summary: {
            todayTodoStatus: 'SCHEDULED_FOR_TESTER_WINDOW',
            nextTesterWindowLabel: '2026-05-04 20:10-23:30 JST',
          },
          actionQueue: [{ candidateId: 'RSI_Reversal_USDJPYc_rsi_ultra_extreme_guard' }],
        },
        researchStats: {
          summary: {
            liveUniverseLabel: 'USDJPYc',
            shadowResearchUniverseLabel: 'USDJPYc / EURUSDc / XAUUSDc',
          },
        },
        governanceAdvisor: {
          summary: {
            shadowRows: 671,
            candidateRows: 227,
            candidateOutcomeRows: 375,
            paramLabResultParsed: 59,
            versionGatePromoteCandidates: 0,
            strategyVersionCount: 5,
          },
        },
      }),
    );

    const items = buildMt5SimulationItems(snapshot);

    expect(items.find((item) => item.label === 'EA Shadow 观察 Universe')?.value).toBe('USDJPYc');
    expect(items.find((item) => item.label === '模拟Universe')?.value).toBe('USDJPYc');
    expect(items.find((item) => item.label === '当前策略证据')?.value).toBe('RSI 买入侧观察');
    expect(items.find((item) => item.label === '今日待办')?.hint).toContain('20:10-23:30');
    expect(items.find((item) => item.label === '缠论/MACD-TD')?.value).toContain('尚未进入');
  });

  it('treats an enabled RSI route waiting for signal as live observation', () => {
    const snapshot = normalizeMt5Snapshot(
      withTrustedMt5Connections({
        latest: {
          strategies: {
            RSI_Reversal: {
              enabled: true,
              active: false,
              runtimeLabel: 'ON',
              status: 'WAIT_SIGNAL',
              riskMultiplier: 1,
              reason: 'Waiting for first H1 RSI evaluation',
            },
          },
        },
        snapshot: {
          runtime: {
            tradeAllowed: true,
            executionEnabled: true,
            pilotKillSwitch: false,
            pilotStartupEntryGuardActive: false,
          },
        },
        researchStats: {
          summary: {
            liveUniverseLabel: 'USDJPYc',
            shadowResearchUniverseLabel: 'USDJPYc',
          },
        },
      }),
    );

    const items = buildMt5SimulationItems(snapshot);

    expect(items.find((item) => item.label === '当前策略证据')?.value).toBe('RSI 买入侧观察');
    expect(items.find((item) => item.label === '当前策略证据')?.status).toBe('ok');
  });

  it('builds a readable MT5 shadow ledger with pips equity and trade rows', () => {
    const snapshot = normalizeMt5Snapshot({
      snapshot: {
        runtime: {
          localTime: '2026.05.05 12:00',
        },
      },
      shadowSignals: {
        data: {
          rows: [
            {
              LabelTimeLocal: '2026.05.05 10:00',
              Symbol: 'USDJPYc',
              Strategy: 'MA_Cross',
              Blocker: 'RANGE_REGIME',
            },
            {
              LabelTimeLocal: '2026.05.05 10:15',
              Symbol: 'USDJPYc',
              Strategy: 'MA_Cross',
              Blocker: 'RANGE_REGIME',
            },
            {
              LabelTimeLocal: '2026.05.05 10:30',
              Symbol: 'USDJPYc',
              Strategy: 'RSI_Reversal',
              Blocker: 'SESSION',
            },
            {
              LabelTimeLocal: '2026.05.05 10:45',
              Symbol: 'EURUSDc',
              Strategy: 'MA_Cross',
              Blocker: 'SPREAD',
            },
          ],
        },
      },
      shadowCandidateOutcomes: {
        data: {
          rows: [
            {
              EventId: 'A',
              OutcomeLabelTimeLocal: '2026.05.05 11:00',
              Symbol: 'USDJPYc',
              CandidateRoute: 'RANGE_SOFT',
              CandidateDirection: 'BUY',
              HorizonMinutes: '60',
              LongClosePips: '8.5',
              ShortClosePips: '-8.5',
              DirectionalOutcome: 'WIN',
              ReferencePrice: '156.25',
            },
            {
              EventId: 'B',
              OutcomeLabelTimeLocal: '2026.05.05 12:00',
              Symbol: 'EURUSDc',
              CandidateRoute: 'RANGE_SOFT',
              CandidateDirection: 'SELL',
              HorizonMinutes: '60',
              LongClosePips: '4.0',
              ShortClosePips: '-4.0',
              DirectionalOutcome: 'LOSS',
              ReferencePrice: '1.1010',
            },
          ],
        },
      },
    });

    const summary = buildMt5ShadowSummary(snapshot);
    const trades = buildMt5ShadowTradeRows(snapshot);
    const equity = buildMt5ShadowEquityRows(snapshot);

    expect(summary.metrics.find((item) => item.label === '模拟候选样本')?.value).toBe('1 笔');
    expect(summary.metrics.find((item) => item.label === '模拟点数净值')?.value).toBe('+8.5 pips');
    expect(summary.metrics.find((item) => item.label === '模拟胜率')?.value).toBe('100.0%');
    expect(summary.metrics.find((item) => item.label === '主要阻断')?.value).toContain('震荡');
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ 品种: 'USDJPYc', 方向: '做多', 点数盈亏: '+8.5' });
    expect(equity[0]).toMatchObject({ 品种: 'USDJPYc', 模拟净值: '+8.5' });
  });

  it('hides stale shadow blocker rows from the current MT5 blocker table', () => {
    const snapshot = normalizeMt5Snapshot({
      snapshot: {
        runtime: {
          localTime: '2026.05.18 21:00',
        },
      },
      shadowSignals: [
        {
          LabelTimeLocal: '2026.05.08 23:00:11',
          Symbol: 'USDJPYc',
          Strategy: 'MA_Cross',
          Blocker: 'NEWS_BLOCK',
        },
        {
          LabelTimeLocal: '2026.05.18 20:45:00',
          Symbol: 'USDJPYc',
          Strategy: 'RSI_Reversal',
          Blocker: 'SPREAD_BLOCK',
        },
      ],
    });

    const rows = buildMt5ShadowBlockerRows(snapshot);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 策略: 'RSI_Reversal', 最近时间: '2026.05.18 20:45:00' });
    expect(JSON.stringify(rows)).not.toContain('2026.05.08');
  });

  it('keeps shadow builders USDJPY-only even when given raw unnormalized rows', () => {
    const rawSnapshot = {
      shadowSignals: [
        { LabelTimeLocal: '2026.05.05 10:00', Symbol: 'EURUSDc', Strategy: 'MA_Cross', Blocker: 'SPREAD' },
        {
          LabelTimeLocal: '2026.05.05 10:30',
          Symbol: 'USDJPYc',
          Strategy: 'RSI_Reversal',
          Blocker: 'SESSION',
        },
      ],
      shadowCandidateOutcomes: [
        {
          EventId: 'A',
          OutcomeLabelTimeLocal: '2026.05.05 11:00',
          Symbol: 'EURUSDc',
          CandidateRoute: 'MA_Cross',
          CandidateDirection: 'SELL',
          HorizonMinutes: '60',
          ShortClosePips: '12.0',
        },
        {
          EventId: 'B',
          OutcomeLabelTimeLocal: '2026.05.05 12:00',
          Symbol: 'USDJPYc',
          CandidateRoute: 'RSI_Reversal',
          CandidateDirection: 'BUY',
          HorizonMinutes: '60',
          LongClosePips: '4.0',
        },
      ],
    };

    const summary = buildMt5ShadowSummary(rawSnapshot);
    const trades = buildMt5ShadowTradeRows(rawSnapshot);
    const equity = buildMt5ShadowEquityRows(rawSnapshot);

    expect(summary.metrics.find((item) => item.label === '模拟候选样本')?.value).toBe('1 笔');
    expect(trades).toHaveLength(1);
    expect(trades[0].品种).toBe('USDJPYc');
    expect(equity[0].品种).toBe('USDJPYc');
  });

  it('summarizes Evidence OS execution feedback and Case Memory for the MT5 first screen', () => {
    const snapshot = normalizeMt5Snapshot({
      evidenceOS: {
        parity: {
          status: 'PARITY_PASS',
          evidenceSync: {
            strategyJsonBacktest: 'WRITTEN',
            pythonReplay: 'WRITTEN',
          },
          deepParity: {
            status: 'PASS',
            reasonZh: 'Strategy JSON / Python Replay / MQL5 EA 深度门禁矩阵一致',
            hardMismatches: [],
            missingOptionalFields: ['mql5.rsi.crossbackThreshold'],
          },
        },
        executionFeedback: {
          promotionGate: {
            status: 'BLOCKED',
            reasonZh: '执行反馈阻断晋级：最近两笔滑点过大',
            blockers: [{ code: 'SLIPPAGE_DAMAGE', reasonZh: '滑点损伤过大' }],
          },
          metrics: { rejectCount: 1, avgSlippagePips: 2.35, avgLatencyMs: 318 },
        },
        caseMemory: {
          caseMemoryToGA: { queuedHintCount: 1 },
          gaSeedHints: [
            {
              caseId: 'USDJPY-SLIPPAGE-001',
              mutationHint: 'reduce_slippage_damage',
              reasonZh: '下一代需要降低滑点损伤',
            },
          ],
        },
      },
    });

    const items = buildMt5EvidenceOsLiteItems(snapshot);

    expect(items.find((item) => item.label === '三方一致性')?.value).toBe('三方口径一致 / 证据已同步');
    expect(items.find((item) => item.label === '三方一致性')?.hint).toContain('crossbackThreshold');
    expect(items.find((item) => item.label === '三方一致性')?.hint).toContain(
      'Strategy JSON 已同步 / Python Replay 已同步',
    );
    expect(items.find((item) => item.label === '影子 / 历史反馈可信度门')?.value).toBe(
      '反馈证据阻断研究晋级',
    );
    expect(items.find((item) => item.label === '反馈阻断 / 警告')?.value).toContain('滑点损伤');
    expect(items.find((item) => item.label === '当前最大 Case')?.value).toBe('USDJPY-SLIPPAGE-001');
    expect(items.find((item) => item.label === '当前最大 Case')?.status).toBe('warn');
    expect(items.find((item) => item.label === '下一代 GA 修复方向')?.value).toBe('降低滑点损伤');
    expect(items.find((item) => item.label === '下一代 GA 修复方向')?.status).toBe('warn');
  });

  it('surfaces the actual live-loop blocker instead of positive context text', () => {
    const snapshot = normalizeMt5Snapshot({
      usdJpyLiveLoop: {
        state: 'POLICY_BLOCKED',
        stateZh: '政策仍阻断，EA 不应自动入场',
        policyReady: false,
        topPolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'BLOCKED',
          allowed: false,
          recommendedLot: 0,
          maxLot: 2,
          entryStrictness: 'BLOCKED_HIGH_IMPACT_NEWS',
          reasons: [
            '近期样本为正，可进入 USDJPY 策略候选',
            '运行快照通过',
            '高冲击新闻窗口：Tracking next USDJPY event in 77m，暂停 live，shadow / replay 继续。',
          ],
          newsGate: {
            hardBlock: true,
            riskLevel: 'HARD',
            lotMultiplier: 0,
            reasonZh:
              '高冲击新闻窗口：Tracking next USDJPY event: philadelphia-fed-manufacturing-index in 77m，暂停 live，shadow / replay 继续。',
          },
        },
        dryRunDecision: {
          decisionZh: '阻断',
          reason: '高冲击新闻窗口内暂停 live。',
        },
      },
    });

    const items = buildUsdJpyLiveLoopItems(snapshot);

    expect(items.find((item) => item.label === '主阻断原因')?.value).toContain('高冲击新闻窗口');
    expect(items.find((item) => item.label === '主阻断原因')?.value).not.toContain('近期样本为正');
    expect(items.find((item) => item.label === '影子观察状态')?.status).toBe('warn');
  });

  it('renders new and legacy live-loop ready states as Shadow advisory only', () => {
    const trustedConnection = {
      ok: true,
      snapshotFresh: true,
      brokerConnected: true,
      accountAuthorized: true,
      writerFresh: true,
      freshness: { status: 'FRESH_EA_SNAPSHOT', fresh: true, stale: false },
    };
    const base = {
      marketSession: 'MARKET_OPEN',
      primaryConnection: trustedConnection,
    };
    const newItems = buildUsdJpyLiveLoopItems({
      ...base,
      usdJpyLiveLoop: {
        state: 'SHADOW_ADVISORY_READY',
        stateZh: 'Shadow advisory 已就绪，可继续观察与复核',
        advisoryRouteZh: '所有策略仅用于 Shadow/ReadOnly 观察与研究复核。',
        topAdvisoryPolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'STANDARD_ENTRY',
        },
        safety: { executionLaneExists: false, existingEaOwnsExecution: false },
      },
    });
    const legacyItems = buildUsdJpyLiveLoopItems({
      ...base,
      usdJpyLiveLoop: {
        state: 'READY_FOR_EXISTING_EA',
        stateZh: 'RSI 买入路线已恢复，等待 EA 自身信号',
        topLiveEligiblePolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'STANDARD_ENTRY',
        },
      },
    });
    const genericReadyItems = buildUsdJpyLiveLoopItems({
      ...base,
      usdJpyLiveLoop: { state: 'READY', stateZh: 'Ready' },
    });

    expect(newItems.find((item) => item.label === 'USDJPY Shadow Advisory')).toMatchObject({
      value: '影子建议已就绪',
      status: 'ok',
      hint: '所有策略仅用于 Shadow/ReadOnly 观察与研究复核。',
    });
    expect(newItems.find((item) => item.label === 'Shadow 候选策略')?.value).toContain('RSI_Reversal');
    expect(legacyItems.find((item) => item.label === 'USDJPY Shadow Advisory')).toMatchObject({
      value: '影子建议已就绪（旧契约）',
      status: 'ok',
    });
    expect(JSON.stringify(legacyItems)).not.toContain('等待 EA 自身信号');
    expect(genericReadyItems.find((item) => item.label === 'USDJPY Shadow Advisory')?.status).toBe('warn');
  });

  it('labels RSI diagnostics as a non-executing Shadow boundary', () => {
    const rows = buildRsiEntryDiagnosticRows({
      marketSession: 'MARKET_OPEN',
      usdJpyRsiEntryDiagnostics: {
        state: 'WAIT_SIGNAL',
        permissions: { liveMode: true, tradeAllowed: true },
        guards: {},
        rsi: {},
      },
    });

    expect(rows.find((row) => row.项目 === '执行边界')).toMatchObject({
      结论: 'Shadow / ReadOnly（无执行通道）',
    });
    expect(rows.find((row) => row.项目 === '执行边界')?.说明).toContain('不构成 broker 执行授权');
    expect(rows.some((row) => row.项目 === '交易权限')).toBe(false);
  });

  it('does not let a shadow top-live placeholder hide the policy blocker', () => {
    const snapshot = normalizeMt5Snapshot({
      usdJpyLiveLoop: {
        state: 'POLICY_BLOCKED',
        stateZh: '政策仍阻断，EA 不应自动入场',
        policyReady: false,
        primaryBlocker: '模拟观察',
        blockers: ['SHADOW_REVIEW'],
        topLiveEligiblePolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'BLOCKED',
          allowed: false,
          entryStrictness: 'SHADOW_REVIEW',
          reasons: ['近期样本为正，可进入 USDJPY 策略候选', '运行快照通过'],
        },
        topPolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'BLOCKED',
          allowed: false,
          entryStrictness: 'BLOCKED_HIGH_IMPACT_NEWS',
          reasons: [
            '近期样本为正，可进入 USDJPY 策略候选',
            '高冲击新闻窗口：Tracking next USDJPY event in 107m，暂停 live，shadow / replay 继续。',
          ],
          newsGate: {
            hardBlock: true,
            riskLevel: 'HARD',
            lotMultiplier: 0,
            reasonZh: '高冲击新闻窗口：Tracking next USDJPY event in 107m，暂停 live。',
          },
        },
      },
    });

    const items = buildUsdJpyLiveLoopItems(snapshot);

    expect(items.find((item) => item.label === '主阻断原因')?.value).toContain('高冲击新闻窗口');
    expect(items.find((item) => item.label === '主阻断原因')?.value).not.toBe('模拟观察');
    expect(items.find((item) => item.label === 'Shadow 候选策略')?.hint).toContain('高冲击新闻窗口');
  });

  it('falls back to the EA RSI diagnostic blocker when policy text is vague', () => {
    const snapshot = normalizeMt5Snapshot({
      snapshot: {
        usdJpyRsiEntryDiagnostics: {
          state: 'SPREAD_BLOCK',
          stateZh: '点差超过 EA 入场限制',
          whyNoEntry: [{ code: 'SPREAD_BLOCK', label: '点差过高', detail: '3.0 / 2.0 pips' }],
        },
      },
      usdJpyLiveLoop: {
        state: 'POLICY_BLOCKED',
        stateZh: '政策仍阻断，EA 不应自动入场',
        policyReady: false,
        topPolicy: {
          strategy: 'RSI_Reversal',
          direction: 'LONG',
          entryMode: 'BLOCKED',
          allowed: false,
          entryStrictness: 'SHADOW_REVIEW',
          reasons: ['近期样本为正，可进入 USDJPY 策略候选', '运行快照通过'],
        },
      },
    });

    const items = buildUsdJpyLiveLoopItems(snapshot);

    expect(items.find((item) => item.label === '主阻断原因')?.value).toContain('3.0 / 2.0 pips');
    expect(items.find((item) => item.label === '主阻断原因')?.value).not.toBe('模拟观察');
  });

  it('shows missing execution feedback fields as unavailable instead of real zeroes', () => {
    const snapshot = normalizeMt5Snapshot({
      evidenceOS: {
        executionFeedback: {
          recentFeedback: [
            {
              fillTime: '2026.05.06 09:11',
              eventType: 'LIVE_EXIT',
              strategyId: 'RSI_Reversal',
              sourceKind: 'close_history',
              expectedPrice: 0,
              fillPrice: 156.354,
              slippagePips: 0,
              spreadAtEntry: 0,
              latencyMs: 0,
              profitR: 0,
              fieldPresence: {
                expectedPrice: false,
                fillPrice: true,
                slippagePips: false,
                spreadAtEntry: false,
                latencyMs: false,
                profitR: false,
              },
            },
          ],
        },
      },
    });

    const rows = buildMt5ExecutionFeedbackRows(snapshot);

    expect(rows[0]).toMatchObject({
      时间: '2026.05.06 09:11',
      预期价: '—',
      成交价: '156.354',
      滑点: '—',
      延迟: '—',
      点差: '—',
      profitR: '—',
    });
  });

  it('keeps real outcome R while hiding unmeasured backfilled history zeroes', () => {
    const snapshot = normalizeMt5Snapshot({
      evidenceOS: {
        executionFeedback: {
          recentFeedback: [
            {
              fillTime: '2026.05.11 11:37:59',
              eventType: 'ORDER_CLOSE',
              strategyId: 'RSI_Reversal',
              sourceKind: 'live_feedback_history',
              sourceTier: 'backfilled_history',
              expectedPrice: 0,
              fillPrice: 156.936,
              slippagePips: 0,
              spreadAtEntry: 0,
              latencyMs: 0,
              exitReason: 'HISTORY_EXIT',
              profitR: -0.0443,
              fieldPresence: {
                expectedPrice: true,
                fillPrice: true,
                slippagePips: true,
                spreadAtEntry: true,
                latencyMs: true,
                profitR: true,
              },
            },
          ],
        },
      },
    });

    const rows = buildMt5ExecutionFeedbackRows(snapshot);

    expect(rows[0]).toMatchObject({
      预期价: '—',
      成交价: '156.936',
      滑点: '—',
      延迟: '—',
      点差: '—',
      profitR: '-0.04',
    });
  });

  it('does not color research-only GA seed hints as live execution warnings', () => {
    const snapshot = normalizeMt5Snapshot({
      evidenceOS: {
        executionFeedback: {
          promotionGate: {
            status: 'WATCH',
            warnings: [{ code: 'SPREAD_AT_ENTRY', reasonZh: '入场点差异常，需要继续观察' }],
          },
        },
        caseMemory: {
          caseMemoryToGA: { queuedHintCount: 1 },
          gaSeedHints: [
            {
              caseId: 'USDJPY-BAD_ENTRY-001',
              caseType: 'BAD_ENTRY',
              priority: 'MEDIUM',
              mutationHint: 'reject_unstable_seed',
              reasonZh: '候选在 forward 或最大不利波动上不稳定',
            },
          ],
        },
      },
    });

    const items = buildMt5EvidenceOsLiteItems(snapshot);

    expect(items.find((item) => item.label === '反馈阻断 / 警告')?.status).toBe('warn');
    expect(items.find((item) => item.label === '当前最大 Case')?.status).toBe('ok');
    expect(items.find((item) => item.label === '下一代 GA 修复方向')?.value).toBe('剔除不稳定候选');
    expect(items.find((item) => item.label === '下一代 GA 修复方向')?.status).toBe('ok');
  });

  it('hides stale daily review rows instead of showing old EURUSD tasks', () => {
    const staleDailyReview = {
      generatedAtIso: '2026-05-06T12:00:00+09:00',
      actionQueue: [{ candidateId: 'MA_Cross_EURUSDc_old', symbol: 'EURUSDc', state: 'DONE' }],
      dailyPnl: { date: '2026-05-06', closedTrades: 4, netUSC: 2.78 },
      summary: { dailyReviewDateJst: '2026-05-06' },
    };

    const todoRows = buildMt5TodoRows({ dailyReview: staleDailyReview });
    const reviewRows = buildMt5ReviewRows({ dailyReview: staleDailyReview });

    expect(todoRows[0].状态).toContain('等待今日刷新');
    expect(JSON.stringify(todoRows)).not.toContain('EURUSDc');
    expect(reviewRows[0].结果).toContain('等待今日刷新');
    expect(JSON.stringify(reviewRows)).not.toContain('2026-05-06');
  });
});
