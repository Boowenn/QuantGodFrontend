<template>
  <WorkspaceFrame
    eyebrow="全局总览"
    title="今日运营总览"
    description="先看连接、阻断和下一步；账户、策略与原始证据按需展开。全程保持 Shadow / ReadOnly。"
    :loading="loading"
    :error="error"
    @refresh="load"
  >
    <section class="qg-snapshot-root-cause" :class="`qg-snapshot-root-cause--${snapshotRootCause.status}`">
      <div class="qg-snapshot-root-cause__main">
        <!-- 全局快照根因由 Operator Overview 统一计算。 -->
        <p class="qg-eyebrow">系统结论</p>
        <h2>{{ snapshotRootCause.title }}</h2>
        <p>{{ snapshotRootCause.rootCauseLine }}</p>
      </div>
      <StatusPill :status="snapshotRootCause.status" :label="snapshotRootCause.label" />
      <div class="qg-snapshot-root-cause__grid">
        <span>
          <strong>当前受限范围</strong>
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
          <strong>修复入口</strong>
          {{ snapshotRootCause.recoveryPathLine }}
        </span>
        <span>
          <strong>下一步</strong>
          {{ snapshotRootCause.nextAction }}
        </span>
      </div>
    </section>

    <section class="qg-domain-panel qg-domain-panel--primary qg-overview-panel">
      <div class="qg-domain-panel__header">
        <div>
          <p class="qg-eyebrow">核心状态</p>
          <h2>连接与只读就绪</h2>
        </div>
        <StatusPill :status="snapshotRootCause.status" :label="snapshotRootCause.label || '核心状态不可用'" />
      </div>
      <div class="qg-overview-core-grid">
        <div>
          <p class="qg-section-label">MT5 六轴</p>
          <KeyValueList :items="operatorOverviewAxisItems" />
        </div>
        <div>
          <p class="qg-section-label">研究门禁与运行阻断</p>
          <LedgerTable title="门禁与阻断" :rows="operatorOverviewBlockerRows" :limit="3" />
        </div>
      </div>
      <details v-if="operatorOverviewSupportItems.length" class="qg-overview-support">
        <summary>查看数据、自动化、生产证据与磁盘状态</summary>
        <KeyValueList :items="operatorOverviewSupportItems" />
      </details>
    </section>

    <MetricGrid :items="metrics" />

    <details class="qg-domain-panel qg-domain-panel--details qg-progressive-group">
      <summary>
        <span>账户与数据诊断</span>
        <small>接口、快照可信度与页面影响</small>
      </summary>
      <div class="qg-progressive-group__content">
        <EndpointHealthGrid :items="endpointHealth" />

        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">实时快照恢复</p>
              <h2>当前账号数据是否可信</h2>
            </div>
            <StatusPill :status="snapshot.snapshotRecovery.status" :label="snapshot.snapshotRecovery.label" />
          </div>
          <div class="qg-domain-grid qg-domain-grid--two">
            <KeyValueList :items="snapshotRecoveryItems" />
            <LedgerTable title="影响范围" :rows="snapshotRecoveryRows" :limit="5" />
          </div>
        </section>

        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">整体前端诊断</p>
              <h2>快照和账号桥影响哪些页面</h2>
            </div>
            <span class="qg-muted">区分当前账号状态、研究证据和后端执行闸门</span>
          </div>
          <LedgerTable title="整体前端修复优先级" :rows="frontendSnapshotRecoveryRows" :limit="8" />
          <LedgerTable
            v-if="coreEvidenceRecoveryRows.length"
            title="核心证据恢复队列"
            :rows="coreEvidenceRecoveryRows"
            :limit="10"
          />
        </section>

        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">数据源诊断</p>
              <h2>运行快照恢复优先级</h2>
            </div>
            <span class="qg-muted">只核对 USDJPY MT5 主账号与外汇部署账号</span>
          </div>
          <LedgerTable title="运行数据源" :rows="runtimeSourceRows" :limit="6" />
        </section>
      </div>
    </details>

    <details class="qg-domain-panel qg-domain-panel--details qg-progressive-group">
      <summary>
        <span>策略改进与风险建议</span>
        <small>按需查看治理、升级与执行边界</small>
      </summary>
      <div class="qg-progressive-group__content">
        <DashboardUpgradePanel :state="state" :snapshot="snapshot" :metrics="metrics" />
      </div>
    </details>

    <details class="qg-domain-panel qg-domain-panel--details qg-progressive-group">
      <summary>
        <span>自动化、通知与每日复盘</span>
        <small>按需查看后台链路和运营记录</small>
      </summary>
      <div class="qg-progressive-group__content">
        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">Agent 自动化健康</p>
              <h2>日报、策略复核与 Telegram 投递</h2>
            </div>
            <StatusPill
              :status="agentOpsEvidence.status"
              :label="agentOpsEvidence.label || '等待 Agent 健康检查'"
            />
          </div>
          <div class="qg-domain-grid qg-domain-grid--two">
            <KeyValueList :items="agentOpsItems" />
            <LedgerTable title="自动化检查" :rows="agentOpsRows" :limit="6" />
          </div>
        </section>

        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">Telegram Gateway</p>
              <h2>后台自动推送健康</h2>
            </div>
            <StatusPill :status="telegramGatewayStatus" :label="telegramGatewayStatusLabel" />
          </div>
          <KeyValueList :items="telegramGatewayItems" />
        </section>

        <section class="qg-domain-panel qg-domain-panel--primary">
          <div class="qg-domain-panel__header">
            <div>
              <p class="qg-eyebrow">每日闭环</p>
              <h2>今日待办与每日复盘</h2>
            </div>
            <span class="qg-muted">USDJPY MT5 + GA + Agent 日报 v2 只读闭环</span>
          </div>
          <div class="qg-domain-grid qg-domain-grid--two">
            <LedgerTable title="今日待办" :rows="todoRows" :limit="10" />
            <LedgerTable title="每日复盘" :rows="reviewRows" :limit="10" />
          </div>
        </section>

        <div class="qg-dashboard-grid">
          <section class="qg-domain-panel qg-domain-panel--primary">
            <div class="qg-domain-panel__header">
              <div>
                <p class="qg-eyebrow">运行健康</p>
                <h2>本地运行健康</h2>
              </div>
              <StatusPill :status="snapshot.killSwitchStatus" :label="snapshot.killSwitchLabel" />
            </div>
            <KeyValueList :items="runtimeItems" />
          </section>

          <section class="qg-domain-panel">
            <div class="qg-domain-panel__header">
              <div>
                <p class="qg-eyebrow">每日闭环</p>
                <h2>日报、自动处理与回测摘要</h2>
              </div>
            </div>
            <KeyValueList :items="dailyItems" />
          </section>
        </div>
      </div>
    </details>

    <details class="qg-domain-panel qg-domain-panel--details qg-progressive-group">
      <summary>
        <span>策略观察路线</span>
        <small>最多 8 条，只读查看评分与备注</small>
      </summary>
      <div class="qg-progressive-group__content">
        <div v-if="routeRows.length" class="qg-route-table-wrap">
          <table class="qg-route-table">
            <thead>
              <tr>
                <th scope="col">路线</th>
                <th scope="col">状态</th>
                <th scope="col">评分</th>
                <th scope="col">备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in routeRows" :key="row.id">
                <td>{{ row.route }}</td>
                <td><StatusPill :status="row.status" :label="row.status" /></td>
                <td>{{ row.score }}</td>
                <td>{{ row.note || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="qg-empty-text">当前没有路线观察列表；需要时可展开技术证据查看原始数据。</p>
      </div>
    </details>

    <section class="qg-domain-panel qg-dashboard-fast-lanes">
      <div class="qg-domain-panel__header">
        <div>
          <p class="qg-eyebrow">核心工作区</p>
          <h2>按需打开重证据页面</h2>
        </div>
        <span class="qg-muted">总览页保持轻量，避免重复加载 GA / 回放 / K线证据。</span>
      </div>
      <div class="qg-dashboard-fast-lanes__grid">
        <a class="qg-dashboard-fast-lanes__card" href="/vue/?workspace=mt5">
          <span>账户与行情</span>
          <strong>只读账户、行情与图表</strong>
          <small>查看连接、持仓、挂单和行情证据。</small>
        </a>
        <a class="qg-dashboard-fast-lanes__card" href="/vue/?workspace=evolution">
          <span>策略研究</span>
          <strong>回测与参数优化</strong>
          <small>查看策略候选、回放结果和研究证据。</small>
        </a>
      </div>
    </section>
    <details class="qg-domain-panel qg-domain-panel--details" @toggle="revealAutomationPanel">
      <summary>自动化链路详情</summary>
      <Suspense v-if="automationPanelVisible">
        <AutomationChainPanel class="qg-dashboard-automation-chain" />
        <template #fallback>
          <LoadingState title="正在加载自动化链路" description="正在按需打开恢复状态证据。" />
        </template>
      </Suspense>
    </details>

    <details class="qg-domain-panel qg-domain-panel--details" @toggle="revealTechnicalEvidence">
      <summary>原始技术证据</summary>
      <div v-if="technicalEvidenceVisible" class="qg-domain-grid qg-domain-grid--compact">
        <JsonPreview title="统一运营总览" source="/api/operator/overview" :payload="state.operatorOverview" />
        <JsonPreview title="最新运行状态" source="/api/latest" :payload="state.latest" />
        <JsonPreview title="总览状态" source="/api/dashboard/state" :payload="state.state" />
        <JsonPreview title="回测摘要" source="/api/dashboard/backtest-summary" :payload="state.backtest" />
        <JsonPreview title="每日复盘" source="/api/daily-review" :payload="state.dailyReview" />
        <JsonPreview
          title="USDJPY Shadow Advisory（兼容 Live Loop）"
          source="/api/usdjpy-strategy-lab/live-loop"
          :payload="state.usdJpyLiveLoop"
        />
        <JsonPreview
          title="Agent 日报 v2"
          source="/api/usdjpy-strategy-lab/autonomous-agent/daily-autopilot-v2"
          :payload="state.dailyAutopilotV2"
        />
        <JsonPreview
          title="Agent 自动化健康"
          source="/api/usdjpy-strategy-lab/agent-ops-health/status"
          :payload="state.agentOpsHealth"
        />
        <JsonPreview
          title="Telegram Gateway"
          source="/api/usdjpy-strategy-lab/telegram-gateway/status"
          :payload="state.telegramGateway"
        />
        <JsonPreview
          title="生产证据验证"
          source="/api/production-evidence-validation/status"
          :payload="state.productionEvidenceValidation"
        />
        <JsonPreview title="MT5 快照" source="/api/mt5-readonly/snapshot" :payload="state.mt5Snapshot" />
        <JsonPreview
          title="第二 MT5 快照"
          source="/api/mt5-readonly-secondary/snapshot"
          :payload="state.secondaryMt5Snapshot"
        />
        <JsonPreview
          title="外币 Live12 历史交接字段（已退役 / 只读）"
          source="/api/live-automation/forex-live12-runtime-handoff?scope=secondary"
          :payload="state.forexLive12RuntimeHandoff"
        />
        <JsonPreview
          title="外币 Live12 历史扩仓评审（已退役 / 只读）"
          source="/api/live-automation/forex-live12-capacity-expansion-review?scope=secondary"
          :payload="state.forexLive12CapacityExpansionReview"
        />
        <JsonPreview
          title="外币 Live12 历史扩仓路线（已退役 / 只读）"
          source="/api/live-automation/forex-live12-capacity-expansion-roadmap?scope=secondary"
          :payload="state.forexLive12CapacityExpansionRoadmap"
        />
        <JsonPreview
          title="外币 Live12 历史微仓评审（已退役 / 只读）"
          source="/api/live-automation/forex-live12-micro-expansion-review?scope=secondary"
          :payload="state.forexLive12MicroExpansionReview"
        />
        <JsonPreview
          title="外币 Live12 RSI Shadow 修复计划"
          source="/api/live-automation/forex-live12-rsi-repair-plan?scope=secondary"
          :payload="state.forexLive12RsiRepairPlan"
        />
        <JsonPreview
          title="外币 Live12 RSI 影子候选"
          source="/api/live-automation/forex-live12-rsi-shadow-candidate?scope=secondary"
          :payload="state.forexLive12RsiShadowCandidate"
        />
        <JsonPreview
          title="外币 Live12 RSI Tester 请求"
          source="/api/live-automation/forex-live12-rsi-tester-request?scope=secondary"
          :payload="state.forexLive12RsiTesterRequest"
        />
        <JsonPreview
          title="外币 Live12 RSI Tester 启动闸门"
          source="/api/live-automation/forex-live12-rsi-tester-run-gate?scope=secondary"
          :payload="state.forexLive12RsiTesterRunGate"
        />
        <JsonPreview
          title="外币 Live12 RSI Shadow 研究晋级闸门"
          source="/api/live-automation/forex-live12-rsi-candidate-promotion-gate?scope=secondary"
          :payload="state.forexLive12RsiCandidatePromotionGate"
        />
        <JsonPreview
          title="外币 Live12 RSI Tester Lock 草案"
          source="/api/live-automation/forex-live12-rsi-tester-lock-draft?scope=secondary"
          :payload="state.forexLive12RsiTesterLockDraft"
        />
      </div>
    </details>
  </WorkspaceFrame>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowReactive } from 'vue';
import { loadDashboardWorkspace, loadDashboardWorkspaceCore } from '../../services/domainApi.js';
import WorkspaceFrame from '../shared/WorkspaceFrame.vue';
import MetricGrid from '../shared/MetricGrid.vue';
import JsonPreview from '../shared/JsonPreview.vue';
import StatusPill from '../shared/StatusPill.vue';
import KeyValueList from '../shared/KeyValueList.vue';
import EndpointHealthGrid from '../shared/EndpointHealthGrid.vue';
import LedgerTable from '../shared/LedgerTable.vue';
import LoadingState from '../../components/LoadingState.vue';
import DashboardUpgradePanel from './DashboardUpgradePanel.vue';
import {
  normalizeDashboardSnapshot,
  buildOperatorOverviewAxisItems,
  buildOperatorOverviewBlockerRows,
  buildOperatorOverviewSupportItems,
  buildDashboardMetrics,
  buildEndpointHealth,
  buildRuntimeSourceDiagnosticRows,
  buildSnapshotRootCauseBanner,
  buildSnapshotRecoveryItems,
  buildSnapshotRecoveryRows,
  buildFrontendSnapshotRecoveryRows,
  buildCoreEvidenceRecoveryRows,
  buildRuntimeItems,
  buildDailyItems,
  buildAgentOpsItems,
  buildAgentOpsRows,
  buildTelegramGatewayItems,
  telegramGatewayStatus as resolveTelegramGatewayStatus,
  telegramGatewayStatusLabel as resolveTelegramGatewayStatusLabel,
  buildRouteRows,
  buildDailyTodoRows,
  buildDailyReviewRows,
  resolveDashboardEvidenceState,
} from './dashboardModel.js';

const AutomationChainPanel = defineAsyncComponent(() => import('../../components/AutomationChainPanel.vue'));

const loading = ref(false);
const error = ref('');
const technicalEvidenceVisible = ref(false);
const automationPanelVisible = ref(false);
const state = shallowReactive({
  operatorOverview: null,
  latest: null,
  state: null,
  backtest: null,
  dailyReview: null,
  usdJpyLiveLoop: null,
  dailyAutopilotV2: null,
  agentOpsHealth: null,
  telegramGateway: null,
  productionEvidenceValidation: null,
  mt5Snapshot: null,
  secondaryMt5Snapshot: null,
  forexLive12RuntimeHandoff: null,
  forexLive12CapacityExpansionReview: null,
  forexLive12CapacityExpansionRoadmap: null,
  forexLive12MicroExpansionReview: null,
  forexLive12RsiRepairPlan: null,
  forexLive12RsiShadowCandidate: null,
  forexLive12RsiTesterRequest: null,
  forexLive12RsiTesterRunGate: null,
  forexLive12RsiCandidatePromotionGate: null,
  forexLive12RsiTesterLockDraft: null,
});

const snapshot = computed(() => normalizeDashboardSnapshot(state));
const operatorOverviewAxisItems = computed(() => buildOperatorOverviewAxisItems(snapshot.value));
const operatorOverviewBlockerRows = computed(() => buildOperatorOverviewBlockerRows(snapshot.value));
const operatorOverviewSupportItems = computed(() => buildOperatorOverviewSupportItems(snapshot.value));
const metrics = computed(() => buildDashboardMetrics(snapshot.value));
const endpointHealth = computed(() => buildEndpointHealth(state));
const runtimeSourceRows = computed(() => buildRuntimeSourceDiagnosticRows(state));
const snapshotRootCause = computed(() => buildSnapshotRootCauseBanner(snapshot.value));
const snapshotRecoveryItems = computed(() => buildSnapshotRecoveryItems(snapshot.value));
const snapshotRecoveryRows = computed(() => buildSnapshotRecoveryRows(snapshot.value));
const frontendSnapshotRecoveryRows = computed(() => buildFrontendSnapshotRecoveryRows(snapshot.value));
const coreEvidenceRecoveryRows = computed(() => buildCoreEvidenceRecoveryRows(snapshot.value));
const runtimeItems = computed(() => buildRuntimeItems(snapshot.value));
const dailyItems = computed(() => buildDailyItems(snapshot.value));
const agentOpsItems = computed(() => buildAgentOpsItems(state));
const agentOpsRows = computed(() => buildAgentOpsRows(state));
const telegramGatewayItems = computed(() => buildTelegramGatewayItems(state));
const telegramGatewayStatus = computed(() => resolveTelegramGatewayStatus(state));
const telegramGatewayStatusLabel = computed(() => resolveTelegramGatewayStatusLabel(state));
const agentOpsEvidence = computed(() => resolveDashboardEvidenceState(state.agentOpsHealth));
const routeRows = computed(() => buildRouteRows(snapshot.value));
const todoRows = computed(() => buildDailyTodoRows(state));
const reviewRows = computed(() => buildDailyReviewRows(state));
let loadController = null;
let loadRunId = 0;

function abortLoad() {
  loadController?.abort();
  loadController = null;
}

async function load() {
  abortLoad();
  const runId = loadRunId + 1;
  loadRunId = runId;
  const controller = new globalThis.AbortController();
  loadController = controller;
  loading.value = true;
  error.value = '';
  let coreLoaded = false;
  try {
    const coreState = await loadDashboardWorkspaceCore({ signal: controller.signal });
    if (controller.signal.aborted || runId !== loadRunId) return;
    Object.assign(state, coreState);
    coreLoaded = true;
    loading.value = false;

    const nextState = await loadDashboardWorkspace({ signal: controller.signal });
    if (controller.signal.aborted || runId !== loadRunId) return;
    Object.assign(state, nextState);
  } catch (exc) {
    if (controller.signal.aborted || runId !== loadRunId) return;
    if (!coreLoaded) {
      error.value = exc?.message || '全局总览加载失败';
    }
  } finally {
    if (runId === loadRunId) {
      loading.value = false;
      loadController = null;
    }
  }
}

function revealTechnicalEvidence(event) {
  technicalEvidenceVisible.value = technicalEvidenceVisible.value || Boolean(event.target.open);
}

function revealAutomationPanel(event) {
  automationPanelVisible.value = automationPanelVisible.value || Boolean(event.target.open);
}

onMounted(load);
onBeforeUnmount(abortLoad);
</script>

<style scoped>
.qg-overview-panel {
  background: rgb(15 23 42 / 68%);
}

.qg-overview-core-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.1fr);
  gap: 24px;
  align-items: start;
}

