import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  load: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../src/services/backtestAiApi.js', () => ({
  DEFAULT_BACKTEST_SYMBOLS: ['USDJPYc'],
  aiRows: () => [],
  backtestRows: () => [],
  notifyRows: () => [],
  loadBacktestAiState: serviceMocks.load,
  runBacktestAiCycle: serviceMocks.run,
  summarizeAiReport: () => ({
    itemCount: 1,
    verdict: '继续观察',
    headline: '只读分析完成',
    confidence: '',
  }),
  summarizeBacktest: () => ({
    taskCount: 1,
    readyCount: 0,
    cautionCount: 1,
    topRouteKey: 'MA_Cross',
    topRankScore: 1,
  }),
  summarizeNotifyConfig: () => ({
    configured: true,
    ready: false,
    statusLabel: 'Telegram 边界未确认',
    statusDetail: '缺少完整安全证据。',
    statusTone: 'blocked',
    chatIdRedacted: '***123',
  }),
}));

import BacktestAiWorkspace from '../../src/workspaces/backtest-ai/BacktestAiWorkspace.vue';

function statePayload() {
  return {
    backtest: { ok: true },
    aiLatest: { ok: true },
    notifyConfig: { ok: true },
    notifyHistory: { ok: true, items: [] },
  };
}

describe('BacktestAiWorkspace Telegram safety', () => {
  beforeEach(() => {
    serviceMocks.load.mockReset().mockResolvedValue(statePayload());
    serviceMocks.run.mockReset();
  });

  it('starts with Telegram delivery disabled', async () => {
    const wrapper = mount(BacktestAiWorkspace);
    await flushPromises();

    const telegramCheckbox = wrapper.findAll('input[type="checkbox"]')[0];
    expect(telegramCheckbox.element.checked).toBe(false);
    expect(wrapper.text()).toContain('一键只读回测');
  });

  it('does not display API ok=true as a confirmed delivery', async () => {
    serviceMocks.run.mockResolvedValue({
      ok: true,
      sendTelegramRequested: true,
      backtest: { ok: true },
      ai: { ok: true },
      notify: { ok: true },
    });
    const wrapper = mount(BacktestAiWorkspace);
    await flushPromises();

    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
    await wrapper.get('.qg-button--primary').trigger('click');
    await flushPromises();

    expect(serviceMocks.run).toHaveBeenCalledWith(expect.objectContaining({ sendTelegram: true }));
    expect(wrapper.text()).toContain('投递未确认');
    expect(wrapper.text()).not.toContain('已发送');
  });

  it('shows delivered only with an explicit sent flag and receipt', async () => {
    serviceMocks.run.mockResolvedValue({
      ok: true,
      sendTelegramRequested: true,
      backtest: { ok: true },
      ai: { ok: true },
      notify: {
        ok: true,
        sent: true,
        telegramMessageId: 19,
        sentAtIso: '2026-08-01T12:00:00Z',
      },
    });
    const wrapper = mount(BacktestAiWorkspace);
    await flushPromises();

    await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
    await wrapper.get('.qg-button--primary').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('已投递');
  });
});
