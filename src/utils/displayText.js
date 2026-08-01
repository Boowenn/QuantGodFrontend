const EMPTY = '—';

const STATUS_LABELS = new Map([
  ['ok', '正常'],
  ['healthy', '正常'],
  ['available', '正常'],
  ['ready', '就绪'],
  ['connected', '已连接'],
  ['online', '在线'],
  ['running', '运行中'],
  ['success', '成功'],
  ['completed', '已完成'],
  ['complete', '已完成'],
  ['done', '已完成'],
  ['pass', '通过'],
  ['green', '正常'],
  ['warn', '待确认'],
  ['warning', '待确认'],
  ['pending', '等待中'],
  ['queued', '排队中'],
  ['waiting', '等待中'],
  ['scheduled', '已安排'],
  ['degraded', '降级运行'],
  ['paused', '已暂停'],
  ['yellow', '注意'],
  ['unknown', '未同步'],
  ['missing', '缺失'],
  ['missing_db', '数据库缺失'],
  ['error', '异常'],
  ['failed', '失败'],
  ['fail', '失败'],
  ['offline', '离线'],
  ['critical', '严重异常'],
  ['blocked', '已阻断'],
  ['locked', '已锁定'],
  ['disabled', '已禁用'],
  ['readonly', '只读'],
  ['read_only', '只读'],
  ['dry_run', '模拟运行'],
  ['dry-run', '模拟运行'],
  ['shadow', '模拟观察'],
  ['canary', '模拟验证'],
  ['quarantine', '隔离中'],
  ['test', '测试消息'],
  ['entry', '入场'],
  ['exit', '退出'],
  ['buy', '买入'],
  ['sell', '卖出'],
  ['hold', '观望'],
  ['true', '是'],
  ['false', '否'],
  ['CONFIG_ONLY_AUTO', '仅配置自动化'],
  ['FILE_ONLY_RUN_HISTORY', '只读取运行历史'],
  ['FILE_ONLY_REPORT_WATCHER', '只读取报告监听'],
  ['KEEP_DRY_RUN_UNTIL_POLICY_PASS', '保持只读研究，等待策略通过'],
  ['WAIT_BAR', '等待下一根K线'],
  ['ROUTE_DISABLED', '路线已关闭'],
  ['FULL', '可交易'],
  ['LIVE_0_01', '0.01 手实盘观察'],
  ['SIMULATION_CANDIDATE', '模拟候选'],
  ['MACD_MOMENTUM_TURN', 'MACD 动量转折'],
  ['RULE_PROXY_NO_LLM', '规则代理评分，未调用模型'],
  ['SOURCE_EMPTY', '来源为空'],
  ['PARSED_AGENT_ARTIFACTS', '报告已解析'],
  ['PENDING_REPORT', '等待报告回灌'],
  ['AUTO_PAUSED_BLOCKED', '自动暂停阻断'],
  ['SESSION_BLOCK', '交易时段阻断'],
  ['NO_CROSS_OBSERVED', '未出现交叉，仅观察'],
  ['SHADOW_REVIEW', '模拟复核'],
  ['WAIT_GUARD', '等待守护条件'],
  ['SCHEDULED_TESTER_WINDOW', '已安排测试窗口'],
  ['SCHEDULED_FOR_TESTER_WINDOW', '已安排测试窗口'],
  ['COMPLETE_NO_ACTION', '复盘完成，暂无新增动作'],
  ['REVIEW_COMPLETE_NO_CODE_CHANGE', '复盘完成，暂无代码迭代'],
  ['RETUNE_SPEC_READY_SHADOW_ONLY', '已生成模拟重调方案'],
  ['APPLIED_SHADOW_ONLY', '已进入模拟重调'],
  ['CONFIG_ONLY_WAIT_REPORT_RETUNE', '已生成配置，等待报告回灌'],
  ['sell_side_demoted_after_loss_review', '卖出侧已降级，等待复核'],
  ['live_forward_sample_lt_3', '实盘样本少于 3 笔'],
  ['sample_lt_20', '样本少于 20'],
  ['win_rate_lt_55', '胜率低于 55%'],
  ['avg_signed_pips_not_positive', '平均点数未转正'],
  ['consecutive_losses_ge_2', '连续亏损达到 2 笔'],
  ['consecutive_losses_ge_3', '连续亏损达到 3 笔'],
  ['daily_loss_breach', '当日亏损触发风控'],
  ['drawdown_breach', '回撤触发风控'],
  ['portfolio_limit', '组合上限阻断'],
  ['range_regime', '震荡行情阻断'],
  ['no_signal', '暂无信号'],
  ['news_block', '新闻过滤阻断'],
  ['loss_cooldown', '亏损冷却中'],
]);

