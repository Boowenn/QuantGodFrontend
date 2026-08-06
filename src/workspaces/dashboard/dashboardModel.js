import { humanizeStatus } from '../../utils/displayText.js';
import { normalizeMt5ReadonlyFreshness } from '../../utils/mt5ReadonlyFreshness.js';
import {
  normalizeTelegramDelivery,
  normalizeTelegramSafety,
  telegramMetric,
  unwrapTelegramPayload,
} from '../../utils/telegramStatus.js';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function unwrap(value) {
  if (!isObject(value)) return value || {};
  if (isObject(value.data)) return value.data;
  if (isObject(value.result)) return value.result;
  return value;
}

function rows(value) {
  const source = unwrap(value);
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.positions)) return source.positions;
  return [];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function diskMaintenanceHint(disk = {}) {
  const maintenance = isObject(disk.maintenance) ? disk.maintenance : null;
  if (!maintenance) return '';

  const status = String(maintenance.status || maintenance.resultStatus || '').trim();
  const statusLabel =
    {
      SUCCESS: '完成',
      PASS: '通过',
      PRESSURE_REMAINS: '压力未解除',
      PARTIAL: '部分完成',
      ERROR: '失败',
      UNAVAILABLE: '不可用',
    }[status.toUpperCase()] || status;
  const generatedAt = String(maintenance.generatedAtIso || maintenance.generatedAt || '').trim();
  const freshness = String(maintenance.freshness || '')
    .trim()
    .toUpperCase();
  const summary = isObject(maintenance.summary) ? maintenance.summary : {};
  const deletedBytes = numberOrNull(
    summary.deletedBytes ?? maintenance.deletedBytes ?? maintenance.freedBytes,
  );
  const remainingBytes = numberOrNull(maintenance.pressureRemainingBytes ?? maintenance.remainingBytes);
  const parts = [];

  if (generatedAt) parts.push(`最近维护 ${generatedAt}`);
  if (statusLabel) parts.push(`结果 ${statusLabel}`);
  if (deletedBytes !== null) {
    parts.push(`释放 ${(Math.max(0, deletedBytes) / (1024 * 1024)).toFixed(1)} MiB`);
  }
  const maintenanceIsStale = freshness === 'STALE';
  if (maintenanceIsStale) {
    parts.push('维护状态已过期');
  }
  if (maintenance.pressureActive === true) {
    parts.push(maintenanceIsStale ? '上次维护时磁盘压力仍在' : '磁盘压力仍在');
  } else if (maintenance.pressureActive === false) {
    parts.push(maintenanceIsStale ? '上次维护时磁盘压力已解除' : '磁盘压力已解除');
  }
  if (maintenance.pressureActive === true && remainingBytes !== null) {
    parts.push(
      `${maintenanceIsStale ? '上次维护时距离目标还差' : '距离目标还差'} ${(
        Math.max(0, remainingBytes) /
        (1024 * 1024)
      ).toFixed(1)} MiB`,
    );
  }

  return parts.join(' · ');
}

const DASHBOARD_STATUS_FIELDS = [
  ['overallStatus', 'overallStatusZh'],
  ['readinessStatus', 'readinessStatusZh'],
  ['report.status', 'report.statusZh'],
  ['state', 'stateZh'],
  ['status', 'statusZh'],
  ['tradeStatus', 'tradeStatusZh'],
  ['promotionGateStatus', 'promotionGateStatusZh'],
  ['runtime.status', 'runtime.statusZh'],
  ['runtime.tradeStatus', 'runtime.tradeStatusZh'],
  ['systemStatus', 'systemStatusZh'],
];

function valueAtPath(source, path) {
  return String(path)
    .split('.')
    .reduce((cursor, key) => (cursor == null ? undefined : cursor[key]), source);
}

function dashboardStatusCandidate(value = {}) {
  const envelopes = [value, value.data, value.result, value.payload].filter(isObject);
  for (const [statusPath, labelPath] of DASHBOARD_STATUS_FIELDS) {
    for (const envelope of envelopes) {
      const status = valueAtPath(envelope, statusPath);
      if (status === undefined || status === null || status === '') continue;
      return {
        code: String(status),
        label: valueAtPath(envelope, labelPath) || humanizeStatus(status),
      };
    }
  }
  return { code: '', label: '' };
}

function dashboardStatusTone(status) {
  const text = String(status || '').toUpperCase();
  if (!text) return '';
  if (text === 'SHADOW_ADVISORY_READY' || text === 'READY_FOR_EXISTING_EA') return 'warn';
  if (
    /(?:^|_)(?:BLOCKED|ERROR|FAIL(?:ED)?|STALE|MISSING|UNAVAILABLE|UNKNOWN|NOT_READY|NOT_RUN)(?:_|$)/.test(
      text,
    )
  ) {
    return 'blocked';
  }
  if (/(?:^|_)(?:WARN(?:ING)?|WAIT(?:ING)?|PAUSED|SHADOW|READ_ONLY|SKIPPED)(?:_|$)/.test(text)) {
    return 'warn';
  }
  if (/(?:^|_)(?:PASS(?:ED)?|READY|OK|CONNECTED|AUTHORIZED|ACTIVE|RUNNING)(?:_|$)/.test(text)) {
    return 'ok';
  }
  return '';
}

function dashboardStatusLabel(code, label) {
  const text = String(code || '').toUpperCase();
  if (text === 'SHADOW_ADVISORY_READY') return '影子建议已就绪';
  if (text === 'READY_FOR_EXISTING_EA') return '影子建议已就绪（旧契约）';
  return label;
}

function transportSucceeded(value) {
  return isObject(value) && value.endpointLoadFailed !== true && value._api?.ok === true;
}

export function resolveDashboardEvidenceState(value) {
  if (!isObject(value) || !transportSucceeded(value)) {
    return {
      transportOk: false,
      domainOk: false,
      code: '',
      label: value?._api?.error?.message || value?.error?.message || value?.error || '接口不可用',
      status: 'blocked',
    };
  }

  const candidate = dashboardStatusCandidate(value);
  const candidateTone = dashboardStatusTone(candidate.code);
  const status =
    value.ok === false
      ? 'blocked'
      : candidateTone || (value.ok === true || value.ok === undefined ? 'ok' : 'blocked');
  return {
    transportOk: true,
    domainOk: status === 'ok' && value.ok !== false,
    code: candidate.code,
    label: dashboardStatusLabel(
      candidate.code,
      candidate.label ||
        value.statusZh ||
        (value.ok === false ? value.error?.message || value.error || '业务状态已阻断' : '正常'),
    ),
    status,
  };
}

export function resolveOperatorOverviewState(value) {
  const evidence = resolveDashboardEvidenceState(value);
  if (!evidence.transportOk) {
    return { ...evidence, valid: false, payload: {} };
  }
  const payload = isObject(value?.payload) ? value.payload : {};
  const requiredSections = [
    payload.service,
    payload.canonicalDataRoot,
    payload.mt5,
    payload.data,
    payload.automation,
    payload.evidence,
    payload.disk,
    payload.safety,
  ];
  const requiredBooleans = [
    payload.service?.processAlive,
    payload.service?.serviceReady,
    payload.canonicalDataRoot?.exists,
    payload.mt5?.writerFresh,
    payload.mt5?.brokerConnected,
    payload.mt5?.brokerConnectionKnown,
    payload.mt5?.accountAuthorized,
    payload.mt5?.accountAuthorizationKnown,
    payload.mt5?.quoteFresh,
    payload.mt5?.monitorReady,
    payload.mt5?.tradingReady,
    payload.data?.ready,
    payload.automation?.ready,
    payload.evidence?.ready,
    payload.operationalReady,
    payload.safety?.advisoryOnly,
    payload.safety?.executionLaneExists,
    payload.safety?.orderSendAllowed,
    payload.safety?.closeAllowed,
    payload.safety?.cancelAllowed,
    payload.safety?.liveExpansionAllowed,
    payload.safety?.unattendedLiveExpansionAllowed,
    payload.safety?.operatorApprovalRequired,
    payload.safety?.mutatesMt5,
  ];
  const valid =
    value?.ok === true &&
    payload.schema === 'quantgod.operator_overview.v1' &&
    ['PASS', 'BLOCKED', 'WARN'].includes(String(payload.overallStatus || '').toUpperCase()) &&
    typeof payload.operationalReady === 'boolean' &&
    requiredSections.every(isObject) &&
    requiredBooleans.every((item) => typeof item === 'boolean') &&
    payload.mt5.tradingReady === false &&
    payload.safety.advisoryOnly === true &&
    payload.safety.executionLaneExists === false &&
    payload.safety.orderSendAllowed === false &&
    payload.safety.closeAllowed === false &&
    payload.safety.cancelAllowed === false &&
    payload.safety.liveExpansionAllowed === false &&
    payload.safety.unattendedLiveExpansionAllowed === false &&
    payload.safety.mutatesMt5 === false;
  if (!valid) {
    return {
      transportOk: true,
      domainOk: false,
      valid: false,
      code: 'INVALID_OPERATOR_OVERVIEW',
      label: 'Operator Overview 响应无效',
      status: 'blocked',
      payload: {},
    };
  }
  return { ...evidence, valid: true, payload };
}

