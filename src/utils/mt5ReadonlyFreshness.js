const DEFAULT_MAX_AGE_SECONDS = 180;

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== '';
}

function unwrapPayload(payload) {
  if (!isObject(payload)) return payload;
  if (isObject(payload.data) && present(payload.data)) return payload.data;
  if (isObject(payload.result) && present(payload.result)) return payload.result;
  return payload;
}

function statusOf(value) {
  return String(value || '').toUpperCase();
}

function sourceFileOf(source = {}, freshness = {}) {
  return freshness.sourceFile || source?.sourceFile || source?.source?.file || source?.file || '';
}

function sourceMtimeOf(source = {}, freshness = {}) {
  return freshness.mtimeIso || source?.source?.mtimeIso || source?.mtimeIso || '';
}

function sourceAgeOf(source = {}, freshness = {}) {
  return freshness.ageSeconds ?? source?.source?.ageSeconds ?? source?.ageSeconds;
}

function sourceMaxAgeOf(source = {}, freshness = {}) {
  return freshness.maxAgeSeconds ?? source?.source?.maxAgeSeconds ?? source?.maxAgeSeconds;
}

function apiFailed(source = {}) {
  const api = isObject(source._api) ? source._api : {};
  return source.ok === false || source.endpointLoadFailed === true || api.ok === false;
}

function optionalLaneDisabled(source = {}, freshness = {}) {
  return (
    statusOf(source.status || freshness.status) === 'DISABLED' &&
    (source.optional === true || freshness.optional === true) &&
    (source.enabled === false || freshness.enabled === false)
  );
}

function terminalMissing(source = {}) {
  if (optionalLaneDisabled(source, source._freshness || {})) return false;
  const terminal = isObject(source.terminal) ? source.terminal : {};
  const process = isObject(source.hostProcess) ? source.hostProcess : {};
  return (
    process.terminalProcessDetected === false ||
    terminal.hostProcessDetected === false ||
    terminal.terminalProcessDetected === false ||
    statusOf(process.status || terminal.hostProcessStatus) === 'MISSING'
  );
}

function freshnessTerminalMissing(source = {}, freshness = {}) {
  if (optionalLaneDisabled(source, freshness)) return false;
  const blockers = Array.isArray(freshness.blockers) ? freshness.blockers : [];
  return (
    terminalMissing(source) ||
    freshness.terminalProcessDetected === false ||
    freshness.hostProcessDetected === false ||
    statusOf(freshness.hostProcessStatus) === 'MISSING' ||
    blockers.includes('mt5_terminal_process_missing')
  );
}

function normalizeDisabledFreshness(freshness = {}) {
  return {
    ...freshness,
    mode: freshness.mode || 'MT5_OPTIONAL_SECONDARY_LANE',
    status: 'DISABLED',
    statusLabel: freshness.statusLabel || 'Optional secondary MT5 lane disabled',
    statusZh: freshness.statusZh || '可选第二 MT5 账号未启用',
    fresh: true,
    stale: false,
    unavailable: false,
    missing: false,
    unconfirmed: false,
    optional: true,
    enabled: false,
    terminalProcessMissing: false,
    sourceFile: '',
    mtimeIso: '',
    blockers: [],
    nextActionZh:
      freshness.nextActionZh || '第二账号为可选车道；账号重新有效并完成只读 EA 配置后，再显式启用。',
    recoveryStepsZh: [],
    orderSendAllowed: false,
    mt5OrderSendAllowed: false,
    brokerCallsMade: false,
    mutatesMt5: false,
  };
}

function recoveryStepsZh(refreshEndpoint = '') {
  return [
    '确认对应 HFM/MT5 终端正在运行。',
    '确认 QuantGod EA 已加载并持续写出 QuantGod_Dashboard.json。',
    refreshEndpoint ? `刷新 ${refreshEndpoint}，直到 freshness 重新变为 fresh。` : '',
  ].filter(Boolean);
}

function scopedRecoveryStep(step, refreshEndpoint = '') {
  const text = String(step || '').trim();
  if (!text || !refreshEndpoint) return text;
  return text.replace(/\/api\/mt5-readonly(?:-secondary)?\/snapshot/g, refreshEndpoint);
}

function normalizeRecoverySteps(freshness = {}, refreshEndpoint = '') {
  const rawSteps = freshness.recoveryStepsZh || freshness.recoverySteps || recoveryStepsZh(refreshEndpoint);
  const steps = (Array.isArray(rawSteps) ? rawSteps : [rawSteps])
    .map((step) => scopedRecoveryStep(step, refreshEndpoint))
    .filter(Boolean);
  if (refreshEndpoint && !steps.some((step) => step.includes(refreshEndpoint))) {
    steps.push(`刷新 ${refreshEndpoint}，直到 freshness 重新变为 fresh。`);
  }
  return steps;
}

