<template>
  <WorkspaceFrame
    eyebrow="MT5 Shadow / ReadOnly"
    title="MT5 只读证据面板"
    description="先看市场、六轴、账户关键数和当前仓位；诊断与历史证据按需展开。"
    :loading="loading"
    :error="error"
    @refresh="load"
  >
    <div class="qg-readonly-banner">
      <StatusPill :status="readonlyBannerStatus" :label="readonlyBannerLabel" />
      <span
        >前端数据桥保持 Shadow / ReadOnly，不会发单；账号连接、writer
        与报价新鲜度分别显示，休市报价静止不会被当成账号掉线。</span
      >
    </div>

    <section class="qg-snapshot-root-cause" :class="`qg-snapshot-root-cause--${snapshotRootCause.status}`">
      <div class="qg-snapshot-root-cause__main">
        <!-- Guard marker: 全局快照恢复。可见标题使用更短的运营语言。 -->
        <p class="qg-eyebrow">状态结论</p>
        <h2>{{ snapshotRootCause.title }}</h2>
        <p>{{ snapshotRootCause.rootCauseLine }}</p>
      </div>
      <StatusPill :status="snapshotRootCause.status" :label="snapshotRootCause.label" />
      <div class="qg-snapshot-root-cause__grid">
        <span>
          <strong>{{ snapshotRootCause.status === 'ok' ? '当前可信范围' : '当前不可直接信任' }}</strong>
          {{ snapshotRootCause.blockedLine }}
        </span>
        <span>
          <strong>仍可继续复核</strong>
          {{ snapshotRootCause.usableLine }}
        </span>
        <span>
          <strong>证据年龄</strong>
          {{ snapshotRootCause.evidenceLine || '等待 freshness 证据' }}
        </span>
        <span>
          <strong>下一步</strong>
          {{ snapshotRootCause.nextAction }}
        </span>
      </div>
    </section>

    <section class="qg-section-card qg-mt5-core-status">
      <header>
        <div>
          <p class="qg-eyebrow">模式与市场</p>
          <h2>连接、授权与只读就绪</h2>
        </div>
        <StatusPill :status="runtimeSummaryStatus" :label="runtimeSummaryLabel" />
      </header>
      <KeyValueList :items="primaryAxisItems" />
    </section>

    <MetricGrid :items="coreMetrics" />

    <div class="qg-mt5-core-operations">
      <LedgerTable title="实时持仓" :rows="positionRows" :limit="10" />
      <LedgerTable title="挂单状态" :rows="orderRows" :limit="10" />
      <LedgerTable title="研究门禁（不影响账号连接）" :rows="shadowBlockerRows" :limit="3" />
    </div>

    <details class="qg-mt5-progressive">
      <summary>
        <span>账户登记与快照诊断</span>
        <small>按需查看恢复矩阵、账户卡与 Profiles</small>
      </summary>
      <div class="qg-mt5-progressive__content">
        <section class="qg-section-card qg-section-card--operator">
          <header>
            <p class="qg-eyebrow">快照诊断</p>
            <h2>当前账号数据是否可信</h2>
          </header>
          <LedgerTable
            :title="snapshot.secondaryEnabled ? '双账号槽位与只读桥' : '主账号与只读桥'"
            :rows="snapshotRecoveryRows"
            :limit="4"
            class="qg-ledger-table--important qg-ledger-table--mt5-full"
          />
        </section>

        <section
          class="qg-mt5-dual-accounts"
          :aria-label="snapshot.secondaryEnabled ? 'MT5 双账号槽位状态' : 'MT5 主账号状态'"
        >
          <header class="qg-mt5-dual-accounts__header">
            <div>
              <p class="qg-eyebrow">账户详情</p>
              <h2>{{ snapshot.secondaryEnabled ? '双账号槽位概览' : '主账号概览' }}</h2>
            </div>
            <StatusPill :status="runtimeSummaryStatus" :label="runtimeSummaryLabel" />
          </header>
          <div class="qg-mt5-account-cards">
            <article v-for="account in mt5AccountCards" :key="account.role" class="qg-mt5-account-card">
              <div class="qg-mt5-account-card__header">
                <div>
                  <p class="qg-eyebrow">{{ account.eyebrow }}</p>
                  <h3>{{ account.title }}</h3>
                  <p>{{ account.subtitle }}</p>
                </div>
                <StatusPill :status="account.status" :label="account.statusLabel" />
              </div>
              <KeyValueList :items="account.items" />
              <p class="qg-section-note">{{ account.note }}</p>
            </article>
          </div>
        </section>

        <div class="qg-domain-grid">
          <section class="qg-section-card">
            <header>
              <p class="qg-eyebrow">连接摘要</p>
              <h2>当前账号与凭据边界</h2>
            </header>
            <KeyValueList :items="connectionItems" />
          </section>
        </div>
      </div>
    </details>

    <details class="qg-mt5-progressive">
      <summary>
        <span>策略守门与图表</span>
        <small>按需查看策略诊断、影子反馈与 K 线</small>
      </summary>
      <div class="qg-mt5-progressive__content">
        <section class="qg-section-card qg-section-card--operator">
          <header>
            <p class="qg-eyebrow">USDJPY Shadow Advisory（兼容 Live Loop）</p>
            <h2>USDJPY 影子建议与只读证据</h2>
          </header>
          <KeyValueList :items="usdJpyLiveLoopItems" />
        </section>

        <section class="qg-section-card qg-section-card--operator">
          <header>
            <p class="qg-eyebrow">Evidence OS</p>
            <h2>影子结果反馈与下一代修复</h2>
          </header>
          <KeyValueList :items="evidenceOsLiteItems" />
        </section>

        <LedgerTable
          title="历史 / Shadow Feedback（只读）"
          :rows="executionFeedbackRows"
          :limit="20"
          class="qg-ledger-table--important qg-ledger-table--mt5-full"
        />

        <LedgerTable
          title="RSI 影子条件诊断"
          :rows="rsiEntryDiagnosticRows"
          :limit="14"
          class="qg-ledger-table--important qg-ledger-table--mt5-full"
        />

        <section class="qg-section-card qg-section-card--operator qg-mt5-kline-panel">
          <header class="qg-mt5-kline-panel__header">
            <div>
              <p class="qg-eyebrow">USDJPY 专业图表</p>
              <h2>USDJPY K线与只读交易证据</h2>
            </div>
            <button v-if="!klineLoaded" type="button" class="qg-button" @click="enableKline">加载图表</button>
          </header>
          <Suspense v-if="klineLoaded">
            <KlineWorkspace />
            <template #fallback>
              <LoadingState title="正在加载 K 线图" description="图表引擎和实时轮询正在按需启动。" />
            </template>
          </Suspense>
          <p v-else class="qg-section-note">K 线图按需加载，避免首屏占用图表引擎内存。</p>
        </section>
      </div>
    </details>

    <details class="qg-mt5-progressive">
      <summary>
        <span>模拟、历史与安全证据</span>
        <small>按需查看接口、模拟账本与历史流水</small>
      </summary>
      <div class="qg-mt5-progressive__content">
        <EndpointHealthGrid :items="endpointHealth" />

        <section class="qg-section-card qg-section-card--operator">
          <header>
            <p class="qg-eyebrow">Shadow / ReadOnly / 模拟一眼看懂</p>
            <h2>现在系统在做什么</h2>
          </header>
          <KeyValueList :items="simulationItems" />
        </section>

        <section class="qg-section-card qg-section-card--operator">
          <header>
            <p class="qg-eyebrow">MT5 Shadow 账本</p>
            <h2>模拟盘资金与交易效果</h2>
          </header>
          <MetricGrid :items="shadowMetrics" />
          <p class="qg-section-note">
            这里是模拟候选的后验账本：按信号后 60 分钟点数表现去重统计，给 0.01
            手粗略等价估算；它不是成交记录，也不会改 EA 配置。
          </p>
        </section>

        <div class="qg-domain-grid qg-domain-grid--account-snapshots">
          <section class="qg-section-card">
            <header>
              <p class="qg-eyebrow">交易边界</p>
              <h2>交易边界</h2>
            </header>
            <KeyValueList :items="safetyItems" />
          </section>

          <section class="qg-section-card">
            <header>
              <p class="qg-eyebrow">主账号快照</p>
              <h2>主账号账户快照</h2>
            </header>
            <KeyValueList :items="accountItems" />
          </section>

          <section v-if="snapshot.secondaryEnabled" class="qg-section-card">
            <header>
              <p class="qg-eyebrow">第二账号快照</p>
              <h2>第二账号账户快照</h2>
            </header>
            <KeyValueList :items="secondaryAccountItems" />
          </section>
        </div>

        <div class="qg-domain-grid qg-domain-grid--wide-tables">
          <LedgerTable
            title="模拟资金曲线"
            :rows="shadowEquityRows"
            :limit="10"
            class="qg-ledger-table--important"
          />
          <LedgerTable
            title="模拟交易记录"
            :rows="shadowTradeRows"
            :limit="10"
            class="qg-ledger-table--important"
          />
        </div>

        <div class="qg-domain-grid qg-domain-grid--wide-tables">
          <LedgerTable
            title="未闭合入场线索"
            :rows="unclosedEntryRows"
            :limit="10"
            class="qg-ledger-table--important"
          />
          <LedgerTable
            :title="snapshot.secondaryEnabled ? '双账号历史交易记录（最近）' : '主账号历史交易记录（最近）'"
            :rows="closeHistoryRows"
            :limit="10"
            class="qg-ledger-table--important"
          />
          <LedgerTable
            :title="snapshot.secondaryEnabled ? '双账号交易流水（最近）' : '主账号交易流水（最近）'"
            :rows="tradeJournalRows"
            :limit="10"
            class="qg-ledger-table--important"
          />
        </div>
      </div>
    </details>

    <details class="qg-mt5-progressive">
      <summary>
        <span>运营记录与品种状态</span>
        <small>按需查看路线、待办、复盘与 USDJPY 状态</small>
      </summary>
      <div class="qg-mt5-progressive__content qg-mt5-operations-grid">
        <LedgerTable
          title="策略运行位置"
          :rows="routeModeRows"
          :limit="10"
          class="qg-ledger-table--mt5-focus"
        />
        <LedgerTable
          title="今日待办"
          :rows="todoRows"
          :limit="10"
          class="qg-ledger-table--mt5-focus qg-ledger-table--mt5-full"
        />
        <LedgerTable
          title="每日复盘"
          :rows="reviewRows"
          :limit="10"
          class="qg-ledger-table--mt5-focus qg-ledger-table--mt5-full"
        />
        <LedgerTable
          title="品种状态"
          :rows="symbolRows"
          :limit="10"
          class="qg-ledger-table--mt5-focus qg-ledger-table--mt5-full"
        />
      </div>
    </details>

    <details class="qg-raw-evidence" @toggle="revealTechnicalEvidence">
      <summary>技术证据</summary>
      <!-- Guard markers: Safety Envelope / Raw MT5 evidence. Visible copy stays Chinese and operator-facing. -->
      <div v-if="technicalEvidenceVisible" class="qg-domain-grid">
        <JsonPreview title="连接状态" source="/api/mt5-readonly/status" :payload="state.status" />
        <JsonPreview title="账户信息" source="/api/mt5-readonly/account" :payload="state.account" />
        <JsonPreview
          v-if="snapshot.secondaryEnabled"
          title="第二账号信息"
          source="/api/mt5-readonly-secondary/account"
          :payload="state.secondaryAccount"
        />
        <JsonPreview title="实时持仓" source="/api/mt5-readonly/positions" :payload="state.positions" />
        <JsonPreview title="挂单状态" source="/api/mt5-readonly/orders" :payload="state.orders" />
        <JsonPreview title="品种登记" source="/api/mt5-symbol-registry/symbols" :payload="state.symbols" />
        <JsonPreview title="MT5 快照" source="/api/mt5-readonly/snapshot" :payload="state.snapshot" />
        <JsonPreview
          v-if="snapshot.secondaryEnabled"
          title="第二 MT5 快照"
          source="/api/mt5-readonly-secondary/snapshot"
          :payload="state.secondarySnapshot"
        />
        <JsonPreview title="每日复盘" source="/api/daily-review" :payload="state.dailyReview" />
      </div>
    </details>
  </WorkspaceFrame>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, shallowReactive } from 'vue';