const OPERATOR_BLOCKER_LABELS = {
  CANONICAL_RUNTIME_MISSING: '统一数据根目录缺失',
  MT5_WRITER_MISSING: 'MT5 writer 证据缺失',
  MT5_WRITER_STALE: 'MT5 writer 证据过期',
  BROKER_NOT_CONFIRMED: '券商连接未确认',
  ACCOUNT_NOT_AUTHORIZED: 'MT5 账号未授权',
  QUOTE_STALE: '市场开放时报价过期',
  DISK_CRITICAL: '运行磁盘空间严重不足',
};

function operatorBlockerLabel(reason) {
  const code = String(reason || 'UNKNOWN').toUpperCase();
  if (OPERATOR_BLOCKER_LABELS[code]) return OPERATOR_BLOCKER_LABELS[code];
  if (code.startsWith('HISTORY_')) return `历史数据未就绪（${code.slice('HISTORY_'.length)}）`;
  if (code.startsWith('AUTOMATION_')) return `自动化链未就绪（${code.slice('AUTOMATION_'.length)}）`;
  if (code.startsWith('EVIDENCE_')) return `生产证据未就绪（${code.slice('EVIDENCE_'.length)}）`;
  return humanizeStatus(code, code);
}

function operatorBlockedReasons(overview = {}) {
  return Array.isArray(overview.blockedReasons) ? overview.blockedReasons.filter(Boolean) : [];
}

function operatorResearchGateReason(reason) {
  const code = String(reason || '').toUpperCase();
  return code.startsWith('AUTOMATION_') || code.startsWith('EVIDENCE_');
}

function operatorRuntimeHealthy(overview = {}) {
  const safety = overview.safety || {};
  return (
    overview.service?.processAlive === true &&
    overview.service?.serviceReady === true &&
    overview.canonicalDataRoot?.exists === true &&
    overview.mt5?.writerFresh === true &&
    overview.mt5?.brokerConnectionKnown === true &&
    overview.mt5?.brokerConnected === true &&
    overview.mt5?.accountAuthorizationKnown === true &&
    overview.mt5?.accountAuthorized === true &&
    overview.mt5?.monitorReady === true &&
    overview.mt5?.tradingReady === false &&
    overview.data?.ready === true &&
    ['PASS', 'WARN'].includes(String(overview.disk?.status || '').toUpperCase()) &&
    safety.advisoryOnly === true &&
    safety.executionLaneExists === false &&
    safety.orderSendAllowed === false &&
    safety.closeAllowed === false &&
    safety.cancelAllowed === false &&
    safety.liveExpansionAllowed === false &&
    safety.unattendedLiveExpansionAllowed === false &&
    safety.operatorApprovalRequired === true &&
    safety.mutatesMt5 === false
  );
}

function operatorHasOnlyResearchGateBlockers(overview = {}) {
  const reasons = operatorBlockedReasons(overview);
  return reasons.length > 0 && reasons.every(operatorResearchGateReason) && operatorRuntimeHealthy(overview);
}

function booleanOverviewItem(label, value, options = {}) {
  const known = options.known ?? typeof value === 'boolean';
  const expected = options.expected ?? true;
  const matches = known && value === expected;
  return {
    label,
    value: !known
      ? options.unknownLabel || '未知 / 已阻断'
      : matches
        ? options.passLabel || '是'
        : options.failLabel || '否',
    status: matches ? options.passStatus || 'ok' : options.failStatus || 'blocked',
    hint: options.hint || '',
  };
}

function apiSucceeded(value) {
  return resolveDashboardEvidenceState(value).domainOk;
}

function freshnessBlocked(freshness = {}) {
  return freshness.fresh !== true || freshness.stale === true || freshness.missing === true;
}

function readonlyConnectionState(value = {}) {
  const payload = unwrap(value);
  const runtimeConnection = isObject(payload.runtime?.connectionState) ? payload.runtime.connectionState : {};
  const connection = isObject(payload.connection)
    ? { ...runtimeConnection, ...payload.connection }
    : runtimeConnection;
  const known =
    connection.semantics === 'EXPLICIT_CONNECTION_EVIDENCE_V2' ||
    ['readReady', 'brokerSessionConnected', 'accountAuthorized', 'writerFresh', 'processRunning'].some(
      (key) => typeof connection[key] === 'boolean',
    );
  const contradictory =
    connection.readReady === false ||
    connection.brokerSessionConnected === false ||
    connection.accountAuthorized === false ||
    connection.writerFresh === false ||
    connection.processRunning === false;
  const readReady = Boolean(
    known &&
    !contradictory &&
    connection.brokerSessionConnected === true &&
    connection.accountAuthorized === true &&
    connection.writerFresh === true &&
    connection.processRunning === true &&
    connection.readReady !== false,
  );
  let label;
  if (!known) label = '连接证据未知';
  else if (known && connection.processRunning === false) label = '终端进程未就绪';
  else if (known && connection.brokerSessionConnected === false) label = 'Broker 未连接';
  else if (known && connection.accountAuthorized === false) label = '账号未授权';
  else if (known && connection.writerFresh === false) label = 'Writer 不新鲜';
  else if (readReady) label = '只读连接正常';
  else label = '连接证据不完整';
  return {
    known,
    readReady,
    blocked: !readReady,
    label,
  };
}

function freshnessStatus(freshness = {}) {
  if (freshness.fresh === true && freshness.stale !== true) return '新鲜';
  if (freshness.missing) return '缺失';
  if (freshness.unavailable) return '不可用';
  if (freshness.stale) return '过期';
  return '未知 / 已阻断';
}

function freshnessEvidence(freshness = {}) {
  const age = numberOrNull(freshness.ageSeconds);
  const maxAge = numberOrNull(freshness.maxAgeSeconds);
  if (age === null) return freshness.sourceFile || '未返回证据年龄';
  return `${age.toFixed(1)} 秒${maxAge === null ? '' : ` / 阈值 ${maxAge.toFixed(0)} 秒`}`;
}

function recoveryLine(freshness = {}, fallback = '') {
  return (
    freshness.nextActionZh ||
    freshness.recoveryStepsZh?.filter(Boolean)?.join('；') ||
    fallback ||
    '恢复 MT5 只读桥与 EA dashboard writer，再刷新页面。'
  );
}

function connectionRecoveryLine(connection = {}, scopeLabel = '账号', endpoint = '') {
  if (connection.label === '终端进程未就绪') {
    return `恢复${scopeLabel} terminal64/wine 与 EA dashboard writer，再刷新 ${endpoint}。`;
  }
  if (connection.label === 'Writer 不新鲜') {
    return `恢复${scopeLabel} EA dashboard writer 持续刷新，再核对 readReady。`;
  }
  if (connection.label === 'Broker 未连接' || connection.label === '账号未授权') {
    return `恢复${scopeLabel} Broker 登录与账号授权，确认 readReady=true 后刷新 ${endpoint}。`;
  }
  return `补齐${scopeLabel} Broker、授权、writer、进程和 readReady 显式证据，再刷新 ${endpoint}。`;
}

function positionRows(snapshot = {}) {
  return rows(snapshot.positions || snapshot.openPositions || snapshot.account?.positions);
}

