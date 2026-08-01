/**
 * QuantGod governance workspace model.
 *
 * The model normalizes advisory/governance evidence for display only. It must
 * never create a write request, promote/demote a route, mutate a live preset, or
 * expose execution affordances.
 */

const UNKNOWN = 'unknown';
const EMPTY_TEXT = '—';

export const GOVERNANCE_SAFETY_DEFAULTS = Object.freeze({
  advisoryOnly: true,
  readOnlyDataPlane: true,
  orderSendAllowed: false,
  closeAllowed: false,
  cancelAllowed: false,
  credentialStorageAllowed: false,
  livePresetMutationAllowed: false,
  canOverrideKillSwitch: false,
  canMutateGovernanceDecision: false,
  canPromoteOrDemoteRoute: false,
  requiresManualAuthorization: true,
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
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
    if (['true', 'yes', 'y', '1', 'enabled', 'active', 'allow', 'allowed'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0', 'disabled', 'inactive', 'deny', 'denied', 'blocked'].includes(normalized))
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

function formatPercent(value) {
  const num = numberFrom(value, null);
  if (num === null) return EMPTY_TEXT;
  if (num <= 1) return `${Math.round(num * 100)}%`;
  return `${Math.round(num)}%`;
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.routes)) return payload.routes;
  if (Array.isArray(payload?.registry)) return payload.registry;
  if (Array.isArray(payload?.versions)) return payload.versions;
  if (Array.isArray(payload?.strategies)) return payload.strategies;
  if (isObject(payload?.data)) return Object.values(payload.data).filter(isObject);
  if (isObject(payload)) return Object.values(payload).filter(isObject);
  return [];
}

function statusFromAvailability(value) {
  return value ? 'ok' : 'unknown';
}

function decisionStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized || normalized === '—') return 'unknown';
  if (
    ['keep', 'allow', 'approved', 'pass', 'ok', 'safe', 'available', 'green'].some((word) =>
      normalized.includes(word),
    )
  )
    return 'ok';
  if (
    ['hold', 'manual', 'pending', 'watch', 'review', 'caution', 'yellow'].some((word) =>
      normalized.includes(word),
    )
  )
    return 'warn';
  if (
    ['block', 'deny', 'reject', 'demote', 'fail', 'red', 'locked'].some((word) => normalized.includes(word))
  )
    return 'error';
  return 'unknown';
}