import { loadMt5Workspace, loadMt5WorkspaceCore } from '../../services/domainApi.js';
import LoadingState from '../../components/LoadingState.vue';
import WorkspaceFrame from '../shared/WorkspaceFrame.vue';
import MetricGrid from '../shared/MetricGrid.vue';
import JsonPreview from '../shared/JsonPreview.vue';
import KeyValueList from '../shared/KeyValueList.vue';
import LedgerTable from '../shared/LedgerTable.vue';
import EndpointHealthGrid from '../shared/EndpointHealthGrid.vue';
import StatusPill from '../shared/StatusPill.vue';
import {
  buildAccountItems,
  buildMt5AccountCards,
  buildMt5ConnectionItems,
  buildMt5CoreMetrics,
  buildMt5PrimaryAxisItems,
  buildMt5SnapshotRecoveryRows,
  buildMt5SnapshotRootCauseBanner,
  buildEndpointHealth,
  buildMt5ShadowBlockerRows,
  buildMt5ShadowEquityRows,
  buildMt5ShadowSummary,
  buildMt5ShadowTradeRows,
  buildOrderRows,
  buildPositionRows,
  buildCloseHistoryRows,
  buildUnclosedEntryRows,
  buildTradeJournalRows,
  buildMt5TodoRows,
  buildMt5ReviewRows,
  buildMt5RouteModeRows,
  buildMt5SimulationItems,
  buildMt5EvidenceOsLiteItems,
  buildMt5ExecutionFeedbackRows,
  buildRsiEntryDiagnosticRows,
  buildSafetyItems,
  buildSecondaryAccountItems,
  buildSymbolRows,
  buildUsdJpyLiveLoopItems,
  normalizeMt5Snapshot,
  resolveMt5ReadonlyConnectionSummary,
} from './mt5Model.js';
import { buildOperatorOverviewAxisItems, normalizeDashboardSnapshot } from '../dashboard/dashboardModel.js';

