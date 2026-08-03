import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DashboardUpgradePanel from '../../src/workspaces/dashboard/DashboardUpgradePanel.vue';
import { normalizeDashboardSnapshot } from '../../src/workspaces/dashboard/dashboardModel.js';

function mountPanel(raw) {
  return mount(DashboardUpgradePanel, {
    props: {
      state: raw,
      snapshot: normalizeDashboardSnapshot(raw),
      metrics: [],
    },
    global: {
      stubs: {
        MiniSparkline: true,
      },
    },
  });
}

function readyReadonlyConnection() {
  return {
    semantics: 'EXPLICIT_CONNECTION_EVIDENCE_V2',
    brokerSessionConnected: true,
    accountAuthorized: true,
    writerFresh: true,
    processRunning: true,
    readReady: true,
  };
}

describe('DashboardUpgradePanel', () => {
  it('does not present stale MT5 positions as realtime account evidence', () => {
    const wrapper = mountPanel({
      latest: {
        openTrades: [
          {
            ticket: 'old-position-1',
            symbol: 'USDJPYc',
            type: 'BUY',
            volume: 0.01,
            profit: 2.5,
          },
        ],
        _freshness: {
          status: 'STALE_DASHBOARD_SNAPSHOT',
          statusZh: 'MT5 dashboard 快照已过期',
          stale: true,
          fresh: false,
          ageSeconds: 7200,
          nextActionZh: '恢复主 MT5/EA 进程并刷新 QuantGod_Dashboard.json。',
        },
      },
      mt5Snapshot: {
        ok: false,
        status: 'MISSING_EA_SNAPSHOT',
        hostProcess: {
          status: 'MISSING',
          terminalProcessDetected: false,
          matchingProcessCount: 0,
        },
        _freshness: {
          status: 'MISSING_EA_SNAPSHOT',
          stale: true,
          fresh: false,
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain('当前不可确认');
    expect(text).toContain('当前持仓不可确认');
    expect(text).toContain('恢复');
    expect(text).not.toContain('USDJPYc · BUY · 0.01');
  });

  it('shows normal empty position copy only when readonly snapshots are fresh', () => {
    const wrapper = mountPanel({
      latest: {
        openTrades: [],
        _freshness: {
          status: 'FRESH_DASHBOARD_SNAPSHOT',
          stale: false,
          fresh: true,
        },
      },
      mt5Snapshot: {
        ok: true,
        _api: { ok: true },
        status: 'FRESH_EA_SNAPSHOT',
        snapshotFresh: true,
        connection: readyReadonlyConnection(),
        _freshness: {
          status: 'FRESH_EA_SNAPSHOT',
          stale: false,
          fresh: true,
        },
      },
      secondaryMt5Snapshot: {
        ok: true,
        _api: { ok: true },
        status: 'FRESH_EA_SNAPSHOT',
        snapshotFresh: true,
        connection: readyReadonlyConnection(),
        _freshness: { status: 'FRESH_EA_SNAPSHOT', stale: false, fresh: true },
      },
    });

    const text = wrapper.text();
    expect(text).toContain('只读当前状态可复核');
    expect(text).toContain('暂无持仓快照');
    expect(text).not.toContain('当前持仓不可确认');
  });
});