function compactReasonList(payload, limit = 5) {
  const candidates = [
    payload?.reasons,
    payload?.reason_codes,
    payload?.why,
    payload?.risk_factors,
    payload?.next_steps,
    payload?.data?.reasons,
    payload?.data?.why,
  ];
  for (const item of candidates) {
    if (Array.isArray(item)) {
      return item.map((entry) => (isObject(entry) ? JSON.stringify(entry) : String(entry))).slice(0, limit);
    }
    if (typeof item === 'string' && item.trim()) {
      return item
        .split(/[\n;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, limit);
    }
  }
  return [];
}

export function buildEndpointItems(state = {}) {
  return [
    {
      label: '治理建议',
      endpoint: '/api/governance/advisor',
      status: statusFromAvailability(state.advisor),
      description: state.advisor ? '证据已读取' : '缺失',
    },
    {
      label: '策略版本登记',
      endpoint: '/api/governance/version-registry',
      status: statusFromAvailability(state.versionRegistry),
      description: state.versionRegistry ? '版本已读取' : '缺失',
    },
    {
      label: 'Shadow 研究晋级闸门',
      endpoint: '/api/governance/promotion-gate',
      status: statusFromAvailability(state.promotionGate),
      description: state.promotionGate ? '闸门证据已读取' : '缺失',
    },
    {
      label: '优化计划',
      endpoint: '/api/governance/optimizer-v2',
      status: statusFromAvailability(state.optimizerV2),
      description: state.optimizerV2 ? '计划已读取' : '缺失',
    },
  ];
}

export function buildSafetyEnvelope(state = {}) {
  const advisorSafety = state.advisor?.safety || state.advisor?.data?.safety || {};
  const gateSafety = state.promotionGate?.safety || state.promotionGate?.data?.safety || {};
  const merged = { ...GOVERNANCE_SAFETY_DEFAULTS, ...advisorSafety, ...gateSafety };

  const rows = [
    ['仅给建议', boolFrom(merged.advisoryOnly, true), 'ok'],
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
      '修改实盘配置',
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

export function buildAdvisorSummary(advisor = null) {
  const payload = advisor?.data || advisor || {};
  const recommendation = pick(payload, [
    'recommendation',
    'decision',
    'action',
    'advisor.recommendation',
    'summary.recommendation',
  ]);
  const route = pick(payload, ['route', 'active_route', 'route_name', 'advisor.route', 'summary.route']);
  const riskLevel = pick(payload, ['risk_level', 'riskLevel', 'risk.level', 'summary.risk_level']);
  const confidence = firstDefined(
    valueAt(payload, 'confidence'),
    valueAt(payload, 'advisor.confidence'),
    valueAt(payload, 'summary.confidence'),
    null,
  );
  const reasoning = pick(payload, ['reasoning', 'note', 'summary', 'advisor.reasoning', 'data.reasoning']);
  const updatedAt = pick(payload, ['timestamp', 'updated_at', 'generated_at', 'as_of']);

  return {
    status: decisionStatus(recommendation),
    reasonList: compactReasonList(payload),
    rows: [
      { label: '建议', value: recommendation, status: decisionStatus(recommendation) },
      { label: '路线', value: route, status: route !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '风险级别', value: riskLevel, status: decisionStatus(riskLevel) },
      { label: '置信度', value: formatPercent(confidence), status: confidence === null ? 'unknown' : 'ok' },
      { label: '更新时间', value: updatedAt, status: updatedAt !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '理由', value: reasoning, status: reasoning !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
  };
}

export function buildPromotionGateSummary(gate = null) {
  const payload = gate?.data || gate || {};
  const gateState = pick(payload, ['gate_state', 'state', 'status', 'decision', 'promotion_gate.state']);
  const allowed = firstDefined(
    valueAt(payload, 'allowed'),
    valueAt(payload, 'can_promote'),
    valueAt(payload, 'promotion_allowed'),
    valueAt(payload, 'data.allowed'),
    false,
  );
  const manualRequired = firstDefined(
    valueAt(payload, 'manual_authorization_required'),
    valueAt(payload, 'manual_required'),
    valueAt(payload, 'requires_manual_authorization'),
    true,
  );
  const route = pick(payload, ['route', 'candidate_route', 'strategy', 'promotion_gate.route']);
  const version = pick(payload, ['version', 'candidate_version', 'promotion_gate.version']);
  const updatedAt = pick(payload, ['timestamp', 'updated_at', 'generated_at', 'as_of']);

  return {
    status: boolFrom(allowed, false) ? 'ok' : decisionStatus(gateState || 'locked'),
    reasonList: compactReasonList(payload),
    rows: [
      { label: '闸门状态', value: gateState, status: decisionStatus(gateState) },
      { label: '候选路线', value: route, status: route !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '候选版本', value: version, status: version !== EMPTY_TEXT ? 'ok' : 'unknown' },
      {
        label: '允许 Shadow 研究晋级',
        value: boolFrom(allowed, false) ? '是' : '否',
        status: boolFrom(allowed, false) ? 'ok' : 'locked',
      },
      {
        label: '人工复核',
        value: boolFrom(manualRequired, true) ? '需要' : '不需要',
        status: boolFrom(manualRequired, true) ? 'warn' : 'ok',
      },
      { label: '更新时间', value: updatedAt, status: updatedAt !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
  };
}

export function buildOptimizerSummary(optimizer = null) {
  const payload = optimizer?.data || optimizer || {};
  const mode = pick(payload, ['mode', 'optimizer_mode', 'status', 'plan.mode']);
  const objective = pick(payload, ['objective', 'target', 'goal', 'plan.objective']);
  const route = pick(payload, ['route', 'strategy', 'candidate_route', 'plan.route']);
  const nextAction = pick(payload, ['next_action', 'nextAction', 'recommendation', 'plan.next_action']);
  const riskNote = pick(payload, ['risk_note', 'risk', 'risk_summary', 'plan.risk_note']);
  const updatedAt = pick(payload, ['timestamp', 'updated_at', 'generated_at', 'as_of']);

  return {
    status: decisionStatus(mode || nextAction),
    reasonList: compactReasonList(payload),
    rows: [
      { label: '模式', value: mode, status: decisionStatus(mode) },
      { label: '目标', value: objective, status: objective !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '路线', value: route, status: route !== EMPTY_TEXT ? 'ok' : 'unknown' },
      { label: '下一步', value: nextAction, status: decisionStatus(nextAction) },
      { label: '风险备注', value: riskNote, status: decisionStatus(riskNote) },
      { label: '更新时间', value: updatedAt, status: updatedAt !== EMPTY_TEXT ? 'ok' : 'unknown' },
    ],
  };
}

export function buildVersionRows(versionRegistry = null, limit = 20) {
  const rows = asArray(versionRegistry);
  return rows.slice(0, limit).map((row, index) => {
    const source = row?.data || row || {};
    return {
      '#': index + 1,
      路线: pick(source, ['route', 'route_name', 'strategy', 'name'], `路线-${index + 1}`),
      版本: pick(source, ['version', 'current_version', 'active_version', 'candidate_version']),
      状态: pick(source, ['state', 'status', 'decision', 'gate_state']),
      配置: pick(source, ['preset', 'preset_name', 'set_file']),
      评分: pick(source, ['score', 'pf', 'profit_factor', 'rank']),
      更新时间: pick(source, ['updated_at', 'timestamp', 'generated_at']),
    };
  });
}

export function buildMetricItems(state = {}) {
  const advisor = buildAdvisorSummary(state.advisor);
  const gate = buildPromotionGateSummary(state.promotionGate);
  const optimizer = buildOptimizerSummary(state.optimizerV2);
  const versions = buildVersionRows(state.versionRegistry, 200);

  return [
    { label: '治理建议', value: advisor.rows[0]?.value || UNKNOWN, hint: '综合建议', status: advisor.status },
    {
      label: 'Shadow 研究晋级',
      value: gate.rows[0]?.value || UNKNOWN,
      hint: '只读治理证据',
      status: gate.status,
    },
    {
      label: '登记路线',
      value: versions.length,
      hint: '版本登记记录',
      status: versions.length ? 'ok' : 'unknown',
    },
    {
      label: '优化计划',
      value: optimizer.rows[0]?.value || UNKNOWN,
      hint: '计划状态',
      status: optimizer.status,
    },
  ];
}

export function buildGovernanceViewModel(state = {}) {
  return {
    metrics: buildMetricItems(state),
    endpoints: buildEndpointItems(state),
    safety: buildSafetyEnvelope(state),
    advisor: buildAdvisorSummary(state.advisor),
    promotionGate: buildPromotionGateSummary(state.promotionGate),
    optimizer: buildOptimizerSummary(state.optimizerV2),
    versionRows: buildVersionRows(state.versionRegistry),
    rawEvidence: [
      { title: '治理建议证据', source: '/api/governance/advisor', payload: state.advisor },
      { title: '版本登记证据', source: '/api/governance/version-registry', payload: state.versionRegistry },
      {
        title: 'Shadow 研究晋级证据',
        source: '/api/governance/promotion-gate',
        payload: state.promotionGate,
      },
      { title: '优化计划证据', source: '/api/governance/optimizer-v2', payload: state.optimizerV2 },
    ],
  };
}