const KlineWorkspace = defineAsyncComponent({
  loader: () => import('../phase1/kline/KlineWorkspace.vue'),
  delay: 80,
  timeout: 30000,
});

const loading = ref(false);
const error = ref('');
const klineLoaded = ref(false);
const technicalEvidenceVisible = ref(false);
const state = shallowReactive({
  operatorOverview: null,
  status: null,
  account: null,
  secondaryAccount: null,
  positions: null,
  orders: null,
  symbols: null,
  snapshot: null,
  secondarySnapshot: null,
  latest: null,
  closeHistory: [],
  secondaryCloseHistory: [],
  tradeJournal: [],
  secondaryTradeJournal: [],
  dailyReview: null,
  researchStats: null,
  governanceAdvisor: null,
  shadowSignals: null,
  shadowOutcomes: null,
  shadowCandidates: null,
  shadowCandidateOutcomes: null,
  usdJpyLiveLoop: null,
  evidenceOS: null,
});

const snapshot = computed(() => normalizeMt5Snapshot(state));
const overviewSnapshot = computed(() =>
  normalizeDashboardSnapshot({ operatorOverview: state.operatorOverview }),
);
const canonicalOverview = computed(() =>
  overviewSnapshot.value.operatorOverviewState?.valid ? overviewSnapshot.value.operatorOverview : null,
);
const canonicalMt5 = computed(() => canonicalOverview.value?.mt5 || null);
const connectionSummary = computed(() =>
  resolveMt5ReadonlyConnectionSummary(snapshot.value, canonicalMt5.value),
);
const readonlyBannerStatus = computed(() => connectionSummary.value.bannerStatus);
const readonlyBannerLabel = computed(() => connectionSummary.value.bannerLabel);
const runtimeSummaryStatus = computed(() => connectionSummary.value.runtimeStatus);
const runtimeSummaryLabel = computed(() => connectionSummary.value.runtimeLabel);
const shadowSummary = computed(() => buildMt5ShadowSummary(snapshot.value));
const snapshotRootCause = computed(() => buildMt5SnapshotRootCauseBanner(snapshot.value));
const snapshotRecoveryRows = computed(() => buildMt5SnapshotRecoveryRows(snapshot.value));
const primaryAxisItems = computed(() => {
  if (!canonicalOverview.value) return buildMt5PrimaryAxisItems(snapshot.value);
  return buildOperatorOverviewAxisItems(overviewSnapshot.value).map((item) => {
    if (item.value === '连接状态未知' || item.value === '授权状态未知') {
      return {
        ...item,
        value: '待确认',
        status: 'warn',
        hint: '当前 writer 证据不足，不能据此断言账号掉线或失效。',
      };
    }
    return item;
  });
});
const coreMetrics = computed(() => buildMt5CoreMetrics(snapshot.value));
const endpointHealth = computed(() => buildEndpointHealth(state));
const safetyItems = computed(() => buildSafetyItems(snapshot.value));
const simulationItems = computed(() => buildMt5SimulationItems(snapshot.value));
const shadowMetrics = computed(() => shadowSummary.value.metrics);
const connectionItems = computed(() => buildMt5ConnectionItems(snapshot.value));
const mt5AccountCards = computed(() => buildMt5AccountCards(snapshot.value));
const accountItems = computed(() => buildAccountItems(snapshot.value));
const secondaryAccountItems = computed(() => buildSecondaryAccountItems(snapshot.value));
const positionRows = computed(() => buildPositionRows(snapshot.value));
const orderRows = computed(() => buildOrderRows(snapshot.value));
const symbolRows = computed(() => buildSymbolRows(snapshot.value));
const closeHistoryRows = computed(() => buildCloseHistoryRows(snapshot.value));
const unclosedEntryRows = computed(() => buildUnclosedEntryRows(snapshot.value));
const tradeJournalRows = computed(() => buildTradeJournalRows(snapshot.value));
const shadowEquityRows = computed(() => buildMt5ShadowEquityRows(snapshot.value));
const shadowTradeRows = computed(() => buildMt5ShadowTradeRows(snapshot.value));
const shadowBlockerRows = computed(() => buildMt5ShadowBlockerRows(snapshot.value));
const todoRows = computed(() => buildMt5TodoRows(snapshot.value));
const reviewRows = computed(() => buildMt5ReviewRows(snapshot.value));
const routeModeRows = computed(() => buildMt5RouteModeRows(snapshot.value));
const rsiEntryDiagnosticRows = computed(() => buildRsiEntryDiagnosticRows(snapshot.value));
const usdJpyLiveLoopItems = computed(() => buildUsdJpyLiveLoopItems(snapshot.value));
const evidenceOsLiteItems = computed(() => buildMt5EvidenceOsLiteItems(snapshot.value));
const executionFeedbackRows = computed(() => buildMt5ExecutionFeedbackRows(snapshot.value));
let refreshTimer = null;
let loadInFlight = false;
let loadController = null;
let loadRunId = 0;
let refreshQueued = false;
let disposed = false;
const MT5_REFRESH_MS = 60000;

