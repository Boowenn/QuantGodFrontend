/**
 * QuantGod ParamLab workspace model.
 *
 * ParamLab is a research/tester evidence plane. This model normalizes batch,
 * scheduler, recovery, report watcher, and tester-window data for display only.
 * It must never create live preset writes, route promotion/demotion actions, or
 * any MT5 execution affordance.
 */

import { formatDisplayValue, humanizeStatus } from '../../utils/displayText.js';

const EMPTY_TEXT = '—';
const UNKNOWN = '—';

export const PARAMLAB_SAFETY_DEFAULTS = Object.freeze({
  researchOnly: true,
  testerOnly: true,
  readOnlyDataPlane: true,
  orderSendAllowed: false,
  closeAllowed: false,
  cancelAllowed: false,
  credentialStorageAllowed: false,
  livePresetMutationAllowed: false,
  canOverrideKillSwitch: false,
  canMutateGovernanceDecision: false,
  canPromoteOrDemoteRoute: false,
  autoPromotionAllowed: false,
  requiresManualAuthorization: true,
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueAt(payload, path) {
  if (!payload || !path) return undefined;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let current = payload;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function pick(payload, paths, fallback = EMPTY_TEXT) {
  for (const path of paths) {
    const value = valueAt(payload, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function boolFrom(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'enabled', 'active', 'allow', 'allowed', 'open'].includes(normalized))
      return true;
    if (
      ['false', 'no', 'n', '0', 'disabled', 'inactive', 'deny', 'denied', 'blocked', 'closed'].includes(
        normalized,
      )
    )
      return false;
  }
  return fallback;
}

function numberFrom(value, fallback = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function statusFromText(value) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized || normalized === '—') return 'unknown';
  if (
    [
      'ok',
      'idle',
      'complete',
      'completed',
      'success',
      'healthy',
      'ready',
      'available',
      'passed',
      'green',
    ].some((word) => normalized.includes(word))
  )
    return 'ok';
  if (
    ['running', 'pending', 'queued', 'watch', 'scheduled', 'recovering', 'caution', 'yellow'].some((word) =>
      normalized.includes(word),
    )
  )
    return 'warn';
  if (
    ['fail', 'failed', 'error', 'blocked', 'stale', 'missing', 'red', 'critical'].some((word) =>
      normalized.includes(word),
    )
  )
    return 'error';
  if (['disabled', 'locked', 'manual', 'tester-only', 'read-only'].some((word) => normalized.includes(word)))
    return 'locked';
  return 'unknown';
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.runs)) return payload.data.runs;
  if (Array.isArray(payload?.data?.queue)) return payload.data.queue;
  if (Array.isArray(payload?.data?.jobs)) return payload.data.jobs;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.runs)) return payload.runs;
  if (Array.isArray(payload?.queue)) return payload.queue;
  if (Array.isArray(payload?.jobs)) return payload.jobs;
  if (isObject(payload?.data)) return Object.values(payload.data).filter(isObject);
  if (isObject(payload)) return Object.values(payload).filter(isObject);
  return [];
}

function payloadOf(payload) {
  return payload?.data || payload || {};
}

function rowValue(row, paths, fallback = EMPTY_TEXT) {
  return pick(row?.data || row || {}, paths, fallback);
}

function isPendingReport(source) {
  return String(rowValue(source, ['status', 'Status', 'state', 'State'], ''))
    .toLowerCase()
    .includes('pending');
}

function metricDisplay(value, source, fallback = EMPTY_TEXT, options = {}) {
  const trades = numberFrom(
    rowValue(
      source,
      ['closedTrades', 'ClosedTrades', 'metrics.closedTrades', 'trades', 'trade_count', 'n_trades'],
      null,
    ),
    null,
  );
  if (options.noTradesAsLabel && trades === 0) return '无成交';
  if (options.pendingAsLabel && isPendingReport(source)) return '待报告';
  if (value !== undefined && value !== null && value !== '') return formatDisplayValue(value);
  if (trades === 0) return '无成交';
  return fallback;
}