function overviewWriterFreshness(overviewState = {}) {
  if (!overviewState.valid) {
    return {
      status: 'OPERATOR_OVERVIEW_UNAVAILABLE',
      statusZh: 'Operator Overview 不可用',
      fresh: false,
      stale: true,
      missing: true,
      ageSeconds: null,
      maxAgeSeconds: null,
      nextActionZh: '恢复 /api/operator/overview；聚合状态恢复前，首页核心状态保持阻断。',
      recoveryStepsZh: [],
    };
  }
  const mt5 = overviewState.payload.mt5 || {};
  const fresh = mt5.writerFresh === true;
  return {
    status: fresh ? 'FRESH_EA_SNAPSHOT' : 'STALE_EA_SNAPSHOT',
    statusZh: fresh ? 'MT5 writer 新鲜' : 'MT5 writer 过期 / 缺失',
    fresh,
    stale: !fresh,
    missing: mt5.writerFresh !== true && mt5.writerAgeSeconds == null,
    ageSeconds: mt5.writerAgeSeconds,
    maxAgeSeconds: null,
    mtimeIso: mt5.writerObservedAt || '',
    blockers: fresh ? [] : ['operator_overview_writer_not_fresh'],
    nextActionZh: fresh
      ? '继续读取 Operator Overview。'
      : '恢复 MT5/EA dashboard writer，再刷新 /api/operator/overview。',
    recoveryStepsZh: [],
  };
}

export function normalizeDashboardSnapshot(raw = {}) {
  const operatorOverviewRequested = Object.prototype.hasOwnProperty.call(raw, 'operatorOverview');
  const operatorOverviewState = resolveOperatorOverviewState(raw.operatorOverview);
  const operatorOverview = operatorOverviewState.payload;
  const latest = unwrap(raw.latest);
  const state = unwrap(raw.state);
  const mt5Snapshot = unwrap(raw.mt5Snapshot);
  const secondaryMt5Snapshot = unwrap(raw.secondaryMt5Snapshot);
  const primaryDiagnosticFreshness = normalizeMt5ReadonlyFreshness(raw.mt5Snapshot || {}, {
    scopeLabel: '主账号',
    refreshEndpoint: '/api/mt5-readonly/snapshot',
  });
  const secondaryDiagnosticFreshness = normalizeMt5ReadonlyFreshness(raw.secondaryMt5Snapshot || {}, {
    scopeLabel: '外汇部署账号',
    refreshEndpoint: '/api/mt5-readonly-secondary/snapshot',
  });
  const primaryFreshness = operatorOverviewRequested
    ? overviewWriterFreshness(operatorOverviewState)
    : primaryDiagnosticFreshness;
  const secondaryFreshness = secondaryDiagnosticFreshness;
  const hasSecondaryEvidence = isObject(raw.secondaryMt5Snapshot);
  const secondaryEnabled = !(
    !hasSecondaryEvidence ||
    (String(secondaryMt5Snapshot.status || secondaryFreshness.status || '').toUpperCase() === 'DISABLED' &&
      secondaryFreshness.optional === true &&
      secondaryFreshness.enabled === false)
  );
  const primaryConnection = readonlyConnectionState(mt5Snapshot);
  const secondaryConnection = readonlyConnectionState(secondaryMt5Snapshot);
  const primaryApiSucceeded = apiSucceeded(raw.mt5Snapshot);
  const primaryFreshnessBlocked = freshnessBlocked(primaryDiagnosticFreshness);
  const primaryExplicitConnectionBlocked =
    primaryApiSucceeded &&
    !primaryFreshnessBlocked &&
    primaryConnection.known &&
    primaryConnection.readReady !== true;
  const primaryDiagnosticBlocked =
    !primaryApiSucceeded || primaryFreshnessBlocked || primaryConnection.blocked;
  const primaryBlocked = operatorOverviewRequested
    ? !operatorOverviewState.valid ||
      operatorOverview.mt5?.monitorReady !== true ||
      primaryExplicitConnectionBlocked
    : primaryDiagnosticBlocked;
  const secondaryApiBlocked = secondaryEnabled && !transportSucceeded(raw.secondaryMt5Snapshot);
  const secondaryFreshnessBlocked = secondaryEnabled && freshnessBlocked(secondaryFreshness);
  const secondaryDomainBlocked = secondaryEnabled && !apiSucceeded(raw.secondaryMt5Snapshot);
  const secondaryConnectionBlocked = secondaryEnabled && secondaryConnection.blocked;
  const secondaryBlocked =
    secondaryApiBlocked || secondaryFreshnessBlocked || secondaryDomainBlocked || secondaryConnectionBlocked;
  const secondaryBlockReason = secondaryApiBlocked
    ? '只读接口不可用'
    : secondaryFreshnessBlocked
      ? `快照${freshnessStatus(secondaryFreshness)}`
      : secondaryDomainBlocked
        ? '只读状态不可用'
        : secondaryConnectionBlocked
          ? secondaryConnection.label
          : '';
  const secondaryNextAction = secondaryApiBlocked
    ? '恢复 /api/mt5-readonly-secondary/snapshot 只读接口后重新核对第二账号。'
    : secondaryFreshnessBlocked
      ? recoveryLine(secondaryFreshness, '恢复第二账号 EA dashboard writer，再刷新只读快照。')
      : secondaryDomainBlocked
        ? '恢复第二账号只读状态端点的业务证据，再刷新页面。'
        : secondaryConnectionBlocked
          ? connectionRecoveryLine(secondaryConnection, '第二账号', '/api/mt5-readonly-secondary/snapshot')
          : '';
  const partiallyAvailable = !primaryBlocked && secondaryBlocked;
  const blocked = primaryBlocked;
  const runtime =
    latest.runtime ||
    state.runtime ||
    (operatorOverviewState.valid
      ? {
          mode: operatorOverview.mode,
          terminalConnected: operatorOverview.mt5?.brokerConnected,
          accountAuthorized: operatorOverview.mt5?.accountAuthorized,
          tickAgeSeconds: operatorOverview.mt5?.quoteAgeSeconds,
          tradeStatus: operatorOverview.mode,
          shadowMode: true,
          readOnlyMode: true,
          executionEnabled: false,
          livePilotMode: false,
        }
      : {});
  const killSwitch =
    runtime.pilotKillSwitch ?? latest.pilotKillSwitch ?? state.pilotKillSwitch ?? latest.killSwitch;
  const routeItems = latest.routes || latest.routeStatus || state.routes || raw.dailyReview?.routes || [];

  return {
    raw,
    operatorOverviewRequested,
    operatorOverviewState,
    operatorOverview,
    operatorOverviewBlocked: operatorOverviewRequested && operatorOverviewState.status === 'blocked',
    overallStatus: operatorOverview.overallStatus || operatorOverviewState.code || '',
    overallStatusLabel: operatorOverviewState.label,
    overallStatusTone: operatorOverviewRequested
      ? primaryExplicitConnectionBlocked
        ? 'blocked'
        : operatorOverviewState.status === 'ok' && partiallyAvailable
          ? 'warn'
          : operatorOverviewState.status
      : blocked
        ? 'blocked'
        : partiallyAvailable
          ? 'warn'
          : 'ok',
    latest,
    state,
    backtest: unwrap(raw.backtest),
    dailyReview: unwrap(raw.dailyReview),
    dailyAutopilotV2: unwrap(raw.dailyAutopilotV2),
    usdJpyLiveLoop: unwrap(raw.usdJpyLiveLoop),
    mt5Snapshot,
    secondaryMt5Snapshot,
    primaryFreshness,
    secondaryFreshness,
    primaryDiagnosticFreshness,
    secondaryDiagnosticFreshness,
    primaryDiagnosticBlocked,
    primaryExplicitConnectionBlocked,
    primaryConnection,
    secondaryEnabled,
    primaryBlocked,
    secondaryBlocked,
    secondaryApiBlocked,
    secondaryFreshnessBlocked,
    secondaryDomainBlocked,
    secondaryConnectionBlocked,
    secondaryBlockReason,
    secondaryNextAction,
    secondaryConnection,
    partiallyAvailable,
    runtime,
    positions: [
      ...positionRows(mt5Snapshot),
      ...(secondaryEnabled ? positionRows(secondaryMt5Snapshot) : []),
    ],
    routeItems: Array.isArray(routeItems) ? routeItems : rows(routeItems),
    killSwitchStatus: killSwitch === false ? 'ok' : killSwitch === true ? 'blocked' : 'warn',
    killSwitchLabel:
      killSwitch === false ? '熔断未触发' : killSwitch === true ? '熔断已触发' : '熔断状态未知',
    snapshotRecovery: {
      status: blocked ? 'blocked' : partiallyAvailable ? 'warn' : 'ok',
      label: blocked
        ? '当前账号状态不可直接信任'
        : partiallyAvailable
          ? '主账号可用 · 第二账号待恢复'
          : 'USDJPY MT5 快照可信',
    },
  };
}