function abortLoad() {
  loadController?.abort();
  loadController = null;
}

async function load(options = {}) {
  if (disposed) return;
  if (loadInFlight) {
    refreshQueued = true;
    return;
  }
  const runId = loadRunId + 1;
  loadRunId = runId;
  const controller = new globalThis.AbortController();
  loadController = controller;
  loadInFlight = true;
  if (!options.silent) loading.value = true;
  error.value = '';
  let coreLoaded = false;
  try {
    const coreState = await loadMt5WorkspaceCore({ signal: controller.signal });
    if (controller.signal.aborted || runId !== loadRunId) return;
    Object.assign(state, coreState);
    coreLoaded = true;
    if (!options.silent) loading.value = false;

    const nextState = await loadMt5Workspace({ signal: controller.signal });
    if (controller.signal.aborted || runId !== loadRunId) return;
    Object.assign(state, nextState);
  } catch (exc) {
    if (controller.signal.aborted || runId !== loadRunId) return;
    if (!coreLoaded) {
      error.value = exc?.message || 'MT5 只读证据加载失败';
    }
  } finally {
    if (runId === loadRunId) {
      loadInFlight = false;
      loadController = null;
      if (!options.silent) loading.value = false;
      const shouldRefreshAgain = refreshQueued && !disposed;
      refreshQueued = false;
      if (shouldRefreshAgain) {
        Promise.resolve().then(() => load({ silent: true }));
      }
    }
  }
}

