<template>
  <section class="qg-ux-dashboard" aria-label="QuantGod dashboard UX upgrade panel">
    <div class="qg-ux-dashboard__header">
      <div>
        <p class="qg-eyebrow">运营扫描</p>
        <h2>{{ labels.upgradeTitle }}</h2>
        <p>{{ labels.upgradeHint }}</p>
      </div>
      <span class="qg-ux-pill">只读证据</span>
    </div>

    <div class="qg-kpi-row">
      <KpiCard
        :title="labels.kpiPositions"
        :value="kpis.positions"
        :detail="kpis.positionDetail"
        badge="MT5"
      />
      <KpiCard
        title="MT5 今日盈亏"
        :value="kpis.mt5DailyPnlText"
        :tone="kpis.mt5DailyPnlTone"
        :detail="mt5DailyPnlDetail"
      />
      <KpiCard :title="labels.kpiSignals" :value="kpis.signals24h" :detail="kpis.signalDetail" badge="AI" />
      <KpiCard
        :title="labels.kpiAlerts"
        :value="kpis.alerts"
        :tone="kpis.alerts > 0 ? 'warning' : 'neutral'"
        :detail="kpis.alertDetail"
      />
    </div>

    <div class="qg-ux-grid">
      <article class="qg-ux-widget qg-ux-widget--span-6">
        <div class="qg-ux-widget__header">
          <div>
            <h3>{{ labels.aiSummary }}</h3>
            <p>汇总 AI 建议、交易日志和运行状态；这里只显示建议，不触发交易。</p>
          </div>
          <span class="qg-ux-pill">仅建议</span>
        </div>
        <ul class="qg-ux-list">
          <li v-for="item in summaryItems" :key="item.key">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </li>
        </ul>
      </article>

      <article class="qg-ux-widget qg-ux-widget--span-6">
        <div class="qg-ux-widget__header">
          <div>
            <h3>{{ labels.alertTimeline }}</h3>
            <p>把治理、USDJPY MT5 和自动闭环异常合并成可扫描时间线。</p>
          </div>
          <span class="qg-ux-pill">{{ alertRows.length }} 条</span>
        </div>
        <ul v-if="alertRows.length" class="qg-ux-list">
          <li v-for="row in alertRows" :key="row.id">
            <span>{{ row.label }}</span>
            <strong :class="row.toneClass">{{ row.status }}</strong>
          </li>
        </ul>
        <EmptyState v-else title="暂无告警" description="没有从本地运行证据中发现异常项。" />
      </article>

      <article class="qg-ux-widget qg-ux-widget--span-8">
        <div class="qg-ux-widget__header">
          <div>
            <h3>{{ labels.positionSnapshot }}</h3>
            <p>{{ positionSnapshotHint }}</p>
          </div>
          <span class="qg-ux-pill">{{ positionSnapshotBadge }}</span>
        </div>
        <ul v-if="positionRows.length" class="qg-ux-list">
          <li v-for="row in positionRows" :key="row.id">
            <span>{{ row.symbol }} · {{ row.side }} · {{ row.volume }}</span>
            <MiniSparkline
              :values="row.spark"
              :label="`${row.symbol} mini sparkline`"
              :class="row.toneClass"
            />
            <strong :class="row.toneClass">{{ row.pnl }}</strong>
          </li>
        </ul>
        <EmptyState v-else :title="positionEmptyState.title" :description="positionEmptyState.description" />
      </article>

      <article class="qg-ux-widget qg-ux-widget--span-4">
        <div class="qg-ux-widget__header">
          <div>
            <h3>{{ labels.systemHealth }}</h3>
            <p>本地运行健康聚合。</p>
          </div>
        </div>
        <ul class="qg-ux-list">
          <li v-for="item in healthRows" :key="item.key">
            <span>{{ item.label }}</span>
            <strong :class="item.toneClass">{{ item.value }}</strong>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import KpiCard from '../../components/KpiCard.vue';
import EmptyState from '../../components/EmptyState.vue';
import MiniSparkline from '../../components/MiniSparkline.vue';
import {
  formatCurrency,
  formatNumber,
  numberToneClass,
  numberTone,
} from '../../composables/useNumberFormat.js';
import { formatDisplayValue, humanizeStatus } from '../../utils/displayText.js';
import { t } from '../../i18n/index.js';
import { buildSnapshotImpactSummary } from './dashboardModel.js';

const props = defineProps({
  state: { type: Object, required: true },
  snapshot: { type: Object, required: true },
  metrics: { type: Array, default: () => [] },
});

const locale = computed(() =>
  typeof document !== 'undefined' ? document.documentElement?.dataset?.locale || 'zh-CN' : 'zh-CN',
);
const labels = computed(() => ({
  upgradeTitle: t('dashboard.upgradeTitle', locale.value),
  upgradeHint: t('dashboard.upgradeHint', locale.value),
  kpiPositions: t('dashboard.kpiPositions', locale.value),
  kpiPnl: t('dashboard.kpiPnl', locale.value),
  kpiSignals: t('dashboard.kpiSignals', locale.value),
  kpiAlerts: t('dashboard.kpiAlerts', locale.value),
  aiSummary: t('dashboard.aiSummary', locale.value),
  alertTimeline: t('dashboard.alertTimeline', locale.value),
  positionSnapshot: t('dashboard.positionSnapshot', locale.value),
  systemHealth: t('dashboard.systemHealth', locale.value),
  reviewQueue: t('dashboard.reviewQueue', locale.value),
}));