export function buildOperatorOverviewItems(snapshot = {}) {
  const state = snapshot.operatorOverviewState || {};
  if (!snapshot.operatorOverviewRequested || !state.valid) {
    return [
      {
        label: '统一运营状态',
        value: state.label || 'Operator Overview 不可用',
        status: 'blocked',
        hint: '/api/operator/overview 未返回可验证的 v1 聚合证据；旧端点不能替代总体结论。',
      },
    ];
  }

  const overview = snapshot.operatorOverview || {};
  const mt5 = overview.mt5 || {};
  const marketClosed = String(mt5.marketSession?.state || '').toUpperCase() === 'CLOSED';
  const root = overview.canonicalDataRoot || {};
  const diskFreeRatio = numberOrNull(overview.disk?.freeRatio);
  const maintenanceHint = diskMaintenanceHint(overview.disk);
  return [
    {
      label: '统一运营状态',
      value: overview.overallStatus,
      status: snapshot.overallStatusTone,
      hint: `${overview.mode || 'SHADOW_READONLY'} · ${overview.generatedAt || '未返回生成时间'}`,
    },
    booleanOverviewItem('本地服务', overview.service?.serviceReady, {
      passLabel: '运行就绪',
      failLabel: '服务未就绪',
      hint:
        overview.service?.processAlive === true
          ? `进程在线 · ${overview.service?.build || 'local'}`
          : '本地服务进程状态未确认。',
    }),
    {
      label: '统一数据根',
      value: root.exists === true ? root.id || '已确认' : '缺失 / 已阻断',
      status: root.exists === true ? 'ok' : 'blocked',
      hint: '只显示数据根身份，不在主视图暴露本地绝对路径。',
    },
    booleanOverviewItem('MT5 writer', mt5.writerFresh, {
      passLabel: 'fresh=true',
      failLabel: '过期 / 缺失',
      hint:
        mt5.writerAgeSeconds == null
          ? '未返回 writer 证据年龄'
          : `证据年龄 ${Number(mt5.writerAgeSeconds).toFixed(1)} 秒`,
    }),
    booleanOverviewItem('券商连接', mt5.brokerConnected, {
      known: mt5.brokerConnectionKnown === true,
      passLabel: '已连接',
      failLabel: '未连接',
      unknownLabel: '连接状态未知',
    }),
    booleanOverviewItem('账号授权', mt5.accountAuthorized, {
      known: mt5.accountAuthorizationKnown === true,
      passLabel: '已授权',
      failLabel: '未授权',
      unknownLabel: '授权状态未知',
    }),
    marketClosed
      ? {
          label: '报价新鲜度',
          value: 'MARKET_CLOSED',
          status: 'warn',
          hint: `休市中不要求实时 tick（${mt5.marketSession?.reasonCode || 'SESSION_CLOSED'}）。`,
        }
      : booleanOverviewItem('报价新鲜度', mt5.quoteFresh, {
          passLabel: '报价新鲜',
          failLabel: '报价过期',
          hint:
            mt5.quoteAgeSeconds == null
              ? '未返回报价年龄'
              : `报价年龄 ${Number(mt5.quoteAgeSeconds).toFixed(1)} 秒`,
        }),
    booleanOverviewItem('MT5 监控就绪', mt5.monitorReady, {
      passLabel: '只读监控就绪',
      failLabel: '只读监控未就绪',
    }),
    booleanOverviewItem('执行通道锁', mt5.tradingReady, {
      expected: false,
      passLabel: '已锁定 · Shadow / ReadOnly',
      failLabel: '异常：检测到执行能力',
      passStatus: 'warn',
      hint: '当前系统没有发单执行通道；false 是安全边界，不是故障。',
    }),
    booleanOverviewItem('历史数据', overview.data?.ready, {
      passLabel: '就绪',
      failLabel: `${overview.data?.history?.status || 'UNKNOWN'} / ${overview.data?.history?.freshness || 'UNKNOWN'}`,
    }),
    booleanOverviewItem('自动化证据', overview.automation?.ready, {
      passLabel: '就绪',
      failLabel: `${overview.automation?.status || 'UNKNOWN'} / ${overview.automation?.freshness || 'UNKNOWN'}`,
    }),
    booleanOverviewItem('生产证据', overview.evidence?.ready, {
      passLabel: '就绪',
      failLabel: `${overview.evidence?.production?.status || 'UNKNOWN'} / ${overview.evidence?.production?.freshness || 'UNKNOWN'}`,
    }),
    {
      label: '运行磁盘',
      value:
        diskFreeRatio === null
          ? overview.disk?.status || 'UNKNOWN'
          : `${overview.disk?.status || 'UNKNOWN'} · ${(diskFreeRatio * 100).toFixed(1)}% 空闲`,
      status: overview.disk?.status === 'PASS' ? 'ok' : overview.disk?.status === 'WARN' ? 'warn' : 'blocked',
      ...(maintenanceHint ? { hint: maintenanceHint } : {}),
    },
    {
      label: '安全边界',
      value:
        overview.safety?.advisoryOnly === true &&
        overview.safety?.executionLaneExists === false &&
        overview.safety?.mutatesMt5 === false &&
        overview.safety?.orderSendAllowed === false &&
        overview.safety?.closeAllowed === false &&
        overview.safety?.cancelAllowed === false
          ? 'Shadow / ReadOnly 已锁定'
          : '安全边界异常',
      status:
        overview.safety?.advisoryOnly === true &&
        overview.safety?.executionLaneExists === false &&
        overview.safety?.mutatesMt5 === false &&
        overview.safety?.orderSendAllowed === false &&
        overview.safety?.closeAllowed === false &&
        overview.safety?.cancelAllowed === false
          ? 'ok'
          : 'blocked',
      hint: '不允许发单、平仓、撤单或无人值守扩展。',
    },
  ];
}

const OPERATOR_OVERVIEW_AXIS_LABELS = new Set([
  'MT5 writer',
  '券商连接',
  '账号授权',
  '报价新鲜度',
  'MT5 监控就绪',
  '执行通道锁',
]);

export function buildOperatorOverviewAxisItems(snapshot = {}) {
  const items = buildOperatorOverviewItems(snapshot);
  if (!snapshot.operatorOverviewState?.valid) return items;
  return items.filter((item) => OPERATOR_OVERVIEW_AXIS_LABELS.has(item.label));
}

export function buildOperatorOverviewSupportItems(snapshot = {}) {
  if (!snapshot.operatorOverviewState?.valid) return [];
  return buildOperatorOverviewItems(snapshot).filter(
    (item) => !OPERATOR_OVERVIEW_AXIS_LABELS.has(item.label),
  );
}

export function buildOperatorOverviewBlockerRows(snapshot = {}) {
  const state = snapshot.operatorOverviewState || {};
  if (!snapshot.operatorOverviewRequested || !state.valid) {
    return [
      {
        优先级: 'P0',
        阻断代码: state.code || 'OPERATOR_OVERVIEW_UNAVAILABLE',
        说明: state.label || '统一运营状态接口不可用',
        证据端点: '/api/operator/overview',
        下一步: '恢复或重启本地后端，使 v1 聚合端点返回完整 JSON；恢复前保持阻断。',
      },
    ];
  }
  const reasons = operatorBlockedReasons(snapshot.operatorOverview);
  if (snapshot.primaryExplicitConnectionBlocked) {
    return [
      {
        优先级: 'P0',
        阻断代码: 'PRIMARY_CONNECTION_EVIDENCE_CONFLICT',
        说明: `新鲜主账号明细显示${snapshot.primaryConnection?.label || '连接证据冲突'}`,
        证据端点: '/api/mt5-readonly/snapshot',
        下一步: '核对主账号 Broker、授权、writer、进程与 readReady 显式证据，再刷新统一总览。',
      },
    ];
  }
  if (!reasons.length && snapshot.overallStatusTone === 'ok') return [];
  return (reasons.length ? reasons : ['OPERATOR_OVERVIEW_WARN']).map((reason) => ({
    优先级: operatorResearchGateReason(reason)
      ? 'P1'
      : snapshot.overallStatusTone === 'blocked'
        ? 'P0'
        : 'P1',
    阻断代码: reason,
    说明:
      reason === 'OPERATOR_OVERVIEW_WARN'
        ? '统一运营状态返回 WARN，需要人工复核聚合证据。'
        : operatorResearchGateReason(reason)
          ? `研究门禁：${operatorBlockerLabel(reason)}`
          : operatorBlockerLabel(reason),
    证据端点: '/api/operator/overview',
    下一步: operatorResearchGateReason(reason)
      ? '继续保持系统只读运行，并补齐自动化或生产证据后重新评估研究门禁。'
      : '按阻断代码恢复对应本地证据，再刷新统一运营总览。',
  }));
}

