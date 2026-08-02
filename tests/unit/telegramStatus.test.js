import { describe, expect, it } from 'vitest';
import {
  buildTelegramDigest,
  formatTelegramTimestamp,
  normalizeTelegramDelivery,
  normalizeTelegramSafety,
  TELEGRAM_DIGEST_MAX_CHARS,
  TELEGRAM_SHADOW_FOOTER,
  telegramAdvisoryLabel,
  telegramMetric,
  unwrapTelegramPayload,
} from '../../src/utils/telegramStatus.js';

const COMPLETE_SAFE_BOUNDARY = Object.freeze({
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

function safeGateway(overrides = {}) {
  return {
    ok: true,
    status: 'GATEWAY_OBSERVABLE',
    pushAllowed: true,
    commandsAllowed: false,
    commandsEnvRequested: false,
    safety: COMPLETE_SAFE_BOUNDARY,
    ...overrides,
  };
}

describe('Telegram payload normalization', () => {
  it('keeps an object whose status field is a string', () => {
    const payload = { ok: true, status: 'GATEWAY_OBSERVABLE', queuedCount: 2 };

    expect(unwrapTelegramPayload(payload)).toBe(payload);
  });

  it('unwraps only object envelopes', () => {
    expect(unwrapTelegramPayload({ payload: { ok: true, queuedCount: 3 } })).toMatchObject({
      queuedCount: 3,
    });
    expect(unwrapTelegramPayload(null)).toEqual({});
  });
});

describe('Telegram safety is fail-closed', () => {
  it('accepts only a complete push-only boundary', () => {
    expect(normalizeTelegramSafety(safeGateway())).toMatchObject({
      code: 'PUSH_READY',
      tone: 'ok',
      ready: true,
      boundaryConfirmed: true,
    });
  });

  it('blocks an empty or incomplete safety envelope', () => {
    expect(normalizeTelegramSafety({})).toMatchObject({
      code: 'BOUNDARY_UNCONFIRMED',
      ready: false,
    });
    expect(
      normalizeTelegramSafety({
        ...safeGateway(),
        commandsEnvRequested: undefined,
      }),
    ).toMatchObject({ code: 'BOUNDARY_UNCONFIRMED', ready: false });
  });

  it('blocks command requests and every unsafe trading capability', () => {
    expect(normalizeTelegramSafety(safeGateway({ commandsEnvRequested: true }))).toMatchObject({
      code: 'COMMAND_ENV_BLOCKED',
      ready: false,
    });
    expect(normalizeTelegramSafety(safeGateway({ commandsAllowed: true }))).toMatchObject({
      code: 'BOUNDARY_UNSAFE',
      ready: false,
    });
    expect(
      normalizeTelegramSafety(safeGateway({ safety: { ...COMPLETE_SAFE_BOUNDARY, orderSendAllowed: true } })),
    ).toMatchObject({ code: 'BOUNDARY_UNSAFE', ready: false });
    expect(
      normalizeTelegramSafety(
        safeGateway({
          telegramEnvironmentSafe: false,
          blockedUnsafeEnvironmentKeys: ['QG_ORDER_SEND_ALLOWED'],
        }),
      ),
    ).toMatchObject({ code: 'BOUNDARY_UNSAFE', ready: false });
    expect(normalizeTelegramSafety(safeGateway({ environmentSafe: false }))).toMatchObject({
      code: 'BOUNDARY_UNSAFE',
      ready: false,
    });
    for (const capability of [
      'executionLaneExists',
      'positionModifyAllowed',
      'walletSigningAllowed',
      'withdrawalAllowed',
    ]) {
      expect(
        normalizeTelegramSafety(safeGateway({ safety: { ...COMPLETE_SAFE_BOUNDARY, [capability]: true } })),
      ).toMatchObject({ code: 'BOUNDARY_UNSAFE', ready: false });
    }
  });

  it('distinguishes disabled, unconfigured, and unconfirmed push state', () => {
    expect(normalizeTelegramSafety(safeGateway({ pushAllowed: false }))).toMatchObject({
      code: 'PUSH_DISABLED',
      tone: 'warn',
    });
    expect(normalizeTelegramSafety(safeGateway({ pushAllowed: undefined }))).toMatchObject({
      code: 'PUSH_UNCONFIRMED',
      tone: 'blocked',
    });
    expect(
      normalizeTelegramSafety(safeGateway({ telegramConfigured: false }), {
        requireConfigured: true,
      }),
    ).toMatchObject({ code: 'UNCONFIGURED', ready: false });
  });
});

describe('Telegram delivery requires explicit acknowledgement and a receipt', () => {
  const unconfirmed = [
    { ok: true },
    { ok: true, sent: false },
    { ok: true, status: 'sent' },
    { ok: true, sent: true },
    { deliveryOk: true },
    { sent: true, createdAt: '2026-08-01T12:00:00Z' },
    { sent: true, timestamp: '2026-08-01T12:00:00Z' },
    { deliveryOk: true, processedAtIso: '2026-08-01T12:00:00Z' },
    { delivery: { ok: true, record: { timestamp: '2026-08-01T12:00:00Z' } } },
  ];

  it.each(unconfirmed)('does not turn API completion into delivery: %j', (payload) => {
    const result = normalizeTelegramDelivery(payload);
    expect(result.code).toBe('UNCONFIRMED');
    expect(result.tone).not.toBe('ok');
    expect(result.label).not.toBe('已投递');
  });

  it('accepts sent=true only when a receipt id or delivery time is present', () => {
    expect(normalizeTelegramDelivery({ sent: true, telegramMessageId: 7 })).toMatchObject({
      code: 'SENT',
      tone: 'ok',
      receiptId: '7',
    });
    expect(
      normalizeTelegramDelivery({ delivery: { ok: true, sentAtIso: '2026-08-01T12:00:00Z' } }),
    ).toMatchObject({ code: 'SENT', tone: 'ok' });
    expect(
      normalizeTelegramDelivery({ deliveryOk: true, processedAtIso: '2026-08-01T12:00:00Z' }),
    ).toMatchObject({ code: 'UNCONFIRMED', tone: 'blocked' });
  });

  it('fails closed when multi-item delivery results are mixed', () => {
    const mixed = normalizeTelegramDelivery({
      ok: true,
      items: [
        {
          symbol: 'USDJPYc',
          delivery: { ok: true, messageId: 7, sentAtIso: '2026-08-01T12:00:00Z' },
        },
        { symbol: 'USDJPY', delivery: { ok: false, error: 'network_down' } },
      ],
    });

    expect(mixed).toMatchObject({ code: 'FAILED', tone: 'blocked', label: '投递失败' });
    expect(mixed.detail).toContain('1 条投递失败');

    expect(
      normalizeTelegramDelivery({
        ok: false,
        error: 'aggregate_failed',
        items: [{ delivery: { ok: true, messageId: 7 } }, { delivery: { ok: true, messageId: 8 } }],
      }),
    ).toMatchObject({ code: 'FAILED', tone: 'blocked' });
  });

  it('requires every multi-item result to have a receipt before reporting sent', () => {
    expect(
      normalizeTelegramDelivery({
        ok: true,
        items: [
          { delivery: { ok: true, messageId: 7 } },
          { delivery: { ok: true, sentAtIso: '2026-08-01T12:00:00Z' } },
        ],
      }),
    ).toMatchObject({ code: 'SENT', tone: 'ok' });
    expect(
      normalizeTelegramDelivery({
        ok: true,
        items: [
          { delivery: { ok: true, messageId: 7 } },
          { delivery: { ok: true, processedAtIso: '2026-08-01T12:00:00Z' } },
        ],
      }),
    ).toMatchObject({ code: 'UNCONFIRMED', tone: 'blocked' });
  });

  it('keeps preview, queue, suppression, and failures distinct', () => {
    expect(normalizeTelegramDelivery({ ok: true, dryRun: true })).toMatchObject({
      code: 'PREVIEW_ONLY',
    });
    expect(normalizeTelegramDelivery({ ok: true, status: 'queued' })).toMatchObject({
      code: 'QUEUED',
    });
    expect(
      normalizeTelegramDelivery({
        delivery: { skipped: true, reason: 'duplicate_suppressed' },
      }),
    ).toMatchObject({ code: 'SUPPRESSED_DUPLICATE' });
    expect(normalizeTelegramDelivery({ delivery: { skipped: true, reason: 'rate_limited' } })).toMatchObject({
      code: 'SUPPRESSED_RATE_LIMIT',
    });
    expect(normalizeTelegramDelivery({ ok: false, error: 'network_down' })).toMatchObject({
      code: 'FAILED',
      tone: 'blocked',
    });
  });
});

describe('Telegram display helpers', () => {
  it('does not turn a missing metric into zero', () => {
    expect(telegramMetric(undefined)).toBe('—');
    expect(telegramMetric(null)).toBe('—');
    expect(telegramMetric('')).toBe('—');
    expect(telegramMetric(0)).toBe(0);
  });

  it('formats timestamps and advisory actions for operators', () => {
    expect(formatTelegramTimestamp('2026-08-01T12:00:00Z')).toBe('2026-08-01 21:00:00 JST');
    expect(formatTelegramTimestamp('bad')).toBe('时间无效');
    expect(telegramAdvisoryLabel('WATCH_LONG')).toBe('偏多观察');
    expect(telegramAdvisoryLabel('HOLD')).toBe('继续观察');
  });

  it('builds a compact digest with the immutable Shadow footer', () => {
    const digest = buildTelegramDigest({
      topic: 'AI 回测状态',
      conclusion: '继续观察。',
      keyMetrics: ['USDJPYc', '任务 20', '谨慎 18', '可复核 2', '第五项不应出现'],
      reasons: ['PF 未达标', '样本不足', '第三条不应出现'],
      nextAction: '继续采集样本。',
      timestamp: '2026-08-01T12:00:00Z',
    });
    const lines = digest.split('\n');

    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(digest.length).toBeLessThanOrEqual(TELEGRAM_DIGEST_MAX_CHARS);
    expect(lines.at(-1)).toBe(TELEGRAM_SHADOW_FOOTER);
    expect(lines[1]).toBe('结论：继续观察。');
    expect(digest).not.toContain('第五项');
    expect(digest).not.toContain('第三条');
  });
});