function winRateDisplay(value, source) {
  const trades = numberFrom(
    rowValue(
      source,
      ['closedTrades', 'ClosedTrades', 'metrics.closedTrades', 'trades', 'trade_count', 'n_trades'],
      null,
    ),
    null,
  );
  const numeric = numberFrom(value, null);
  if (trades === 0) return '无成交';
  if (isPendingReport(source)) return '待报告';
  if (numeric !== null) {
    const pct = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${pct.toFixed(1)}%`;
  }
  return EMPTY_TEXT;
}

function normalizeRows(rows, limit = 200) {
  return asArray(rows)
    .slice(0, limit)
    .map((row, index) => {
      const source = row?.data || row || {};
      const pf = rowValue(
        source,
        ['profitFactor', 'ProfitFactor', 'metrics.profitFactor', 'pf', 'profit_factor'],
        null,
      );
      const winRate = rowValue(source, ['winRate', 'WinRate', 'metrics.winRate', 'win_rate', 'wr'], null);
      const trades = rowValue(source, [
        'closedTrades',
        'ClosedTrades',
        'metrics.closedTrades',
        'trades',
        'trade_count',
        'n_trades',
      ]);
      return {
        '#': index + 1,
        路线: rowValue(
          source,
          [
            'routeKey',
            'RouteKey',
            'route',
            'route_name',
            'strategy',
            'Strategy',
            'name',
            'preset',
            'candidateId',
            'CandidateId',
          ],
          `项目-${index + 1}`,
        ),
        品种: rowValue(source, ['symbol', 'Symbol', 'pair', 'instrument']),
        周期: rowValue(source, ['tf', 'TF', 'timeframe', 'Timeframe', 'time_frame']),
        状态: humanizeStatus(
          rowValue(source, [
            'status',
            'Status',
            'state',
            'State',
            'result',
            'decision',
            'promotionReadiness',
            'PromotionReadiness',
            'metrics.sampleStatus',
          ]),
        ),
        '盈亏比(PF)': metricDisplay(pf, source, EMPTY_TEXT, {
          noTradesAsLabel: true,
          pendingAsLabel: true,
        }),
        胜率: winRateDisplay(winRate, source),
        交易数: metricDisplay(trades, source),
        净盈亏: metricDisplay(
          rowValue(source, ['netProfit', 'NetProfit', 'metrics.netProfit', 'net_pnl', 'pnl'], null),
          source,
        ),
        更新时间: rowValue(source, [
          'generatedAtIso',
          'GeneratedAtIso',
          'updated_at',
          'updatedAt',
          'timestamp',
          'generated_at',
          'as_of',
        ]),
      };
    });
}

function statusFromAvailability(value) {
  return value ? 'ok' : 'unknown';
}

export function buildEndpointItems(state = {}) {
  return [
    {
      label: '实验状态',
      endpoint: '/api/paramlab/status',
      status: statusFromAvailability(state.status),
      description: '当前批次和排队状态',
    },
    {
      label: '实验结果',
      endpoint: '/api/paramlab/results',
      status: statusFromAvailability(state.results),
      description: '候选参数结果',
    },
    {
      label: '排队调度',
      endpoint: '/api/paramlab/scheduler',
      status: statusFromAvailability(state.scheduler),
      description: '自动排队与窗口安排',
    },
    {
      label: '失败恢复',
      endpoint: '/api/paramlab/recovery',
      status: statusFromAvailability(state.recovery),
      description: '异常恢复证据',
    },
    {
      label: '报告回灌',
      endpoint: '/api/paramlab/report-watcher',
      status: statusFromAvailability(state.reportWatcher),
      description: '测试报告解析状态',
    },
    {
      label: '测试器窗口',
      endpoint: '/api/paramlab/tester-window',
      status: statusFromAvailability(state.testerWindow),
      description: '隔离测试器窗口状态',
    },
    {
      label: '结果流水',
      endpoint: '/api/paramlab/results-ledger',
      status: state.resultRows?.length ? 'ok' : 'unknown',
      description: '已回灌结果记录',
    },
    {
      label: '调度流水',
      endpoint: '/api/paramlab/scheduler-ledger',
      status: state.schedulerRows?.length ? 'ok' : 'unknown',
      description: '调度执行记录',
    },
  ];
}

export function buildSafetyEnvelope(state = {}) {
  const statusSafety = state.status?.safety || state.status?.data?.safety || {};
  const schedulerSafety = state.scheduler?.safety || state.scheduler?.data?.safety || {};
  const testerSafety = state.testerWindow?.safety || state.testerWindow?.data?.safety || {};
  const merged = { ...PARAMLAB_SAFETY_DEFAULTS, ...statusSafety, ...schedulerSafety, ...testerSafety };
  const rows = [
    ['只读研究', boolFrom(merged.researchOnly, true), 'ok'],
    ['仅测试器', boolFrom(merged.testerOnly, true), 'locked'],
    ['只读数据面', boolFrom(merged.readOnlyDataPlane, true), 'ok'],
    [
      '允许下单',
      boolFrom(merged.orderSendAllowed, false),
      boolFrom(merged.orderSendAllowed, false) ? 'error' : 'ok',
    ],
    ['允许平仓', boolFrom(merged.closeAllowed, false), boolFrom(merged.closeAllowed, false) ? 'error' : 'ok'],
    [
      '允许撤单',
      boolFrom(merged.cancelAllowed, false),
      boolFrom(merged.cancelAllowed, false) ? 'error' : 'ok',
    ],
    [
      '保存凭据',
      boolFrom(merged.credentialStorageAllowed, false),
      boolFrom(merged.credentialStorageAllowed, false) ? 'error' : 'ok',
    ],
    [
      '修改 MT5 preset',
      boolFrom(merged.livePresetMutationAllowed, false),
      boolFrom(merged.livePresetMutationAllowed, false) ? 'error' : 'ok',
    ],
    [
      '绕过熔断',
      boolFrom(merged.canOverrideKillSwitch, false),
      boolFrom(merged.canOverrideKillSwitch, false) ? 'error' : 'ok',
    ],
    [
      '修改治理结论',
      boolFrom(merged.canMutateGovernanceDecision, false),
      boolFrom(merged.canMutateGovernanceDecision, false) ? 'error' : 'ok',
    ],
    [
      '升降级路线',
      boolFrom(merged.canPromoteOrDemoteRoute, false),
      boolFrom(merged.canPromoteOrDemoteRoute, false) ? 'error' : 'ok',
    ],
    [
      '创建执行通道',
      boolFrom(merged.autoPromotionAllowed, false),
      boolFrom(merged.autoPromotionAllowed, false) ? 'error' : 'ok',
    ],
    [
      '需要人工授权',
      boolFrom(merged.requiresManualAuthorization, true),
      boolFrom(merged.requiresManualAuthorization, true) ? 'locked' : 'warn',
    ],
  ];
  return rows.map(([label, value, status]) => ({
    label,
    value: typeof value === 'boolean' ? (value ? '是' : '否') : String(value),
    status,
  }));
}

export function buildBatchSummary(state = {}) {
  const statusPayload = payloadOf(state.status);
  const resultsPayload = payloadOf(state.results);
  const rows = normalizeRows(state.resultRows?.length ? state.resultRows : resultsPayload, 200);
  const queueLength = firstDefined(
    valueAt(statusPayload, 'queue_length'),
    valueAt(statusPayload, 'queue.length'),
    valueAt(statusPayload, 'pending'),
    valueAt(resultsPayload, 'pending'),
    null,
  );
  const stateText = pick(statusPayload, ['state', 'status', 'phase', 'mode']);
  const activeRoute = pick(statusPayload, ['active_route', 'route', 'current.route', 'current_route']);
  const currentRun = pick(statusPayload, ['current_run', 'run_id', 'batch_id', 'current.run_id']);
  const lastResult = rows[0]?.status || pick(resultsPayload, ['status', 'last_status', 'summary.status']);
  const updatedAt = pick(statusPayload, ['updated_at', 'timestamp', 'generated_at', 'as_of']);
  return {
    status: statusFromText(stateText || lastResult),
    statusLabel: humanizeStatus(stateText || lastResult || UNKNOWN),
    rows: [
      { label: '实验状态', value: humanizeStatus(stateText), status: statusFromText(stateText) },
      { label: '当前路线', value: activeRoute, status: activeRoute !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '当前批次', value: currentRun, status: currentRun !== EMPTY_TEXT ? 'ok' : 'unknown' },
      {
        label: '排队数量',
        value: numberFrom(queueLength, rows.length),
        status: Number(numberFrom(queueLength, rows.length)) > 0 ? 'warn' : 'ok',
      },
      { label: '结果记录', value: rows.length, status: rows.length ? 'ok' : 'unknown' },
      { label: '最新结果', value: humanizeStatus(lastResult), status: statusFromText(lastResult) },
      { label: '更新时间', value: updatedAt, status: updatedAt !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
    resultRows: rows,
  };
}

export function buildSchedulerSummary(state = {}) {
  const payload = payloadOf(state.scheduler);
  const schedulerRows = normalizeRows(state.schedulerRows?.length ? state.schedulerRows : payload, 200);
  const schedulerState = pick(payload, ['state', 'status', 'scheduler_state', 'mode']);
  const enabled = firstDefined(
    valueAt(payload, 'enabled'),
    valueAt(payload, 'is_enabled'),
    valueAt(payload, 'scheduler.enabled'),
    null,
  );
  const nextAction = pick(payload, [
    'next_action',
    'nextAction',
    'next_run',
    'next_window',
    'scheduler.next_action',
  ]);
  const activeRoute = pick(payload, ['route', 'active_route', 'scheduler.route']);
  const pending = firstDefined(
    valueAt(payload, 'pending'),
    valueAt(payload, 'pending_jobs'),
    valueAt(payload, 'queue_length'),
    schedulerRows.length,
  );
  const updatedAt = pick(payload, ['updated_at', 'timestamp', 'generated_at', 'as_of']);
  const label =
    schedulerState !== EMPTY_TEXT ? schedulerState : boolFrom(enabled, false) ? 'enabled' : UNKNOWN;
  return {
    status: statusFromText(label),
    statusLabel: humanizeStatus(label),
    rows: [
      { label: '调度状态', value: humanizeStatus(schedulerState), status: statusFromText(schedulerState) },
      {
        label: '已启用',
        value: enabled === null ? EMPTY_TEXT : boolFrom(enabled, false) ? '是' : '否',
        status: enabled === null ? 'unknown' : boolFrom(enabled, false) ? 'warn' : 'locked',
      },
      { label: '下一步', value: humanizeStatus(nextAction), status: statusFromText(nextAction) },
      { label: '当前路线', value: activeRoute, status: activeRoute !== EMPTY_TEXT ? 'ok' : 'unknown' },
      {
        label: '待处理任务',
        value: numberFrom(pending, schedulerRows.length),
        status: Number(numberFrom(pending, schedulerRows.length)) > 0 ? 'warn' : 'ok',
      },
      { label: '更新时间', value: updatedAt, status: updatedAt !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
    schedulerRows,
  };
}

export function buildRecoverySummary(state = {}) {
  const recoveryPayload = payloadOf(state.recovery);
  const watcherPayload = payloadOf(state.reportWatcher);
  const testerPayload = payloadOf(state.testerWindow);
  const recoveryState = pick(recoveryPayload, ['state', 'status', 'recovery_state', 'mode']);
  const watcherState = pick(watcherPayload, ['state', 'status', 'watcher_state', 'mode']);
  const testerState = pick(testerPayload, ['state', 'status', 'window_state', 'mode']);
  const testerOpen = firstDefined(
    valueAt(testerPayload, 'open'),
    valueAt(testerPayload, 'is_open'),
    valueAt(testerPayload, 'tester_window.open'),
    null,
  );
  const nextWindow = pick(testerPayload, ['next_window', 'window', 'time_window', 'tester_window.next']);
  const lastRecovered = pick(recoveryPayload, [
    'last_recovered',
    'last_recovery',
    'last_run',
    'recovery.last_recovered',
  ]);
  const reportPath = pick(watcherPayload, [
    'report_path',
    'latest_report',
    'last_report',
    'watcher.latest_report',
  ]);
  const statusLabel =
    recoveryState !== EMPTY_TEXT ? recoveryState : watcherState !== EMPTY_TEXT ? watcherState : testerState;
  return {
    status: statusFromText(statusLabel),
    statusLabel: humanizeStatus(statusLabel || UNKNOWN),
    rows: [
      { label: '恢复状态', value: humanizeStatus(recoveryState), status: statusFromText(recoveryState) },
      { label: '最近恢复', value: lastRecovered, status: lastRecovered !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '报告监听', value: humanizeStatus(watcherState), status: statusFromText(watcherState) },
      { label: '最新报告', value: reportPath, status: reportPath !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '测试器窗口', value: humanizeStatus(testerState), status: statusFromText(testerState) },
      {
        label: '测试器已打开',
        value: testerOpen === null ? EMPTY_TEXT : boolFrom(testerOpen, false) ? '是' : '否',
        status: testerOpen === null ? 'unknown' : boolFrom(testerOpen, false) ? 'warn' : 'locked',
      },
      { label: '下个测试窗口', value: nextWindow, status: nextWindow !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
  };
}

export function buildMetricItems(state = {}) {
  const batch = buildBatchSummary(state);
  const scheduler = buildSchedulerSummary(state);
  const recovery = buildRecoverySummary(state);
  const bestPf = batch.resultRows.reduce((best, row) => {
    const value = numberFrom(row['盈亏比(PF)'], null);
    return value === null ? best : Math.max(best, value);
  }, null);
  return [
    {
      label: '结果记录',
      value: batch.resultRows.length,
      hint: 'ParamLab 结果流水',
      status: batch.resultRows.length ? 'ok' : 'unknown',
    },
    {
      label: '调度记录',
      value: scheduler.schedulerRows.length,
      hint: '已安排实验',
      status: scheduler.schedulerRows.length ? 'ok' : 'unknown',
    },
    {
      label: '调度状态',
      value: scheduler.statusLabel || UNKNOWN,
      hint: '自动化状态',
      status: scheduler.status,
    },
    {
      label: '最佳盈亏比(PF)',
      value: bestPf === null ? EMPTY_TEXT : bestPf.toFixed(2),
      hint: '总盈利 / 总亏损，大于 1 才代表整体盈利',
      status: bestPf === null ? 'unknown' : bestPf >= 1 ? 'ok' : 'warn',
    },
    {
      label: '恢复状态',
      value: recovery.statusLabel || UNKNOWN,
      hint: '运行恢复状态',
      status: recovery.status,
    },
    { label: '安全边界', value: '仅测试器', hint: '不写实盘配置', status: 'locked' },
  ];
}

export function buildParamLabViewModel(state = {}) {
  const batch = buildBatchSummary(state);
  const scheduler = buildSchedulerSummary(state);
  const recovery = buildRecoverySummary(state);
  return {
    metrics: buildMetricItems(state),
    endpoints: buildEndpointItems(state),
    safety: buildSafetyEnvelope(state),
    batch,
    scheduler,
    recovery,
    resultRows: batch.resultRows,
    schedulerRows: scheduler.schedulerRows,
    rawEvidence: [
      { title: '实验状态证据', source: '/api/paramlab/status', payload: state.status },
      { title: '实验结果证据', source: '/api/paramlab/results', payload: state.results },
      { title: '调度证据', source: '/api/paramlab/scheduler', payload: state.scheduler },
      { title: '恢复证据', source: '/api/paramlab/recovery', payload: state.recovery },
      { title: '报告监听证据', source: '/api/paramlab/report-watcher', payload: state.reportWatcher },
      { title: '测试器窗口证据', source: '/api/paramlab/tester-window', payload: state.testerWindow },
    ],
  };
}