export function buildDashboardMetrics(snapshot = {}) {
  const primaryAccount = snapshot.mt5Snapshot?.account || {};
  const secondaryAccount = snapshot.secondaryMt5Snapshot?.account || {};
  const equity = numberOrNull(primaryAccount.equity ?? snapshot.mt5Snapshot?.equity);
  const secondaryEquity = numberOrNull(secondaryAccount.equity ?? snapshot.secondaryMt5Snapshot?.equity);
  const primaryDetailsPresent = isObject(snapshot.raw?.mt5Snapshot);
  const primaryDetailsTrusted = primaryDetailsPresent && snapshot.primaryDiagnosticBlocked !== true;
  const secondaryDetailsTrusted =
    !snapshot.secondaryEnabled ||
    (isObject(snapshot.raw?.secondaryMt5Snapshot) && snapshot.secondaryBlocked !== true);
  const positionsTrusted =
    snapshot.snapshotRecovery?.status === 'ok' && primaryDetailsTrusted && secondaryDetailsTrusted;
  const liveLoopEvidence = resolveDashboardEvidenceState(snapshot.raw?.usdJpyLiveLoop);
  const liveLoopPresent = isObject(snapshot.raw?.usdJpyLiveLoop);
  return [
    {
      label: 'USDJPY 当前持仓',
      value: positionsTrusted
        ? snapshot.positions?.length || 0
        : !primaryDetailsPresent && snapshot.snapshotRecovery?.status === 'ok'
          ? '诊断明细加载中'
          : '不可确认',
      status: positionsTrusted
        ? 'ok'
        : !primaryDetailsPresent && snapshot.snapshotRecovery?.status === 'ok'
          ? 'warn'
          : 'blocked',
      hint: '持仓数量只来自新鲜的只读账号明细；统一总览本身不虚构 0 持仓。',
    },
    {
      label: '主账号净值',
      value:
        primaryDetailsTrusted && equity !== null
          ? equity
          : !primaryDetailsPresent && snapshot.primaryBlocked !== true
            ? '诊断明细加载中'
            : '不可确认',
      status:
        primaryDetailsTrusted && equity !== null
          ? 'ok'
          : !primaryDetailsPresent && snapshot.primaryBlocked !== true
            ? 'warn'
            : 'blocked',
      hint: primaryDetailsPresent
        ? freshnessEvidence(snapshot.primaryDiagnosticFreshness)
        : '等待 /api/mt5-readonly/snapshot 诊断明细。',
    },
    ...(snapshot.secondaryEnabled
      ? [
          {
            label: '部署账号净值',
            value: snapshot.secondaryBlocked || secondaryEquity === null ? '不可确认' : secondaryEquity,
            status: snapshot.secondaryBlocked || secondaryEquity === null ? 'blocked' : 'ok',
            hint: freshnessEvidence(snapshot.secondaryDiagnosticFreshness),
          },
        ]
      : []),
    {
      label: 'USDJPY Shadow Advisory',
      value: liveLoopPresent ? liveLoopEvidence.label || '未知 / 已阻断' : '诊断明细加载中',
      status: liveLoopPresent ? liveLoopEvidence.status : 'warn',
      hint: '策略诊断明细不覆盖 Operator Overview 的核心运营结论。',
    },
  ];
}

export function buildEndpointHealth(raw = {}) {
  const snapshot = normalizeDashboardSnapshot(raw);
  return [
    ['统一运营总览', '/api/operator/overview', raw.operatorOverview, null],
    ['最新运行状态', '/api/latest', raw.latest, null],
    ['总览状态', '/api/dashboard/state', raw.state, null],
    ['主账号快照', '/api/mt5-readonly/snapshot', raw.mt5Snapshot, snapshot.primaryDiagnosticFreshness],
    ...(snapshot.secondaryEnabled
      ? [
          [
            '部署账号快照',
            '/api/mt5-readonly-secondary/snapshot',
            raw.secondaryMt5Snapshot,
            snapshot.secondaryDiagnosticFreshness,
          ],
        ]
      : []),
    ['USDJPY Shadow Advisory', '/api/usdjpy-strategy-lab/live-loop', raw.usdJpyLiveLoop, null],
    ['生产证据', '/api/production-evidence-validation/status', raw.productionEvidenceValidation, null],
  ].map(([label, endpoint, payload, freshness]) => {
    const evidence =
      endpoint === '/api/operator/overview'
        ? resolveOperatorOverviewState(payload)
        : resolveDashboardEvidenceState(payload);
    const connection =
      endpoint === '/api/mt5-readonly/snapshot'
        ? snapshot.primaryConnection
        : endpoint === '/api/mt5-readonly-secondary/snapshot'
          ? snapshot.secondaryConnection
          : null;
    const connectionBlocked = connection?.blocked === true;
    const freshnessStateBlocked = Boolean(freshness && freshnessBlocked(freshness));
    const currentStateOk = !freshnessStateBlocked && !connectionBlocked;
    return {
      label,
      endpoint,
      status:
        evidence.status === 'ok' && currentStateOk
          ? 'ok'
          : evidence.status === 'warn' && currentStateOk
            ? 'warn'
            : 'blocked',
      value: !evidence.transportOk
        ? '接口不可用'
        : freshnessStateBlocked
          ? freshnessStatus(freshness)
          : connectionBlocked
            ? `${connection.label} / 已阻断`
            : evidence.status === 'ok'
              ? '正常'
              : evidence.label,
      hint:
        (freshnessStateBlocked
          ? recoveryLine(freshness)
          : connectionBlocked
            ? connectionRecoveryLine(connection, label, endpoint)
            : '') ||
        payload?._api?.error?.message ||
        payload?.error?.message ||
        payload?.error ||
        '',
    };
  });
}

export function buildRuntimeSourceDiagnosticRows(raw = {}) {
  const snapshot = normalizeDashboardSnapshot(raw);
  const hasPrimaryDiagnostic = isObject(raw.mt5Snapshot);
  const primaryFreshness = hasPrimaryDiagnostic
    ? snapshot.primaryDiagnosticFreshness
    : snapshot.primaryFreshness;
  return [
    {
      数据源: hasPrimaryDiagnostic ? 'USDJPY MT5 主账号诊断' : 'USDJPY MT5 writer（统一总览）',
      端点: hasPrimaryDiagnostic ? '/api/mt5-readonly/snapshot' : '/api/operator/overview',
      状态: snapshot.primaryConnection?.blocked
        ? `${snapshot.primaryConnection.label} / 已阻断`
        : freshnessStatus(primaryFreshness),
      证据年龄: freshnessEvidence(primaryFreshness),
      下一步: recoveryLine(primaryFreshness),
    },
    ...(snapshot.secondaryEnabled
      ? [
          {
            数据源: 'USDJPY 外汇部署账号',
            端点: '/api/mt5-readonly-secondary/snapshot',
            状态: snapshot.secondaryConnection?.blocked
              ? `${snapshot.secondaryConnection.label} / 已阻断`
              : freshnessStatus(snapshot.secondaryDiagnosticFreshness),
            证据年龄: freshnessEvidence(snapshot.secondaryDiagnosticFreshness),
            下一步: recoveryLine(snapshot.secondaryDiagnosticFreshness),
          },
        ]
      : []),
  ];
}