const snapshotImpact = computed(() => buildSnapshotImpactSummary(props.snapshot));
const realtimeSnapshotBlocked = computed(() => snapshotImpact.value.status === 'blocked');

function readPath(source, path) {
  return String(path)
    .split('.')
    .reduce((cursor, part) => (cursor == null ? undefined : cursor[part]), source);
}

function first(paths, fallback = null) {
  for (const path of paths) {
    const value = readPath(props.state, path) ?? readPath(props.snapshot, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  return [];
}

function countRows(paths) {
  for (const path of paths) {
    const rows = asArray(readPath(props.state, path) ?? readPath(props.snapshot, path));
    if (rows.length) return rows.length;
  }
  return 0;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedAmount(value, suffix = 'USD') {
  const numeric = numberOrNull(value);
  if (numeric === null) return '—';
  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
  return `${sign}${Math.abs(numeric).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${suffix}`;
}

function friendlySource(value) {
  const raw = String(value || '');
  if (!raw || raw === 'unknown') return '本地运行证据';
  if (raw.includes('mt5_ea')) return 'MT5 EA 快照';
  if (raw.includes('dashboard')) return '本地看板快照';
  return raw;
}

const kpis = computed(() => {
  const livePositions = countRows([
    'latest.positions',
    'latest.openTrades',
    'mt5Snapshot.positions.items',
    'state.positions',
    'latest.data.positions',
    'state.data.positions',
  ]);
  const signals =
    countRows(['dailyReview.signals', 'dailyReview.data.signals', 'latest.signals', 'latest.signal_rows']) ||
    Number(first(['dailyReview.signals_24h', 'dailyReview.signal_count_24h'], 0));
  const alerts = alertRows.value.length;
  const mt5Pnl = numberOrNull(
    first(
      [
        'dailyReview.dailyPnl.netUSC',
        'dailyReview.summary.dailyNetUSC',
        'dailyPnl',
        'latest.daily_pnl',
        'latest.pnl.daily',
        'state.daily_pnl',
        'state.pnl.daily',
      ],
      null,
    ),
  );
  return {
    positions: realtimeSnapshotBlocked.value ? '不可确认' : livePositions,
    dailyPnl: mt5Pnl ?? 0,
    mt5DailyPnlText: formatSignedAmount(mt5Pnl, 'USC'),
    mt5DailyPnlTone: realtimeSnapshotBlocked.value ? 'warning' : numberTone(mt5Pnl),
    signals24h: Number.isFinite(signals) ? signals : 0,
    alerts,
    positionDetail: realtimeSnapshotBlocked.value
      ? 'MT5 writer 停止；旧持仓不可当当前状态'
      : livePositions
        ? '来自 MT5 外汇只读快照'
        : '当前无持仓',
    signalDetail: 'AI 与策略研究资料只做建议',
    alertDetail: realtimeSnapshotBlocked.value
      ? snapshotImpact.value.priorityLine
      : alerts
        ? 'Agent 已标记异常，硬风控会自动暂停或回滚'
        : '当前无未读异常',
  };
});

const summaryItems = computed(() => [
  {
    key: 'snapshot-impact',
    label: '快照影响',
    value: snapshotImpact.value.priorityLine,
  },
  {
    key: 'snapshot',
    label: '快照来源',
    value: friendlySource(
      first(['mt5Snapshot.source.type', 'source', 'snapshotSource', 'latest.source'], '本地运行证据'),
    ),
  },
  {
    key: 'fresh',
    label: '运行快照新鲜',
    value: realtimeSnapshotBlocked.value
      ? snapshotImpact.value.affectedAreaLine
      : formatDisplayValue(first(['runtimeFresh', 'latest.runtimeFresh'], '待确认')),
  },
  { key: 'trusted-scope', label: '可信范围', value: snapshotImpact.value.trustedScopeLine },
  { key: 'pnl', label: 'MT5 今日盈亏', value: kpis.value.mt5DailyPnlText },
  { key: 'metrics', label: '现有指标卡片', value: formatNumber(props.metrics?.length || 0) },
]);

const alertRows = computed(() => {
  const rows = snapshotImpact.value.rows.slice(0, 4).map((row, index) => ({
    id: `snapshot-impact-${index}`,
    label: `${row.前端区域} · ${row.修复优先级}`,
    status: row.状态,
    toneClass: row.修复优先级 === 'P0' ? 'qg-text-negative' : 'qg-text-warning',
  }));
  const killSwitch = first(
    ['killSwitchStatus', 'kill_switch_status', 'latest.kill_switch', 'state.kill_switch'],
    'unknown',
  );
  const dryRun = first(['dryRunStatus', 'dry_run_status', 'latest.dry_run', 'state.dry_run'], 'unknown');
  if (String(killSwitch).toLowerCase().includes('active') || String(killSwitch).toLowerCase() === 'true') {
    rows.push({
      id: 'kill-switch',
      label: '熔断状态',
      status: humanizeStatus(killSwitch),
      toneClass: 'qg-text-warning',
    });
  }
  if (String(dryRun).toLowerCase() === 'false') {
    rows.push({ id: 'dry-run', label: '模拟保护关闭', status: '需要复核', toneClass: 'qg-text-warning' });
  }
  const rawAlerts = asArray(
    first(['latest.alerts', 'state.alerts', 'dailyReview.alerts', 'dailyAutopilotV2.alerts'], []),
  );
  rawAlerts.slice(0, 5).forEach((row, index) => {
    rows.push({
      id: `raw-${index}`,
      label: row?.message || row?.label || row?.name || `告警 ${index + 1}`,
      status: humanizeStatus(row?.status || row?.severity || 'active'),
      toneClass: 'qg-text-warning',
    });
  });
  return rows.slice(0, 6);
});

const positionRows = computed(() => {
  if (realtimeSnapshotBlocked.value) return [];
  const rows = asArray(
    first(
      [
        'latest.openTrades',
        'mt5Snapshot.positions.items',
        'latest.positions',
        'state.positions',
        'latest.data.positions',
        'state.data.positions',
      ],
      [],
    ),
  );
  return rows.slice(0, 6).map((row, index) => {
    const pnl = Number(row?.pnl ?? row?.profit ?? row?.floating_pnl ?? 0);
    const seed = Number.isFinite(pnl) ? pnl : index;
    const spark = [0, 0.15, -0.05, 0.22, 0.08, 0.3, 0.18, seed / 100].map((v) => v + index * 0.02);
    return {
      id: row?.ticket || row?.id || `${row?.symbol || 'symbol'}-${index}`,
      symbol: row?.symbol || row?.Symbol || 'UNKNOWN',
      side: humanizeStatus(row?.type || row?.side || row?.direction, '—'),
      volume: row?.volume || row?.lots || row?.lot || '—',
      pnl: formatCurrency(pnl),
      toneClass: numberToneClass(pnl),
      spark,
    };
  });
});

const positionSnapshotHint = computed(() => {
  if (realtimeSnapshotBlocked.value) {
    return [
      snapshotImpact.value.trustedScopeLine || '当前账号、持仓和执行准备度不可确认；旧快照只作历史参考。',
      snapshotImpact.value.nextActionLine || '恢复 MT5/EA dashboard writer 后再确认当前持仓。',
    ]
      .filter(Boolean)
      .join('；');
  }
  return 'MT5 只读快照新鲜时才显示当前持仓；无持仓时显示空状态。';
});

const positionSnapshotBadge = computed(() => (realtimeSnapshotBlocked.value ? '当前不可确认' : 'MT5 只读'));

const mt5DailyPnlDetail = computed(() =>
  realtimeSnapshotBlocked.value ? '快照阻断；金额只作历史平仓复盘' : '来自 MT5 平仓复盘',
);

const positionEmptyState = computed(() => {
  if (realtimeSnapshotBlocked.value) {
    return {
      title: '当前持仓不可确认',
      description:
        snapshotImpact.value.nextActionLine ||
        'MT5/EA dashboard writer 停止刷新；恢复 fresh 前，旧持仓和账号状态只作历史参考。',
    };
  }
  return {
    title: '暂无持仓快照',
    description: 'MT5 只读快照已返回但当前无持仓；保持只读观察。',
  };
});

const healthRows = computed(() => [
  {
    key: 'api',
    label: '前端数据面',
    value: realtimeSnapshotBlocked.value ? snapshotImpact.value.priorityLine : '正常',
    toneClass: realtimeSnapshotBlocked.value ? 'qg-text-negative' : 'qg-text-positive',
  },
  {
    key: 'runtime',
    label: '运行状态',
    value: realtimeSnapshotBlocked.value
      ? snapshotImpact.value.affectedAreaLine
      : humanizeStatus(first(['runtimeState', 'status', 'latest.status'], '待确认')),
    toneClass: realtimeSnapshotBlocked.value ? 'qg-text-negative' : 'qg-text-muted',
  },
  {
    key: 'next-action',
    label: '恢复动作',
    value: snapshotImpact.value.nextActionLine || '保持只读快照桥正常刷新',
    toneClass: realtimeSnapshotBlocked.value ? 'qg-text-warning' : 'qg-text-positive',
  },
  {
    key: 'kill',
    label: '熔断保护',
    value: humanizeStatus(first(['killSwitchLabel', 'killSwitchStatus'], '待确认')),
    toneClass: 'qg-text-warning',
  },
  {
    key: 'review',
    label: labels.value.reviewQueue,
    value: `${alertRows.value.length} 条`,
    toneClass: alertRows.value.length ? 'qg-text-warning' : 'qg-text-positive',
  },
]);
</script>