function unavailableReason(source = {}) {
  const error = source.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  const apiError = isObject(source._api?.error) ? source._api.error : {};
  if (typeof apiError.bodyError === 'string' && apiError.bodyError.trim()) return apiError.bodyError;
  if (typeof apiError.bodyMessage === 'string' && apiError.bodyMessage.trim()) return apiError.bodyMessage;
  if (typeof apiError.message === 'string' && apiError.message.trim()) return apiError.message;
  if (source.detail?.reason) return source.detail.reason;
  return '';
}

function unavailableStatus(source = {}) {
  const rawStatus = statusOf(source.status);
  if (rawStatus === 'UNCONFIGURED') return 'MT5_READONLY_BRIDGE_UNCONFIGURED';
  if (rawStatus === 'MISSING_EA_SNAPSHOT') return 'MISSING_EA_SNAPSHOT';
  return 'MT5_READONLY_BRIDGE_UNAVAILABLE';
}

function unavailableStatusZh(source = {}, scopeLabel = 'MT5') {
  const rawStatus = statusOf(source.status);
  if (rawStatus === 'UNCONFIGURED') return `${scopeLabel} 只读桥未配置`;
  if (rawStatus === 'MISSING_EA_SNAPSHOT') return `${scopeLabel} dashboard 快照缺失`;
  return `${scopeLabel} 只读桥不可用`;
}

function unavailableNextActionZh(source = {}, scopeLabel = 'MT5') {
  const reason = unavailableReason(source);
  if (statusOf(source.status) === 'UNCONFIGURED' || reason === 'secondary_mt5_runtime_not_found') {
    return `配置 ${scopeLabel} 的 MT5 MQL5/Files runtime 后，再刷新只读桥；配置完成前不要把账号、持仓或执行权限当成当前实盘。`;
  }
  return `恢复 ${scopeLabel} 终端和 EA dashboard writer，让 QuantGod_Dashboard.json 重新写入；恢复前不要把账号、持仓或执行权限当成当前实盘。`;
}

function normalizeUnavailableFreshness(source = {}, options = {}) {
  const scopeLabel = options.scopeLabel || 'MT5';
  const refreshEndpoint = options.refreshEndpoint || '';
  const missing = statusOf(source.status) === 'MISSING_EA_SNAPSHOT';
  const blockers = [
    missing ? 'missing_ea_dashboard_snapshot' : 'mt5_readonly_bridge_unavailable',
    statusOf(source.status) === 'UNCONFIGURED' ? 'mt5_readonly_bridge_unconfigured' : '',
    terminalMissing(source) ? 'mt5_terminal_process_missing' : '',
    unavailableReason(source),
  ].filter(Boolean);
  return {
    mode: 'MT5_READONLY_EA_SNAPSHOT_MTIME_WATCH',
    status: unavailableStatus(source),
    statusLabel: missing ? 'EA snapshot missing' : 'MT5 readonly bridge unavailable',
    statusZh: unavailableStatusZh(source, scopeLabel),
    fresh: false,
    stale: true,
    unavailable: !missing,
    missing,
    terminalProcessMissing: terminalMissing(source),
    ageSeconds: sourceAgeOf(source, {}),
    maxAgeSeconds: sourceMaxAgeOf(source, {}) ?? DEFAULT_MAX_AGE_SECONDS,
    sourceFile: sourceFileOf(source, {}),
    mtimeIso: sourceMtimeOf(source, {}),
    blockers,
    nextAction: 'Restore the MT5 readonly bridge / EA dashboard writer before using live account state.',
    nextActionZh: unavailableNextActionZh(source, scopeLabel),
    recoveryStepsZh: recoveryStepsZh(refreshEndpoint),
    orderSendAllowed: false,
    mt5OrderSendAllowed: false,
    brokerCallsMade: false,
    mutatesMt5: false,
  };
}