export function buildSnapshotRecoveryItems(snapshot = {}) {
  return [
    {
      label: '主账号快照',
      value: snapshot.primaryConnection?.blocked
        ? `${snapshot.primaryConnection.label} / 已阻断`
        : freshnessStatus(snapshot.primaryFreshness),
      status: snapshot.primaryBlocked ? 'blocked' : 'ok',
      hint: freshnessEvidence(snapshot.primaryFreshness),
    },
    ...(snapshot.secondaryEnabled
      ? [
          {
            label: '部署账号快照',
            value: snapshot.secondaryConnection?.blocked
              ? `${snapshot.secondaryConnection.label} / 已阻断`
              : freshnessStatus(snapshot.secondaryFreshness),
            status: snapshot.secondaryBlocked ? 'blocked' : 'ok',
            hint: freshnessEvidence(snapshot.secondaryFreshness),
          },
        ]
      : []),
    {
      label: '当前持仓可信度',
      value:
        snapshot.snapshotRecovery?.status === 'ok'
          ? '可用于只读复核'
          : snapshot.snapshotRecovery?.status === 'warn'
            ? '主账号可复核 / 双账号合计待确认'
            : '未知 / 已阻断',
      status: snapshot.snapshotRecovery?.status || 'blocked',
      hint: snapshot.secondaryEnabled
        ? '各账号独立判断；第二账号异常不会抹掉健康主账号的只读可信范围。'
        : '当前只核对主账号的新鲜只读证据。',
    },
  ];
}

export function buildSnapshotRecoveryRows(snapshot = {}) {
  return [
    {
      账户: 'USDJPY MT5 主账号',
      状态: snapshot.primaryConnection?.blocked
        ? `${snapshot.primaryConnection.label} / 已阻断`
        : freshnessStatus(snapshot.primaryFreshness),
      数据年龄: freshnessEvidence(snapshot.primaryFreshness),
      当前可信范围: snapshot.primaryBlocked ? '历史证据；当前账号、持仓和权限不可确认' : '只读当前状态',
      下一步: recoveryLine(snapshot.primaryFreshness),
    },
    ...(snapshot.secondaryEnabled
      ? [
          {
            账户: 'USDJPY 外汇部署账号',
            状态: snapshot.secondaryConnection?.blocked
              ? `${snapshot.secondaryConnection.label} / 已阻断`
              : freshnessStatus(snapshot.secondaryFreshness),
            数据年龄: freshnessEvidence(snapshot.secondaryFreshness),
            当前可信范围: snapshot.secondaryBlocked
              ? '历史证据；当前账号、持仓和权限不可确认'
              : '只读当前状态',
            下一步: recoveryLine(snapshot.secondaryFreshness),
          },
        ]
      : []),
  ];
}

export function buildSnapshotRootCauseBanner(snapshot = {}) {
  if (snapshot.operatorOverviewRequested) {
    const state = snapshot.operatorOverviewState || {};
    const overview = snapshot.operatorOverview || {};
    if (!state.valid) {
      const error =
        snapshot.raw?.operatorOverview?._api?.error?.message ||
        snapshot.raw?.operatorOverview?.error?.message ||
        snapshot.raw?.operatorOverview?.error ||
        state.label ||
        '接口不可用';
      return {
        status: 'blocked',
        label: '核心状态已阻断',
        title: '统一运营状态不可确认',
        rootCauseLine: `核心聚合证据不可用：${error}`,
        blockedLine: 'Dashboard 总体状态、MT5 六轴、数据、自动化、生产证据与磁盘状态',
        usableLine: '旧端点仅可作为诊断明细，不能证明总体正常',
        evidenceLine: '/api/operator/overview 未返回有效 quantgod.operator_overview.v1',
        recoveryPathLine: '/api/operator/overview',
        nextAction: '恢复或重启本地后端服务并确认该端点返回完整 JSON；恢复前保持 Shadow / ReadOnly 阻断。',
      };
    }

    if (snapshot.primaryExplicitConnectionBlocked) {
      return {
        status: 'blocked',
        label: '主账号连接证据冲突',
        title: '主账号当前只读状态不可确认',
        rootCauseLine: `统一总览与新鲜主账号明细冲突：${snapshot.primaryConnection?.label || '连接未就绪'}。`,
        blockedLine: '主账号当前净值、余额、持仓、挂单与权限状态。',
        usableLine: snapshot.secondaryEnabled
          ? '历史交易流水、研究证据与第二账号诊断仍可只读复核。'
          : '历史交易流水与研究证据仍可只读复核。',
        evidenceLine: '/api/operator/overview + /api/mt5-readonly/snapshot',
        recoveryPathLine: '/vue/?workspace=mt5',
        nextAction: '核对主账号 Broker、授权、writer、进程与 readReady 显式证据；冲突解除前保持阻断。',
      };
    }

    const rawTone = snapshot.overallStatusTone || 'blocked';
    const reasons = operatorBlockedReasons(overview);
    const reasonLine = reasons.map(operatorBlockerLabel).join('；');
    const writerAge = numberOrNull(overview.mt5?.writerAgeSeconds);
    const researchGateOnly =
      operatorHasOnlyResearchGateBlockers(overview) && snapshot.primaryBlocked !== true;
    const partialOverview =
      snapshot.partiallyAvailable === true &&
      (snapshot.operatorOverviewState?.status !== 'blocked' || researchGateOnly);
    const partialWithResearchGate = partialOverview && researchGateOnly;
    const tone = researchGateOnly || partialOverview ? 'warn' : rawTone;
    return {
      status: tone,
      label: partialWithResearchGate
        ? '系统部分可用 · 研究门禁与第二账号待恢复'
        : researchGateOnly
          ? '系统运行正常 · 研究门禁待恢复'
          : partialOverview
            ? `系统部分可用 · 第二账号：${snapshot.secondaryBlockReason || '待恢复'}`
            : `统一状态 · ${humanizeStatus(overview.overallStatus, overview.overallStatus)}`,
      title: partialWithResearchGate
        ? '主账号只读监控正常，研究门禁与第二账号需要恢复'
        : researchGateOnly
          ? '系统运行正常，研究门禁尚未通过'
          : partialOverview
            ? '主账号只读监控正常，第二账号需要恢复'
            : tone === 'ok'
              ? '统一运营状态通过（Shadow / ReadOnly）'
              : tone === 'warn'
                ? '统一运营状态需要人工复核'
                : '统一运营状态已阻断',
      rootCauseLine:
        (partialWithResearchGate
          ? `原始 overallStatus=${overview.overallStatus}；研究/晋级受限：${reasonLine}；第二账号：${snapshot.secondaryBlockReason || '待恢复'}。`
          : researchGateOnly
            ? `原始 overallStatus=${overview.overallStatus}；只限制研究/晋级：${reasonLine}`
            : partialOverview
              ? `统一运营与主账号监控正常；第二账号：${snapshot.secondaryBlockReason || '待恢复'}。`
              : reasonLine) ||
        (tone === 'ok' ? '服务、MT5 监控、数据、自动化、生产证据与磁盘均已通过。' : '聚合状态为 WARN。'),
      blockedLine: partialWithResearchGate
        ? '自动化研究结论、生产证据晋级与第二账号当前状态；不影响主账号只读监控。'
        : researchGateOnly
          ? '自动化研究结论与生产证据晋级；不影响 MT5 只读监控。'
          : partialOverview
            ? '仅第二账号当前状态、持仓与净值；不影响主账号只读监控。'
            : tone === 'ok'
              ? '无'
              : reasonLine || '总体运营就绪度',
      usableLine: partialWithResearchGate
        ? '本地服务、主账号连接与授权、writer、历史数据及 Shadow / ReadOnly 监控均可继续运行'
        : researchGateOnly
          ? '本地服务、MT5 连接与授权、writer、历史数据及 Shadow / ReadOnly 监控均可继续运行'
          : partialOverview
            ? '统一运营总览与主账号 Shadow / ReadOnly 监控可继续使用'
            : '系统始终保持 Shadow / ReadOnly；详细端点可继续用于只读诊断',
      evidenceLine: [
        `生成时间 ${overview.generatedAt || '未知'}`,
        `数据根 ${overview.canonicalDataRoot?.id || '未知'}`,
        writerAge === null ? 'writer 年龄未知' : `writer ${writerAge.toFixed(1)} 秒`,
      ].join('；'),
      recoveryPathLine: '/api/operator/overview',
      nextAction: partialWithResearchGate
        ? `保持主账号只读运行；补齐研究门禁证据；${snapshot.secondaryNextAction || '单独恢复第二账号后刷新状态。'}`
        : researchGateOnly
          ? '系统继续只读运行；补齐研究证据后重新评估门禁，不修改原始 overallStatus。'
          : partialOverview
            ? `保持主账号只读运行；${snapshot.secondaryNextAction || '单独恢复第二账号后刷新状态。'}`
            : tone === 'ok'
              ? '继续只读观察；该状态不构成任何实盘执行授权。'
              : '按 blockedReasons 恢复对应本地证据，再刷新统一运营总览。',
    };
  }

  const tone = snapshot.snapshotRecovery?.status || 'blocked';
  const blocked = tone === 'blocked';
  const partiallyAvailable = tone === 'warn';
  const blockers = [
    snapshot.primaryBlocked ? `主账号：${freshnessStatus(snapshot.primaryFreshness)}` : '',
    snapshot.secondaryEnabled && snapshot.secondaryBlocked
      ? `部署账号：${freshnessStatus(snapshot.secondaryFreshness)}`
      : '',
  ].filter(Boolean);
  return {
    status: tone,
    label: blocked ? '快照证据已阻断' : partiallyAvailable ? '主账号可用 · 第二账号待恢复' : '快照证据新鲜',
    title: blocked
      ? 'USDJPY MT5 当前状态不可直接信任'
      : partiallyAvailable
        ? '主账号只读状态可信，第二账号需要恢复'
        : 'USDJPY MT5 只读快照可用于复核',
    rootCauseLine: blocked
      ? blockers.join('；') || '只读快照证据缺失'
      : partiallyAvailable
        ? `主账号只读证据正常；第二账号：${snapshot.secondaryBlockReason || '状态不可确认'}。`
        : snapshot.secondaryEnabled
          ? '两个外汇账号快照均明确 fresh=true。'
          : '主账号快照明确 fresh=true。',
    blockedLine: blocked
      ? '账号、持仓、净值、权限和入场准备度'
      : partiallyAvailable
        ? '仅第二账号当前状态、持仓与净值'
        : '无',
    usableLine: partiallyAvailable
      ? '主账号当前状态与策略、历史回测、GA、治理证据仍可只读复核'
      : '策略、历史回测、GA 与治理证据仍可只读复核',
    evidenceLine: [
      `主账号 ${freshnessEvidence(snapshot.primaryFreshness)}`,
      ...(snapshot.secondaryEnabled ? [`部署账号 ${freshnessEvidence(snapshot.secondaryFreshness)}`] : []),
    ].join('；'),
    recoveryPathLine: '/vue/?workspace=mt5',
    nextAction: blocked
      ? [
          ...new Set(
            [
              snapshot.primaryBlocked ? recoveryLine(snapshot.primaryFreshness) : '',
              snapshot.secondaryEnabled && snapshot.secondaryBlocked
                ? recoveryLine(snapshot.secondaryFreshness)
                : '',
            ].filter(Boolean),
          ),
        ].join('；')
      : partiallyAvailable
        ? `保持主账号只读运行；${snapshot.secondaryNextAction || '单独恢复第二账号后刷新状态。'}`
        : '继续只读观察 USDJPY 守门状态。',
  };
}

