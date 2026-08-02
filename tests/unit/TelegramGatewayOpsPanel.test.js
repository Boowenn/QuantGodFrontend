import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TelegramGatewayOpsPanel from '../../src/components/TelegramGatewayOpsPanel.vue';

const SAFE_BOUNDARY = Object.freeze({
  pushOnly: true,
  gatewayReceivesCommands: false,
  telegramCommandExecutionAllowed: false,
  orderSendAllowed: false,
  closeAllowed: false,
  cancelAllowed: false,
  livePresetMutationAllowed: false,
  writesMt5OrderRequest: false,
  externalMarketRealMoneyAllowed: false,
});

function gatewayPayload(overrides = {}) {
  return {
    ok: true,
    status: 'GATEWAY_OBSERVABLE',
    statusZh: 'Gateway 可观测',
    pushAllowed: true,
    commandsAllowed: false,
    commandsEnvRequested: false,
    safety: SAFE_BOUNDARY,
    ...overrides,
  };
}

describe('TelegramGatewayOpsPanel', () => {
  it('keeps missing metrics and safety evidence unknown', () => {
    const wrapper = mount(TelegramGatewayOpsPanel, { props: { payload: {} } });

    expect(wrapper.get('[data-testid="telegram-queued-count"]').text()).toBe('—');
    expect(wrapper.get('[data-testid="telegram-sent-count"]').text()).toBe('—');
    expect(wrapper.get('[data-testid="telegram-safety-status"]').text()).toBe('Telegram 边界未确认');
  });

  it('does not replace the payload object with its string status field', () => {
    const wrapper = mount(TelegramGatewayOpsPanel, {
      props: {
        payload: gatewayPayload({
          queuedCount: 4,
          pendingCount: 1,
          ledgerCount: 3,
          actualSentCount: 0,
        }),
      },
    });

    expect(wrapper.get('[data-testid="telegram-gateway-status"]').text()).toBe('Gateway 可观测');
    expect(wrapper.get('[data-testid="telegram-queued-count"]').text()).toBe('4');
    expect(wrapper.get('[data-testid="telegram-safety-status"]').text()).toBe('Telegram 仅出站推送已就绪');
  });

  it('renders failed, unconfirmed, and acknowledged delivery rows precisely', () => {
    const wrapper = mount(TelegramGatewayOpsPanel, {
      props: {
        payload: gatewayPayload({
          latestTopicRows: [
            {
              eventId: 'failed',
              topic: 'FAILED_TOPIC',
              deliveryOk: false,
              reason: 'network_down',
              processedAtIso: '2026-08-01T12:00:00Z',
            },
            {
              eventId: 'unconfirmed',
              topic: 'UNCONFIRMED_TOPIC',
              deliveryOk: true,
              processedAtIso: '2026-08-01T12:00:00Z',
            },
            {
              eventId: 'sent',
              topic: 'SENT_TOPIC',
              deliveryOk: true,
              messageId: 19,
              sentAtIso: '2026-08-01T12:00:00Z',
              processedAtIso: '2026-08-01T12:00:00Z',
            },
          ],
        }),
      },
    });
    const rows = wrapper.findAll('tbody tr').map((row) => row.text());

    expect(rows.find((row) => row.includes('FAILED_TOPIC'))).toContain('投递失败');
    expect(rows.find((row) => row.includes('UNCONFIRMED_TOPIC'))).toContain('投递未确认');
    expect(rows.find((row) => row.includes('UNCONFIRMED_TOPIC'))).not.toContain('已投递');
    expect(rows.find((row) => row.includes('SENT_TOPIC'))).toContain('已投递');
  });

  it('blocks command environment requests and sent counts without a timestamp', () => {
    const wrapper = mount(TelegramGatewayOpsPanel, {
      props: {
        payload: gatewayPayload({
          commandsEnvRequested: true,
          actualSentCount: 2,
          deliveryObservability: {},
        }),
      },
    });

    expect(wrapper.get('[data-testid="telegram-safety-status"]').text()).toContain('命令开关');
    expect(wrapper.get('[data-testid="telegram-sent-count"]').text()).toBe('—');
  });

  it('shows an aggregate sent count only with delivery-time evidence', () => {
    const wrapper = mount(TelegramGatewayOpsPanel, {
      props: {
        payload: gatewayPayload({
          actualSentCount: 2,
          deliveryObservability: { lastActualSentAtIso: '2026-08-01T12:00:00Z' },
        }),
      },
    });

    expect(wrapper.get('[data-testid="telegram-sent-count"]').text()).toBe('2');
  });
});