const KEY_LABELS = new Map([
  ['endpoint', '数据来源'],
  ['key', '标识'],
  ['source', '来源'],
  ['status', '状态'],
  ['state', '状态'],
  ['mode', '模式'],
  ['eventType', '事件'],
  ['EventType', '事件'],
  ['EVENTTYPE', '事件'],
  ['eventTime', '时间'],
  ['EventTime', '时间'],
  ['EVENTTIME', '时间'],
  ['timestamp', '时间'],
  ['time', '时间'],
  ['updated_at', '更新时间'],
  ['updatedAt', '更新时间'],
  ['generatedAtIso', '生成时间'],
  ['generatedAt', '生成时间'],
  ['EVENTID', '事件编号'],
  ['eventId', '事件编号'],
  ['EventId', '事件编号'],
  ['LABELTIMELOCAL', '标注时间'],
  ['labelTimeLocal', '标注时间'],
  ['OUTCOMELABELTIMELOCAL', '结果时间'],
  ['outcomeLabelTimeLocal', '结果时间'],
  ['LABEL', '标签'],
  ['label', '标签'],
  ['OUTCOME', '结果'],
  ['outcome', '结果'],
  ['symbol', '品种'],
  ['Symbol', '品种'],
  ['SYMBOL', '品种'],
  ['strategy', '策略'],
  ['Strategy', '策略'],
  ['route', '路线'],
  ['routeKey', '路线'],
  ['candidateRoute', '候选路线'],
  ['candidate_route', '候选路线'],
  ['direction', '方向'],
  ['side', '方向'],
  ['Side', '方向'],
  ['type', '类型'],
  ['action', '动作'],
  ['decision', '决策'],
  ['recommendation', '建议'],
  ['reason', '原因'],
  ['reasoning', '理由'],
  ['summary', '摘要'],
  ['note', '说明'],
  ['score', '评分'],
  ['aiScore', 'AI 评分'],
  ['confidence', '置信度'],
  ['probability', '概率'],
  ['liquidity', '流动性'],
  ['volume', '成交量'],
  ['amount', '金额'],
  ['profit', '盈亏'],
  ['pnl', '盈亏'],
  ['netPnl', '净盈亏'],
  ['netUSC', '净盈亏'],
  ['pf', 'PF'],
  ['profitFactor', 'PF'],
  ['winRate', '胜率'],
  ['trades', '交易数'],
  ['rows', '记录'],
  ['items', '项目'],
  ['timeframe', '周期'],
  ['live', '实盘状态'],
  ['mode', '模式'],
]);

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_');
}