export function buildFrontendSnapshotRecoveryRows(snapshot = {}) {
  const mt5Tone = snapshot.snapshotRecovery?.status || 'blocked';
  const mt5Blocked = mt5Tone === 'blocked';
  const mt5Partial = mt5Tone === 'warn';
  const operatorBanner = buildSnapshotRootCauseBanner(snapshot);
  const researchGateOnly =
    operatorHasOnlyResearchGateBlockers(snapshot.operatorOverview) && snapshot.primaryBlocked !== true;
  const partialWithResearchGate = snapshot.partiallyAvailable && researchGateOnly;
  const dashboardTone = snapshot.operatorOverviewRequested
    ? snapshot.operatorOverviewState?.valid
      ? operatorBanner.status
      : 'blocked'
    : mt5Tone;
  return [
    {
      前端区域: 'Dashboard',
      打开页面: '/vue/?workspace=dashboard',
      核对端点: snapshot.operatorOverviewRequested
        ? '/api/operator/overview'
        : '/api/latest + /api/mt5-readonly/snapshot',
      修复优先级: dashboardTone === 'blocked' ? 'P0' : dashboardTone === 'warn' ? 'P1' : 'P2',
      状态:
        dashboardTone === 'blocked'
          ? '统一运营状态已阻断'
          : dashboardTone === 'warn'
            ? partialWithResearchGate
              ? '主账号可用 / 研究门禁与第二账号待恢复'
              : snapshot.partiallyAvailable
                ? '主账号可用 / 第二账号待恢复'
                : researchGateOnly
                  ? '系统运行正常 / 研究门禁待恢复'
                  : '统一运营状态待复核'
            : '只读运营状态可用',
      可信范围:
        dashboardTone === 'ok'
          ? '统一只读运营状态'
          : partialWithResearchGate
            ? '统一总览与主账号只读状态；研究晋级与第二账号待恢复'
            : snapshot.partiallyAvailable
              ? '统一总览与主账号只读状态'
              : '诊断明细与历史证据',
      下一步:
        dashboardTone === 'ok'
          ? '继续观察。'
          : partialWithResearchGate
            ? `保持主账号只读运行并补齐研究门禁；${snapshot.secondaryNextAction || '单独恢复第二账号。'}`
            : snapshot.partiallyAvailable
              ? `保持主账号只读运行；${snapshot.secondaryNextAction || '单独恢复第二账号。'}`
              : researchGateOnly
                ? '保持只读运行并补齐研究门禁证据。'
                : '按 Operator Overview 的 blockedReasons 恢复证据。',
    },
    {
      前端区域: 'MT5',
      打开页面: '/vue/?workspace=mt5',
      核对端点: snapshot.secondaryEnabled
        ? '/api/mt5-readonly/snapshot + /api/mt5-readonly-secondary/snapshot'
        : '/api/mt5-readonly/snapshot',
      修复优先级: mt5Blocked ? 'P0' : mt5Partial ? 'P1' : 'P2',
      状态: mt5Blocked ? '账号状态不可确认' : mt5Partial ? '主账号可用 / 第二账号待恢复' : '只读账号状态可用',
      可信范围: mt5Blocked
        ? '历史流水与恢复指引'
        : mt5Partial
          ? '主账号只读当前状态；第二账号仅历史与恢复指引'
          : snapshot.secondaryEnabled
            ? 'USDJPY 两个外汇账号'
            : '当前启用的 USDJPY 主账号',
      下一步: mt5Blocked
        ? '恢复终端、EA dashboard writer 与只读桥。'
        : mt5Partial
          ? `保持主账号只读运行；${snapshot.secondaryNextAction || '单独恢复第二账号。'}`
          : '继续核对守门状态。',
    },
    {
      前端区域: 'Evolution',
      打开页面: '/vue/?workspace=evolution',
      核对端点: '/api/usdjpy-strategy-lab/evolution/status',
      修复优先级: 'P2',
      状态: '研究证据可独立复核',
      可信范围: 'USDJPY 策略、回放、GA 与 Case Memory',
      下一步: '保持 Shadow / tester 边界，不把研究候选当作执行授权。',
    },
  ];
}