function refreshWhenVisible() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  load({ silent: true });
}

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    refreshWhenVisible();
  }
}

function enableKline() {
  klineLoaded.value = true;
}

function revealTechnicalEvidence(event) {
  technicalEvidenceVisible.value = technicalEvidenceVisible.value || Boolean(event.target.open);
}

onMounted(() => {
  disposed = false;
  load();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  refreshTimer = window.setInterval(refreshWhenVisible, MT5_REFRESH_MS);
});

onUnmounted(() => {
  disposed = true;
  refreshQueued = false;
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  abortLoad();
});
</script>

<style scoped>
.qg-mt5-core-status {
  background: rgb(15 23 42 / 68%);
  box-shadow: none;
}

.qg-mt5-core-status > header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.qg-mt5-core-operations {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.qg-mt5-progressive {
  min-width: 0;
  padding: 10px 18px;
  background: rgb(15 23 42 / 52%);
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 16px;
}

.qg-mt5-progressive > summary,
.qg-raw-evidence > summary {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  color: var(--text);
  font-size: 15px;
  font-weight: 750;
  cursor: pointer;
}

.qg-mt5-progressive > summary small {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.qg-mt5-progressive > summary:focus-visible,
.qg-raw-evidence > summary:focus-visible,
.qg-button:focus-visible {
  outline: 3px solid rgb(56 189 248 / 72%);
  outline-offset: 3px;
}

.qg-mt5-progressive__content {
  display: grid;
  gap: 16px;
  padding-top: 14px;
}

.qg-mt5-progressive__content > .qg-section-card,
.qg-mt5-progressive__content > .qg-mt5-dual-accounts {
  background: rgb(15 23 42 / 62%);
  box-shadow: none;
}

@media (width <= 1080px) {
  .qg-mt5-core-operations {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qg-mt5-core-operations > :last-child {
    grid-column: 1 / -1;
  }
}

@media (width <= 720px) {
  .qg-mt5-core-status > header,
  .qg-mt5-progressive > summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .qg-mt5-core-operations {
    grid-template-columns: minmax(0, 1fr);
  }

  .qg-mt5-core-operations > :last-child {
    grid-column: auto;
  }
}
</style>
