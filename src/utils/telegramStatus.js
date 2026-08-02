function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstBoolean(...values) {
  return values.find((value) => typeof value === 'boolean') ?? null;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function valuesForKeys(sources, keys) {
  return sources.flatMap((source) =>
    keys
      .map((key) => (isObject(source) ? source[key] : undefined))
      .filter((value) => typeof value === 'boolean'),
  );
}

export const TELEGRAM_DIGEST_MAX_CHARS = 700;
export const TELEGRAM_SHADOW_FOOTER = '边界：永久 Shadow｜无执行通道｜Telegram 只推送、不接收命令。';

function compactDigestText(value, fallback, maxLength) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const text = normalized || fallback;
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

function telegramDigestTime(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(safeDate)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute} JST`;
}

export function buildTelegramDigest({
  icon = '🟡',
  topic = '状态',
  conclusion,
  keyMetrics = [],
  reasons = [],
  nextAction,
  timestamp,
} = {}) {
  const metrics = keyMetrics
    .filter((item) => String(item ?? '').trim())
    .slice(0, 4)
    .map((item) => compactDigestText(item, '未确认', 44));
  const reasonItems = reasons
    .filter((item) => String(item ?? '').trim())
    .slice(0, 2)
    .map((item) => compactDigestText(item, '', 52));
  const lines = [
    `${compactDigestText(icon, '🟡', 2)} QuantGod · ${compactDigestText(topic, '状态', 28)}`,
    `结论：${compactDigestText(conclusion, '继续 Shadow 观察。', 120)}`,
    `关键：${metrics.length ? metrics.join('｜') : '关键证据未确认'}`,
  ];
  if (reasonItems.length) lines.push(`原因：${reasonItems.join('；')}`);
  lines.push(
    `下一步：${compactDigestText(nextAction, '继续采集并复核本地 Shadow 证据。', 100)}`,
    `时间：${telegramDigestTime(timestamp)}`,
    TELEGRAM_SHADOW_FOOTER,
  );
  const digest = lines.join('\n');
  if (digest.length > TELEGRAM_DIGEST_MAX_CHARS) {
    throw new Error('Telegram digest exceeded the 700-character contract');
  }
  return digest;
}

export function unwrapTelegramPayload(value) {
  if (!isObject(value)) return {};
  for (const key of ['payload', 'data', 'result']) {
    if (isObject(value[key])) return value[key];
  }
  if (isObject(value.status)) return value.status;
  return value;
}

function configuredState(state, safety) {
  const configured = firstBoolean(state.telegramConfigured, safety.telegramConfigured);
  if (configured !== null) return configured;

  const tokenConfigured = firstBoolean(
    state.tokenConfigured,
    state.botTokenConfigured,
    safety.telegramBotTokenConfigured,
  );
  const chatConfigured = firstBoolean(
    state.chatConfigured,
    state.chatIdConfigured,
    safety.telegramChatIdConfigured,
  );
  if (tokenConfigured === false || chatConfigured === false) return false;
  if (tokenConfigured === true && chatConfigured === true) return true;
  return null;
}

export function normalizeTelegramSafety(
  value,
  { requireConfigured = false, requirePushAllowed = true } = {},
) {
  const state = unwrapTelegramPayload(value);
  const safety = isObject(state.safety) ? state.safety : {};
  const sources = [state, safety];
  const commandSetting = firstBoolean(
    state.commandsAllowed,
    state.telegramCommandsAccepted,
    safety.commandsAllowed,
    safety.telegramCommandsAccepted,
  );
  const commandExecution = firstBoolean(
    state.telegramCommandExecutionAllowed,
    safety.telegramCommandExecutionAllowed,
  );
  const commandReceiver = firstBoolean(state.gatewayReceivesCommands, safety.gatewayReceivesCommands);
  const executionKeys = ['orderSendAllowed', 'closeAllowed', 'cancelAllowed', 'livePresetMutationAllowed'];
  const executionValues = executionKeys.map((key) => firstBoolean(state[key], safety[key]));
  const optionalUnsafeValues = valuesForKeys(sources, [
    'executionLaneExists',
    'modifyAllowed',
    'positionModifyAllowed',
    'writesMt5OrderRequest',
    'brokerOrderSendAllowed',
    'liveExecutionAllowed',
    'pilotExecutionAllowed',
    'externalMarketOrderAllowed',
    'externalMarketRealMoneyAllowed',
    'canExecuteTrade',
    'walletSigningAllowed',
    'walletExecutionAllowed',
    'withdrawalAllowed',
    'webhookExecutionAllowed',
    'credentialStorageAllowed',
    'canOverrideKillSwitch',
  ]);
  const pushOnly = firstBoolean(
    state.pushOnly,
    state.notificationPushOnly,
    safety.pushOnly,
    safety.notificationPushOnly,
  );
  const pushAllowed = firstBoolean(
    state.pushAllowed,
    state.telegramPushAllowed,
    safety.pushAllowed,
    safety.telegramPushAllowed,
  );
  const configured = configuredState(state, safety);
  const enabled = firstBoolean(state.enabled, safety.enabled);
  const commandsEnvRequested = firstBoolean(state.commandsEnvRequested, safety.commandsEnvRequested);
  const commandRequestDetected = commandsEnvRequested === true;
  const blockedEnvironmentKeys =
    [state.blockedUnsafeEnvironmentKeys, safety.blockedUnsafeEnvironmentKeys].find((value) =>
      Array.isArray(value),
    ) || [];
  const nonCommandEnvironmentViolation = blockedEnvironmentKeys.some(
    (key) => String(key || '').trim() !== 'QG_TELEGRAM_COMMANDS_ALLOWED',
  );
  const unsafeEnvironmentFlag = firstBoolean(state.unsafeEnvironmentBlocked, safety.unsafeEnvironmentBlocked);
  const telegramEnvironmentSafe = firstBoolean(
    state.telegramEnvironmentSafe,
    state.environmentSafe,
    safety.telegramEnvironmentSafe,
    safety.environmentSafe,
  );
  const broadEnvironmentUnsafe =
    nonCommandEnvironmentViolation ||
    telegramEnvironmentSafe === false ||
    (unsafeEnvironmentFlag === true && !commandRequestDetected && blockedEnvironmentKeys.length === 0);
  const unsafeCapabilityDetected =
    [commandSetting, commandExecution, commandReceiver].includes(true) ||
    executionValues.some((value) => value === true) ||
    optionalUnsafeValues.includes(true) ||
    broadEnvironmentUnsafe;
  const boundaryConfirmed =
    pushOnly === true &&
    commandSetting === false &&
    commandExecution === false &&
    commandReceiver === false &&
    commandsEnvRequested === false &&
    executionValues.every((value) => value === false) &&
    !unsafeCapabilityDetected;

  const base = {
    state,
    safety,
    configured,
    pushAllowed,
    pushOnly,
    commandsBlocked: commandSetting === false && commandExecution === false && commandReceiver === false,
    commandsEnvRequested,
    blockedEnvironmentKeys,
    commandRequestDetected,
    boundaryConfirmed,
    ready: false,
  };

  if (state.ok === false || state._api?.ok === false) {
    return {
      ...base,
      code: 'UNAVAILABLE',
      tone: 'blocked',
      label: 'Telegram 状态不可用',
      reason: firstText(state.statusZh, state.error, state._api?.error?.message, '接口未返回可信状态。'),
    };
  }
  if (unsafeCapabilityDetected) {
    return {
      ...base,
      code: 'BOUNDARY_UNSAFE',
      tone: 'blocked',
      label: 'Telegram 安全边界异常',
      reason: '检测到命令、交易执行、资金或外部签名能力，已按 fail-closed 阻断。',
    };
  }
  if (commandRequestDetected) {
    return {
      ...base,
      code: 'COMMAND_ENV_BLOCKED',
      tone: 'blocked',
      label: '命令开关误设（执行入口已阻断）',
      reason: firstText(state.commandsBlockedReason, '请关闭 Telegram 命令环境开关后重新检查。'),
    };
  }
  if (!boundaryConfirmed) {
    return {
      ...base,
      code: 'BOUNDARY_UNCONFIRMED',
      tone: 'blocked',
      label: 'Telegram 边界未确认',
      reason: '缺少完整的 push-only、命令关闭或交易能力关闭证据。',
    };
  }
  if (requireConfigured && configured !== true) {
    return {
      ...base,
      code: configured === false ? 'UNCONFIGURED' : 'CONFIG_UNCONFIRMED',
      tone: configured === false ? 'warn' : 'blocked',
      label: configured === false ? 'Telegram 未配置' : 'Telegram 配置未确认',
      reason:
        configured === false ? 'Bot Token 或 Chat ID 尚未完整配置。' : '接口未明确返回 Telegram 配置状态。',
    };
  }
  if (enabled === false || (requirePushAllowed && pushAllowed === false)) {
    return {
      ...base,
      code: 'PUSH_DISABLED',
      tone: 'warn',
      label: 'Telegram 推送已关闭',
      reason: '当前只允许预览或本地记录，不会产生真实外部投递。',
    };
  }
  if (requirePushAllowed && pushAllowed !== true) {
    return {
      ...base,
      code: 'PUSH_UNCONFIRMED',
      tone: 'blocked',
      label: 'Telegram 推送状态未确认',
      reason: '接口未明确返回 pushAllowed=true。',
    };
  }
  return {
    ...base,
    code: 'PUSH_READY',
    tone: 'ok',
    label: 'Telegram 仅出站推送已就绪',
    reason: '命令入口和交易修改能力均已关闭。',
    ready: true,
  };
}

function deliveryCandidates(value) {
  const state = unwrapTelegramPayload(value);
  const firstItem = Array.isArray(state.items) ? state.items.find((item) => isObject(item?.delivery)) : null;
  const stateRecord = isObject(state.record) ? state.record : {};
  const delivery = isObject(state.delivery)
    ? state.delivery
    : isObject(stateRecord.delivery)
      ? stateRecord.delivery
      : isObject(firstItem?.delivery)
        ? firstItem.delivery
        : {};
  const record = isObject(state.record) ? state.record : isObject(delivery.record) ? delivery.record : {};
  return { state, record, delivery, candidates: [delivery, record, state] };
}

export function normalizeTelegramDelivery(value) {
  const state = unwrapTelegramPayload(value);
  const items = Array.isArray(state.items) ? state.items.filter(isObject) : [];
  if (items.length > 1) {
    if (state.ok === false || state.deliveryOk === false || state.error) {
      return normalizeSingleTelegramDelivery(value);
    }
    const results = items.map((item) =>
      normalizeSingleTelegramDelivery({
        ...item,
        dryRun: state.dryRun === true || item.dryRun === true,
        previewOnly: state.previewOnly === true || item.previewOnly === true,
      }),
    );
    return aggregateTelegramDeliveries(state, results);
  }
  return normalizeSingleTelegramDelivery(value);
}

function aggregateTelegramDeliveries(state, results) {
  const counts = results.reduce((accumulator, result) => {
    accumulator[result.code] = (accumulator[result.code] || 0) + 1;
    return accumulator;
  }, {});
  const failed = results.find((result) => result.code === 'FAILED');
  if (failed) {
    return {
      ...failed,
      raw: state,
      detail: `共 ${results.length} 条，${counts.FAILED || 0} 条投递失败：${failed.detail}`,
    };
  }
  const unconfirmed = results.find((result) => result.code === 'UNCONFIRMED');
  if (unconfirmed) {
    return {
      ...unconfirmed,
      raw: state,
      detail: `共 ${results.length} 条，${counts.UNCONFIRMED || 0} 条未返回可验证回执。`,
    };
  }
  if (results.every((result) => result.code === 'SENT')) {
    return {
      ...results[0],
      raw: state,
      detail: `${results.length} 条均已获得 Telegram 投递回执。`,
    };
  }
  if (results.every((result) => result.code === results[0].code)) {
    return { ...results[0], raw: state };
  }
  return {
    raw: state,
    receiptId: '',
    receiptTime: '',
    reason: '',
    code: 'UNCONFIRMED',
    tone: 'blocked',
    label: '投递未确认',
    detail: `共 ${results.length} 条结果不一致，未全部获得 Telegram 回执。`,
  };
}

function normalizeSingleTelegramDelivery(value) {
  const { state, record, delivery, candidates } = deliveryCandidates(value);
  const statuses = candidates
    .map((item) => firstText(item.status, item.deliveryStatus, item.state))
    .filter(Boolean)
    .map((item) => item.toUpperCase());
  const reason = firstText(delivery.reason, delivery.error, state.reason, state.error, state.message);
  const receiptId = firstText(
    delivery.telegramMessageId,
    delivery.messageId,
    delivery.message_id,
    delivery.telegram?.result?.message_id,
    delivery.result?.message_id,
    record.telegramMessageId,
    record.messageId,
    record.message_id,
    state.telegramMessageId,
    state.messageId,
    state.message_id,
    state.receiptId,
  );
  const receiptTime = firstText(
    delivery.sentAtIso,
    delivery.sentAt,
    delivery.deliveredAtIso,
    delivery.deliveredAt,
    record.sentAtIso,
    record.sentAt,
    record.deliveredAtIso,
    record.deliveredAt,
    state.sentAtIso,
    state.sentAt,
    state.deliveredAtIso,
    state.deliveredAt,
  );
  // A generic API-level `ok=true` only means the request completed. It is not
  // proof that Telegram accepted a message. Keep the delivery contract
  // fail-closed and require an explicit delivery flag plus a receipt or time.
  const explicitSent =
    state.sent === true ||
    state.deliveryOk === true ||
    record.sent === true ||
    record.deliveryOk === true ||
    delivery.sent === true ||
    delivery.deliveryOk === true ||
    delivery.ok === true;
  const deliveryFailure =
    state.ok === false ||
    state.deliveryOk === false ||
    record.deliveryOk === false ||
    delivery.ok === false ||
    candidates.some((item) => Boolean(item.error)) ||
    statuses.some((status) => /FAIL|ERROR/.test(status));
  const skipped =
    candidates.some((item) => item.skipped === true) || statuses.some((status) => status.includes('SKIP'));
  const dryRun =
    candidates.some((item) => item.dryRun === true || item.previewOnly === true) ||
    statuses.some((status) => status.includes('DRY_RUN') || status.includes('PREVIEW'));
  const queued = statuses.some((status) => status.includes('QUEUE') || status.includes('PENDING'));
  const receipt = receiptId || receiptTime;
  const base = { raw: state, receiptId, receiptTime, reason };

  if (deliveryFailure && !skipped) {
    return {
      ...base,
      code: 'FAILED',
      tone: 'blocked',
      label: '投递失败',
      detail: reason || 'Telegram 未返回成功回执。',
    };
  }
  if (dryRun) {
    return {
      ...base,
      code: 'PREVIEW_ONLY',
      tone: 'warn',
      label: '仅预览，未推送',
      detail: reason || '本次只生成本地证据。',
    };
  }
  if (skipped) {
    const normalizedReason = reason.toLowerCase();
    if (normalizedReason.includes('duplicate')) {
      return {
        ...base,
        code: 'SUPPRESSED_DUPLICATE',
        tone: 'warn',
        label: '已去重，未重复推送',
        detail: reason,
      };
    }
    if (normalizedReason.includes('rate') || normalizedReason.includes('interval')) {
      return {
        ...base,
        code: 'SUPPRESSED_RATE_LIMIT',
        tone: 'warn',
        label: '已限频，未推送',
        detail: reason,
      };
    }
    return {
      ...base,
      code: 'SUPPRESSED',
      tone: 'warn',
      label: '已抑制，未推送',
      detail: reason || '本次报告未进入外部投递。',
    };
  }
  if (queued) {
    return {
      ...base,
      code: 'QUEUED',
      tone: 'warn',
      label: '已入队，尚未投递',
      detail: reason || '等待本地 Gateway 处理。',
    };
  }
  if (explicitSent && receipt) {
    return {
      ...base,
      code: 'SENT',
      tone: 'ok',
      label: '已投递',
      detail: receiptId ? `Telegram 回执 #${receiptId}` : `投递时间 ${formatTelegramTimestamp(receiptTime)}`,
    };
  }
  if (explicitSent) {
    return {
      ...base,
      code: 'UNCONFIRMED',
      tone: 'blocked',
      label: '投递未确认',
      detail: '接口声称成功，但未返回消息回执或投递时间。',
    };
  }
  return {
    ...base,
    code: 'UNCONFIRMED',
    tone: 'blocked',
    label: '投递未确认',
    detail: reason || '未收到明确的 Telegram 投递结果。',
  };
}

export function telegramMetric(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number : '—';
}

export function formatTelegramTimestamp(value) {
  if (!value) return '时间未返回';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间无效';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} JST`;
}

export function telegramAdvisoryLabel(value) {
  const code = String(value || 'HOLD')
    .trim()
    .toUpperCase();
  const labels = {
    HOLD: '继续观察',
    WATCH_LONG: '偏多观察',
    WATCH_SHORT: '偏空观察',
    SHADOW_ADVISORY_READY: '影子建议已就绪',
    READY_FOR_EXISTING_EA: '影子建议已就绪（旧契约）',
  };
  return labels[code] || String(value || '继续观察');
}