function spaced(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

export function humanizeStatus(value, fallback = EMPTY) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? '是' : '否';
  const original = String(value).trim();
  const raw = normalizeToken(value);
  const lower = raw.toLowerCase();
  const tokenLike = /^[a-z0-9_.|/-]+$/i.test(original);
  if (STATUS_LABELS.has(raw)) return STATUS_LABELS.get(raw);
  if (STATUS_LABELS.has(lower)) return STATUS_LABELS.get(lower);
  if (tokenLike) {
    if (lower.includes('keep_dry_run')) return '保持只读研究，等待策略通过';
    if (lower.includes('config_only')) return '仅配置自动化';
    if (lower.includes('file_only')) return '只读本地记录';
    if (lower.includes('auto_paused')) return '自动暂停阻断';
    if (lower.includes('session_block')) return '交易时段阻断';
    if (lower.includes('no_cross')) return '未出现信号，仅观察';
    if (lower.includes('blocked')) return '已阻断';
    if (lower.includes('quarantine')) return '隔离中';
    if (lower.includes('shadow')) return '模拟观察';
    if (lower.includes('canary')) return '模拟验证';
    if (lower.includes('readonly') || lower.includes('read_only')) return '只读';
    if (lower.includes('dry_run')) return '模拟运行';
    if (lower.includes('missing')) return '缺失';
    if (lower.includes('unknown')) return '未同步';
    if (lower.includes('error') || lower.includes('failed')) return '异常';
  }
  if (original.startsWith('/') || original.includes('\\')) return original;
  if (/^[+$¥€£]?\s*\d[\d,]*(\.\d+)?(\s*[A-Z]{3})?$/i.test(original)) return original;
  if (tokenLike && /[,/|]/.test(original)) {
    const parts = original
      .split(/[,/|]+/)
      .map((part) => humanizeStatus(part.trim(), part.trim()))
      .filter(Boolean);
    if (parts.length > 1 && parts.join(' / ') !== original) return parts.join(' / ');
  }
  return String(value);
}

export function humanizeLabel(key, fallback = '') {
  if (key === undefined || key === null || key === '') return fallback || EMPTY;
  const raw = String(key);
  if (KEY_LABELS.has(raw)) return KEY_LABELS.get(raw);
  const upper = raw.toUpperCase();
  if (KEY_LABELS.has(upper)) return KEY_LABELS.get(upper);
  return fallback || spaced(raw);
}

export function statusTone(value) {
  const raw = String(value ?? '').toLowerCase();
  if (
    ['ok', 'healthy', 'available', 'ready', 'connected', 'success', 'completed', 'pass', 'green'].includes(
      raw,
    )
  )
    return 'ok';
  if (['warn', 'warning', 'pending', 'queued', 'waiting', 'degraded', 'paused', 'yellow'].includes(raw))
    return 'warn';
  if (['error', 'failed', 'fail', 'blocked', 'offline', 'critical', 'red'].includes(raw)) return 'error';
  if (['locked', 'disabled', 'dry-run', 'dryrun', 'read-only', 'readonly', 'quarantine'].includes(raw))
    return 'locked';
  return 'unknown';
}

export function formatDisplayValue(value, options = {}) {
  const max = options.max ?? 180;
  if (value === undefined || value === null || value === '') return options.fallback || EMPTY;
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return EMPTY;
    const digits = options.digits ?? 2;
    return value.toLocaleString('zh-CN', {
      maximumFractionDigits: digits,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
    });
  }
  if (typeof value === 'string') {
    if (value.trim().toLowerCase() === '[object object]') return '已有结构化说明';
    const translated = humanizeStatus(value, value);
    return translated.length > max ? `${translated.slice(0, max - 1)}…` : translated;
  }
  if (Array.isArray(value)) return `${value.length} 项`;
  if (typeof value === 'object') {
    const preferred = [
      'summary',
      'reason',
      'reasoning',
      'recommendation',
      'decision',
      'action',
      'status',
      'state',
      'note',
      'message',
    ];
    for (const key of preferred) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
        return formatDisplayValue(value[key], options);
      }
    }
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
      .slice(0, 6)
      .map(([key, entryValue]) => `${humanizeLabel(key)} ${formatDisplayValue(entryValue, { max: 40 })}`);
    const text = entries.join('、') || `${Object.keys(value).length} 项`;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
  return String(value);
}

export function formatCurrencyDisplay(value, currency = 'USD') {
  if (value === undefined || value === null || value === '') return EMPTY;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return formatDisplayValue(value);
  const code = String(currency || 'USD').toUpperCase();
  if (code === 'USC') return `${numeric.toFixed(2)} USC`;
  if (!/^[A-Z]{3}$/.test(code)) return numeric.toFixed(2);
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${code}`.trim();
  }
}

export function compactDisplay(value, max = 120) {
  const text = formatDisplayValue(value, { max: Math.max(max, 40) })
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