export function buildSnapshotImpactSummary(snapshot = {}) {
  const rows = buildFrontendSnapshotRecoveryRows(snapshot);
  const count = (priority) => rows.filter((row) => row.修复优先级 === priority).length;
  const banner = buildSnapshotRootCauseBanner(snapshot);
  const blocked = banner.status === 'blocked';
  return {
    status: banner.status,
    rows,
    p0Count: count('P0'),
    p1Count: count('P1'),
    p2Count: count('P2'),
    affectedAreaLine: blocked
      ? snapshot.snapshotRecovery?.status === 'ok'
        ? 'Dashboard 总体运营状态受影响；MT5 只读监控仍可复核'
        : 'Dashboard 与 MT5 当前状态受影响'
      : banner.status === 'warn'
        ? snapshot.partiallyAvailable &&
          operatorHasOnlyResearchGateBlockers(snapshot.operatorOverview) &&
          snapshot.primaryBlocked !== true
          ? '主账号只读监控正常；研究门禁与第二账号需要恢复'
          : snapshot.partiallyAvailable
            ? '主账号只读监控正常；仅第二账号需要恢复'
            : operatorHasOnlyResearchGateBlockers(snapshot.operatorOverview) &&
                snapshot.primaryBlocked !== true
              ? '系统运行正常；Dashboard 仅显示研究门禁待恢复'
              : 'Dashboard 总体运营状态需要人工复核'
        : '当前状态未发现聚合阻断',
    priorityLine: `P0 ${count('P0')} / P1 ${count('P1')} / P2 ${count('P2')}`,
    evidenceLine: banner.evidenceLine,
    usableLine: 'Evolution 研究证据、历史回测与治理记录仍可只读复核',
    trustedScopeLine:
      snapshot.snapshotRecovery?.status === 'blocked'
        ? '可信范围不包含当前账号、持仓或权限'
        : snapshot.snapshotRecovery?.status === 'warn'
          ? '主账号只读当前状态可复核；第二账号当前状态不可确认'
          : '只读当前状态可复核；不构成执行授权',
    nextActionLine: banner.nextAction,
  };
}

export function buildCoreEvidenceRecoveryRows(snapshot = {}) {
  if (snapshot.operatorOverviewRequested) {
    return buildOperatorOverviewBlockerRows(snapshot).map((row) => ({
      优先级: row.优先级,
      证据: row.说明,
      当前状态: row.阻断代码,
      端点: row.证据端点,
      下一步: row.下一步,
    }));
  }
  if (snapshot.snapshotRecovery?.status === 'ok') return [];
  return buildSnapshotRecoveryRows(snapshot)
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => (index === 0 ? snapshot.primaryBlocked : snapshot.secondaryBlocked))
    .map(({ row, index }) => ({
      优先级: index === 0 || snapshot.snapshotRecovery?.status === 'blocked' ? 'P0' : 'P1',
      证据: row.账户,
      当前状态: row.状态,
      端点: index === 0 ? '/api/mt5-readonly/snapshot' : '/api/mt5-readonly-secondary/snapshot',
      下一步: row.下一步,
    }));
}

export function buildRuntimeItems(snapshot = {}) {
  const runtime = snapshot.runtime || {};
  return [
    {
      label: '运行模式',
      value: runtime.mode || snapshot.latest?.mode || '未知 / 已阻断',
      status: runtime.mode ? 'ok' : 'blocked',
    },
    {
      label: '熔断',
      value: snapshot.killSwitchLabel || '熔断状态未知',
      status: snapshot.killSwitchStatus || 'warn',
    },
    {
      label: '后端执行开关',
      value:
        runtime.executionEnabled === false
          ? '已禁用 · Shadow / ReadOnly'
          : runtime.executionEnabled === true
            ? '异常：后端明确开启'
            : '未确认 / 已阻断',
      status: runtime.executionEnabled === false ? 'ok' : 'blocked',
      hint: '前端不提供发单能力，当前系统也没有执行通道。',
    },
  ];
}

export function buildDailyItems(snapshot = {}) {
  const daily = snapshot.dailyAutopilotV2 || {};
  return [
    { label: '日报状态', value: daily.statusZh || daily.status || '等待日报证据' },
    { label: '今日待办', value: rows(daily.dailyTodo || daily.todo).length },
    {
      label: '复盘结论',
      value: snapshot.dailyReview?.statusZh || snapshot.dailyReview?.status || '等待复盘',
    },
    { label: '关注品种', value: 'USDJPY' },
  ];
}

export function buildAgentOpsItems(raw = {}) {
  const health = unwrap(raw.agentOpsHealth);
  const evidence = resolveDashboardEvidenceState(raw.agentOpsHealth);
  if (!evidence.transportOk) {
    return [
      { label: 'Agent 状态', value: 'UNKNOWN / 已阻断', status: 'blocked' },
      { label: '检查项', value: '—', status: 'blocked' },
      { label: '阻断项', value: '—', status: 'blocked' },
      { label: '关注品种', value: 'USDJPY' },
    ];
  }
  return [
    {
      label: 'Agent 状态',
      value: evidence.label || health.overallStatusZh || health.statusZh || '等待检查',
      status: evidence.status,
    },
    { label: '检查项', value: rows(health.checks).length },
    {
      label: '阻断项',
      value: rows(health.blockers).length,
      status: rows(health.blockers).length ? 'blocked' : 'ok',
    },
    { label: '关注品种', value: 'USDJPY' },
  ];
}

export function buildAgentOpsRows(raw = {}) {
  const evidence = resolveDashboardEvidenceState(raw.agentOpsHealth);
  if (!evidence.transportOk) {
    return [{ 检查: 'Agent 自动化健康证据', 状态: '接口不可用', 说明: evidence.label }];
  }
  const health = unwrap(raw.agentOpsHealth);
  return rows(health.checks || health.items).map((item, index) => ({
    检查: item.labelZh || item.label || item.name || `检查 ${index + 1}`,
    状态: item.statusZh || humanizeStatus(item.status || 'UNKNOWN'),
    说明: item.reasonZh || item.detailZh || item.message || '—',
  }));
}

export function telegramGatewayStatus(raw = {}) {
  if (!resolveDashboardEvidenceState(raw.telegramGateway).transportOk) return 'blocked';
  return normalizeTelegramSafety(unwrapTelegramPayload(raw.telegramGateway)).tone;
}

export function telegramGatewayStatusLabel(raw = {}) {
  if (!resolveDashboardEvidenceState(raw.telegramGateway).transportOk) return '接口不可用';
  return normalizeTelegramSafety(unwrapTelegramPayload(raw.telegramGateway)).label;
}

export function buildTelegramGatewayItems(raw = {}) {
  const state = unwrapTelegramPayload(raw.telegramGateway);
  const safety = normalizeTelegramSafety(state);
  const sentCount = telegramMetric(state.actualSentCount ?? state.deliveredCount);
  const lastDelivery = state.lastDelivery
    ? normalizeTelegramDelivery({ delivery: state.lastDelivery })
    : normalizeTelegramDelivery({});
  const hasAggregateReceipt = Boolean(state.deliveryObservability?.lastActualSentAtIso);
  const confirmedSentCount =
    sentCount === '—' || Number(sentCount) === 0 || lastDelivery.code === 'SENT' || hasAggregateReceipt
      ? sentCount
      : '—';
  return [
    { label: '队列', value: telegramMetric(state.queuedCount) },
    { label: '待投递', value: telegramMetric(state.pendingCount) },
    { label: '已确认投递', value: confirmedSentCount },
    { label: '边界', value: safety.label, status: safety.tone, hint: safety.reason },
  ];
}

export function buildRouteRows(snapshot = {}) {
  return (snapshot.routeItems || []).slice(0, 8).map((item, index) => ({
    id: item.id || item.routeId || `route-${index}`,
    route: item.routeZh || item.route || item.name || `USDJPY 路线 ${index + 1}`,
    status: humanizeStatus(item.status || item.stage || 'UNKNOWN'),
    score: item.score ?? item.fitness ?? '—',
    note: item.reasonZh || item.note || item.detailZh || '',
  }));
}

export function buildDailyTodoRows(raw = {}) {
  const source = unwrap(raw.dailyAutopilotV2);
  return rows(source.dailyTodo || source.todo || source.todos).map((item, index) => ({
    优先级: item.priority || item.level || 'P2',
    待办: item.titleZh || item.title || item.actionZh || item.action || `待办 ${index + 1}`,
    状态: item.statusZh || humanizeStatus(item.status || 'WAITING'),
    下一步: item.nextActionZh || item.reasonZh || '—',
  }));
}

export function buildDailyReviewRows(raw = {}) {
  const source = unwrap(raw.dailyReview);
  return rows(source.items || source.rows || source.reviews).map((item, index) => ({
    项目: item.titleZh || item.title || item.label || `复盘 ${index + 1}`,
    结论: item.statusZh || item.conclusionZh || humanizeStatus(item.status || 'UNKNOWN'),
    说明: item.reasonZh || item.detailZh || item.note || '—',
  }));
}