.qg-section-label {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
}

.qg-overview-support {
  margin-top: 18px;
  border-top: 1px solid rgb(148 163 184 / 16%);
}

.qg-overview-support summary,
.qg-progressive-group > summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
}

.qg-overview-support summary {
  padding: 10px 0 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
}

.qg-overview-support summary:focus-visible,
.qg-progressive-group > summary:focus-visible,
.qg-dashboard-fast-lanes__card:focus-visible {
  outline: 3px solid rgb(56 189 248 / 72%);
  outline-offset: 3px;
}

.qg-progressive-group {
  padding-block: 10px;
  background: rgb(15 23 42 / 52%);
  box-shadow: none;
}

.qg-progressive-group > summary {
  justify-content: space-between;
  gap: 16px;
  padding: 0 6px;
  color: var(--text);
  font-size: 15px;
}

.qg-progressive-group > summary small {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.qg-progressive-group__content {
  display: grid;
  gap: 16px;
  padding-top: 14px;
}

.qg-progressive-group__content > .qg-domain-panel {
  background: rgb(15 23 42 / 62%);
  box-shadow: none;
}

.qg-snapshot-root-cause {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 18px;
  border: 1px solid rgb(255 184 77 / 28%);
  border-radius: 8px;
  background: linear-gradient(135deg, rgb(255 184 77 / 13%), rgb(15 23 42 / 82%));
}

.qg-snapshot-root-cause--ok {
  border-color: rgb(51 217 154 / 28%);
  background: linear-gradient(135deg, rgb(51 217 154 / 10%), rgb(15 23 42 / 82%));
}

.qg-snapshot-root-cause--blocked {
  border-color: rgb(255 107 134 / 34%);
  background: linear-gradient(135deg, rgb(255 107 134 / 12%), rgb(15 23 42 / 82%));
}

.qg-snapshot-root-cause__main {
  min-width: 0;
}

.qg-snapshot-root-cause__main h2 {
  font-size: 1.15rem;
}

.qg-snapshot-root-cause__main p:last-child {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.qg-snapshot-root-cause__grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.qg-snapshot-root-cause__grid span {
  min-width: 0;
  padding: 10px 12px;
  color: var(--muted);
  line-height: 1.42;
  background: rgb(255 255 255 / 3.5%);
  border: 1px solid rgb(129 151 178 / 18%);
  border-radius: 8px;
}

.qg-snapshot-root-cause__grid strong {
  display: block;
  margin-bottom: 4px;
  color: var(--text);
  font-size: 0.78rem;
}

.qg-dashboard-fast-lanes__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.qg-dashboard-fast-lanes__card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgb(91 161 255 / 26%);
  border-radius: 14px;
  color: inherit;
  text-decoration: none;
  background: rgb(9 20 38 / 66%);
}

.qg-dashboard-fast-lanes__card:hover {
  border-color: rgb(86 190 255 / 58%);
  background: rgb(12 35 62 / 78%);
}

.qg-dashboard-fast-lanes__card span,
.qg-dashboard-fast-lanes__card small {
  color: var(--qg-muted);
}

.qg-dashboard-fast-lanes__card strong {
  overflow-wrap: anywhere;
  color: var(--qg-text);
}

@media (width <= 720px) {
  .qg-snapshot-root-cause,
  .qg-snapshot-root-cause__grid,
  .qg-overview-core-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .qg-progressive-group > summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
    padding-block: 8px;
  }
}
</style>