function normalizeFreshnessEnvelope(source = {}, freshness = {}, options = {}) {
  const status = statusOf(freshness.status);
  const terminalProcessMissing = freshnessTerminalMissing(source, freshness);
  const missing = status === 'MISSING_EA_SNAPSHOT';
  const unavailable =
    status === 'MT5_READONLY_BRIDGE_UNAVAILABLE' ||
    status === 'MT5_READONLY_BRIDGE_UNCONFIGURED' ||
    status === 'UNAVAILABLE' ||
    status === 'UNCONFIGURED';
  const stale =
    terminalProcessMissing ||
    freshness.stale === true ||
    status === 'STALE_EA_SNAPSHOT' ||
    missing ||
    unavailable;
  const fresh = freshness.fresh === true && !stale;
  const scopeLabel = options.scopeLabel || 'MT5';
  const statusZh = terminalProcessMissing
    ? `${scopeLabel} MT5/EA writer 未运行`
    : freshness.statusZh ||
      (missing
        ? `${scopeLabel} dashboard 快照缺失`
        : unavailable
          ? unavailableStatusZh({ status }, scopeLabel)
          : stale
            ? `${scopeLabel} dashboard 快照已过期`
            : fresh
              ? `${scopeLabel} dashboard 新鲜`
              : '');
  const nextActionZh = terminalProcessMissing
    ? `恢复 ${scopeLabel} 终端和 EA dashboard writer，让 QuantGod_Dashboard.json 重新写入；恢复前不要把账号、持仓或执行权限当成当前实盘。`
    : freshness.nextActionZh ||
      (missing
        ? `未找到 ${scopeLabel} QuantGod_Dashboard.json；先恢复对应 MT5 终端和 EA dashboard writer。`
        : unavailable
          ? unavailableNextActionZh({ status }, scopeLabel)
          : stale
            ? `恢复 ${scopeLabel} 终端和 EA dashboard writer，让 QuantGod_Dashboard.json 重新写入；不要把旧快照当成当前实盘状态。`
            : '');
  return {
    ...freshness,
    missing,
    unavailable,
    terminalProcessMissing,
    fresh,
    stale,
    sourceFile: sourceFileOf(source, freshness),
    mtimeIso: sourceMtimeOf(source, freshness),
    status:
      unavailable && status === 'UNAVAILABLE'
        ? 'MT5_READONLY_BRIDGE_UNAVAILABLE'
        : unavailable && status === 'UNCONFIGURED'
          ? 'MT5_READONLY_BRIDGE_UNCONFIGURED'
          : freshness.status,
    statusZh,
    nextActionZh,
    recoveryStepsZh: normalizeRecoverySteps(freshness, options.refreshEndpoint),
  };
}

export function normalizeMt5ReadonlyFreshness(payload = {}, options = {}) {
  const source = unwrapPayload(payload) || {};
  if (!isObject(source)) return {};
  const embeddedFreshness = isObject(source._freshness) ? source._freshness : {};
  if (optionalLaneDisabled(source, embeddedFreshness)) {
    return normalizeDisabledFreshness(embeddedFreshness);
  }
  if (isObject(source._freshness) && present(source._freshness)) {
    return normalizeFreshnessEnvelope(source, source._freshness, options);
  }

  const rawStatus = statusOf(source.status);
  if (
    apiFailed(source) ||
    rawStatus === 'UNAVAILABLE' ||
    rawStatus === 'UNCONFIGURED' ||
    rawStatus === 'MISSING_EA_SNAPSHOT'
  ) {
    return normalizeUnavailableFreshness(source, options);
  }

  const sourceMeta = isObject(source.source) ? source.source : {};
  const hasFreshnessEvidence =
    source.snapshotFresh !== undefined ||
    sourceMeta.fresh !== undefined ||
    sourceMeta.ageSeconds !== undefined ||
    rawStatus === 'STALE_EA_SNAPSHOT';
  if (!hasFreshnessEvidence) return {};

  const fresh = source.snapshotFresh === true || sourceMeta.fresh === true;
  const stale =
    source.snapshotFresh === false || sourceMeta.fresh === false || rawStatus === 'STALE_EA_SNAPSHOT';
  return normalizeFreshnessEnvelope(
    source,
    {
      mode: 'MT5_READONLY_EA_SNAPSHOT_MTIME_WATCH',
      status: stale ? 'STALE_EA_SNAPSHOT' : fresh ? 'FRESH_EA_SNAPSHOT' : 'WAITING_EA_SNAPSHOT_FRESHNESS',
      fresh,
      stale,
      ageSeconds: sourceMeta.ageSeconds,
      maxAgeSeconds: sourceMeta.maxAgeSeconds,
      sourceFile: sourceMeta.file || '',
      mtimeIso: sourceMeta.mtimeIso || '',
      blockers: stale ? ['live_dashboard_snapshot_stale'] : [],
    },
    options,
  );
}
