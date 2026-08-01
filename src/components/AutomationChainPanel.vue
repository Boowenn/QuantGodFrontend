<template>
  <section class="qg-automation-chain-panel" aria-label="自动化链路状态">
    <header class="qg-automation-chain-panel__header">
      <div>
        <p class="qg-automation-chain-panel__eyebrow">USDJPY Shadow / ReadOnly</p>
        <h2>USDJPY 只读守门证据</h2>
        <p class="qg-automation-chain-panel__subtitle">
          读取 USDJPY 策略政策与 EA 影子观察证据；这里只生成建议，不存在自动执行通道。
        </p>
      </div>
      <div class="qg-automation-chain-panel__actions">
        <button type="button" @click="loadStatus" :disabled="loading">Agent 刷新证据</button>
        <button type="button" class="primary" @click="runOnce" :disabled="running">Agent 生成只读证据</button>
      </div>
    </header>

    <div
      v-if="actionStatus"
      class="qg-automation-chain-panel__action-result"
      :class="`qg-automation-chain-panel__action-result--${actionStatus.kind}`"
      role="status"
    >
      <div>
        <strong>{{ actionStatus.title }}</strong>
        <span>{{ actionStatus.time }}</span>
      </div>
      <p>{{ actionStatus.summary }}</p>
    </div>

    <div v-if="error" class="qg-automation-chain-panel__error">{{ error }}</div>
    <div v-else-if="loading" class="qg-automation-chain-panel__loading">正在读取自动化链路状态...</div>
    <template v-else>
      <div class="qg-automation-chain-panel__summary">
        <div>
          <span>结论</span>
          <strong :class="stateClass">{{ advisoryStateLabel }}</strong>
        </div>
        <div>
          <span>标准信号</span>
          <strong>{{ payload.standardCount || 0 }}</strong>
        </div>
        <div>
          <span>机会信号</span>
          <strong>{{ payload.opportunityCount || 0 }}</strong>
        </div>
        <div>
          <span>阻断</span>
          <strong>{{ payload.blockedCount || 0 }}</strong>
        </div>
        <div>
          <span>证据完整度</span>
          <strong :class="entryReadinessTone">{{ entryReadinessScoreLabel }}</strong>
        </div>
      </div>

      <div class="qg-automation-chain-panel__truth">
        <article>
          <span>主状态来源</span>
          <strong>{{ payload.singleSourceOfTruth || 'USDJPY_LIVE_LOOP' }}</strong>
          <small>页面、Telegram 和 EA 影子观察统一读取 Shadow Advisory（兼容 Live Loop）</small>
        </article>
        <article>
          <span>Shadow 候选</span>
          <strong>{{ livePolicyLabel }}</strong>
          <small>候选路线以后端证据为准；缺失时保持阻断</small>
        </article>
        <article>
          <span>影子第一名</span>
          <strong>{{ shadowPolicyLabel }}</strong>
          <small>影子研究只用于观察，不会触发执行</small>
        </article>
        <article>
          <span>EA 影子观察</span>
          <strong>{{ dryRunLabel }}</strong>
          <small>只验证政策读取并生成建议，不会触发 broker mutation</small>
        </article>
        <article>
          <span>信号延迟</span>
          <strong>{{ entryLatencyLabel }}</strong>
          <small>{{ entryLatencyNextAction || entryLatencyReason }}</small>
        </article>
        <article>
          <span>首个缺口</span>
          <strong :class="entryReadinessTone">{{ firstReadinessGapLabel }}</strong>
          <small>{{ firstReadinessGapAction }}</small>
        </article>
        <article>
          <span>GA 精英</span>
          <strong>{{ bestGaEliteLabel }}</strong>
          <small>{{ gaFactoryMeta }}</small>
        </article>
      </div>

      <div class="qg-automation-chain-panel__grid">
        <article>
          <h3>安全迭代计划</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in safeIterationActions" :key="item.actionId || item.labelZh">
              <span class="warn">{{ item.labelZh || item.actionId }}</span>
              {{ item.nextRequiredActionZh || item.reasonZh || '' }}
              <small>{{ iterationEvidenceText(item) }}</small>
            </li>
            <li v-if="!safeIterationActions.length">暂无新的安全迭代动作</li>
          </ul>
        </article>
        <article>
          <h3>就绪缺口</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in failedReadinessGaps" :key="item.gapId || item.stage">
              <span class="bad">{{ item.labelZh || item.gapId }}</span>
              {{ gapCurrentText(item) }}
              <small>{{ item.nextRequiredActionZh || '' }}</small>
            </li>
            <li v-if="!failedReadinessGaps.length">暂无未通过缺口</li>
          </ul>
        </article>
        <article>
          <h3>恢复动作</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in entryLatencyRecoveryActions" :key="item.actionId || item.stage">
              <span class="warn">{{ item.labelZh || item.actionId }}</span>
              {{ item.nextRequiredActionZh || item.reasonZh || '' }}
              <small>{{ recoveryEvidenceText(item) }}</small>
            </li>
            <li v-if="!entryLatencyRecoveryActions.length">暂无恢复动作</li>
          </ul>
        </article>
        <article>
          <h3>信号评估时间线</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in entryLatencyTimeline" :key="item.stage || item.labelZh">
              <span :class="latencyTone(item)">{{ item.statusZh || item.status }}</span>
              {{ item.labelZh || item.stage }}
              <small>{{ item.reasonZh || '' }}</small>
            </li>
            <li v-if="!entryLatencyTimeline.length">暂无信号延迟归因</li>
          </ul>
        </article>
        <article>
          <h3>技术链路详情</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="step in steps" :key="step.name">
              <span :class="step.ok ? 'ok' : 'bad'">{{ step.ok ? '通过' : '未通过' }}</span>
              {{ cleanStepLabel(step.labelZh || step.name) }}
              <small>{{ step.summaryZh || step.reason || '' }}</small>
            </li>
          </ul>
        </article>
        <article>
          <h3>缺失证据</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in missingEvidence" :key="item">{{ item }}</li>
            <li v-if="!missingEvidence.length">暂无缺失证据</li>
          </ul>
        </article>
        <article>
          <h3>阻断原因</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in blockedReasons" :key="item">{{ item }}</li>
            <li v-if="!blockedReasons.length">暂无阻断原因</li>
          </ul>
        </article>
        <article>
          <h3>机会信号（只读）</h3>
          <ul class="qg-automation-chain-panel__plain-list">
            <li v-for="item in opportunities" :key="`${item.symbol}-${item.direction}`">
              {{ item.symbol }}｜{{ item.directionZh || item.direction }}｜{{
                item.entryModeZh || item.entryMode
              }}｜建议仓位 {{ item.recommendedLot || 0 }}
            </li>
            <li v-if="!opportunities.length">暂无机会信号</li>
          </ul>
        </article>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchAutomationChainStatus, runAutomationChain } from '../services/automationChainApi.js';

const loading = ref(false);
const running = ref(false);
const error = ref('');
const payload = ref({});
const actionStatus = ref(null);

const steps = computed(() => payload.value.steps || []);
const missingEvidence = computed(() => payload.value.missingEvidence || []);
const blockedReasons = computed(() => payload.value.blockedReasons || []);
const opportunities = computed(() => payload.value.policySummary?.opportunities || []);
const topAdvisory = computed(
  () =>
    payload.value.topAdvisoryPolicy ||
    payload.value.topShadowPolicy ||
    payload.value.liveLoopStatus?.topAdvisoryPolicy ||
    payload.value.liveLoopStatus?.topShadowPolicy ||
    payload.value.topLiveEligiblePolicy ||
    payload.value.liveLoopStatus?.topLiveEligiblePolicy ||
    {},
);
const topShadow = computed(
  () => payload.value.topShadowPolicy || payload.value.liveLoopStatus?.topShadowPolicy || {},
);
const dryRun = computed(() => payload.value.dryRunDecision || payload.value.liveLoopStatus?.dryRun || {});
const entryLatency = computed(() => payload.value.entryLatencyReport || {});
const safeIterationPlan = computed(() => payload.value.safeIterationPlan || {});
const safeIterationActions = computed(() => safeIterationPlan.value.actions || []);
const gaFactorySummary = computed(
  () => payload.value.gaFactorySummary || safeIterationPlan.value.gaFactorySummary || {},
);
const bestGaElite = computed(() => gaFactorySummary.value.bestElite || {});
const entryLatencySummary = computed(
  () => payload.value.entryLatencySummary || entryLatency.value.summary || {},
);
const entryLatencyTimeline = computed(
  () => payload.value.entryLatencyTimeline || entryLatency.value.timeline || [],
);
const entryLatencyRecoveryActions = computed(() => entryLatency.value.recoveryActions || []);
const entryReadiness = computed(() => entryLatency.value.entryReadiness || {});
const entryReadinessGaps = computed(() => entryLatency.value.readinessGaps || []);
const failedReadinessGaps = computed(() =>
  entryReadinessGaps.value.filter((item) => item && item.essential !== false && !item.passed).slice(0, 6),
);
const entryLatencyNextAction = computed(
  () => entryLatency.value.nextRequiredActionZh || entryLatencySummary.value.nextRequiredActionZh || '',
);
const entryReadinessScore = computed(
  () => entryLatencySummary.value.readinessScore ?? entryReadiness.value.score,
);
const entryReadinessScoreLabel = computed(() => {
  const score = Number(entryReadinessScore.value);
  if (!Number.isFinite(score)) return '暂无';
  return `${Math.round(score)}%`;
});
const entryReadinessTone = computed(() => {
  if (entryReadiness.value.readyForEntryReview || entryLatencySummary.value.readyForEntryReview)
    return 'good';
  const score = Number(entryReadinessScore.value);
  if (Number.isFinite(score) && score >= 70) return 'warn';
  return 'bad';
});
const firstReadinessGap = computed(() => failedReadinessGaps.value[0] || {});
const firstReadinessGapLabel = computed(
  () => firstReadinessGap.value.labelZh || entryReadiness.value.firstFailedLabelZh || '暂无缺口',
);
const firstReadinessGapAction = computed(
  () =>
    firstReadinessGap.value.nextRequiredActionZh ||
    entryReadiness.value.nextRequiredActionZh ||
    '等待下一次自动化链路刷新。',
);
const bestGaEliteLabel = computed(() => {
  const elite = bestGaElite.value || {};
  if (!elite.seedId) return '暂无 elite';
  const fitness = Number(elite.fitness);
  const fitnessText = Number.isFinite(fitness) ? fitness.toFixed(2) : '暂无';
  return `${elite.seedId}｜${fitnessText}`;
});
const gaFactoryMeta = computed(() => {
  const summary = gaFactorySummary.value || {};
  const next = summary.nextGeneration || {};
  const generation = summary.currentGeneration ?? '暂无';
  const stage = bestGaElite.value.promotionStage || 'SHADOW';
  const nextGen = next.targetGeneration ? `｜下一代 ${next.targetGeneration}` : '';
  return `第 ${generation} 代｜${stage}${nextGen}`;
});
const livePolicyLabel = computed(() => {
  const item = topAdvisory.value || {};
  if (!item.strategy) return '暂无 Shadow 候选';
  return `${item.strategy}｜${directionZh(item.direction)}｜${entryModeZh(item.entryMode)}`;
});
const shadowPolicyLabel = computed(() => {
  const item = topShadow.value || {};
  if (!item.strategy) return '暂无影子候选';
  return `${item.strategy}｜${directionZh(item.direction)}｜${entryModeZh(item.entryMode)}`;
});
const dryRunLabel = computed(() => {
  const item = dryRun.value || {};
  return item.decision || '暂无影子观察结果';
});
const entryLatencyLabel = computed(
  () => entryLatencySummary.value.stateZh || entryLatencySummary.value.primaryStage || '暂无归因',
);
const entryLatencyReason = computed(
  () => entryLatencySummary.value.primaryReasonZh || '等待下一次自动化链路生成归因。',
);
const stateClass = computed(() => {
  const state = String(payload.value.state || '');
  if (state.includes('READY')) return 'warn';
  if (state.includes('BLOCKED')) return 'bad';
  return 'warn';
});
const advisoryStateLabel = computed(() => {
  const state = String(payload.value.state || '').toUpperCase();
  if (state === 'SHADOW_ADVISORY_READY') return '影子建议已就绪';
  if (state === 'READY_FOR_EXISTING_EA') return '影子建议已就绪（旧契约）';
  return payload.value.stateZh || payload.value.state || '未知';
});

function unwrap(response) {
  if (response?._api?.ok === false || response?.endpointLoadFailed === true) {
    throw new Error(
      response?.statusZh ||
        response?.error ||
        response?.message ||
        response?._api?.error?.message ||
        '自动化链路响应未确认成功',
    );
  }
  return response?.payload || response || {};
}

function directionZh(value) {
  const text = String(value || '').toUpperCase();
  if (text === 'LONG' || text === 'BUY') return '买入观察';
  if (text === 'SHORT' || text === 'SELL') return '卖出观察';
  return '方向待确认';
}

function entryModeZh(value) {
  return (
    {
      STANDARD_ENTRY: '标准信号',
      OPPORTUNITY_ENTRY: '机会信号',
      BLOCKED: '阻断',
    }[String(value || '')] || '状态待确认'
  );
}

function cleanStepLabel(value) {
  const text = String(value || '').trim();
  return (
    text
      .replace(/^P3-\d+\s*/i, '')
      .replace(/^P\d+\s*/i, '')
      .replace(/^[-:：\s]+/, '')
      .trim() || '链路检查'
  );
}

function latencyTone(item) {
  const status = String(item?.status || '').toUpperCase();
  if (status === 'READY' || status === 'ATTEMPTED') return 'ok';
  if (status === 'MISSING' || status === 'BLOCKED' || status === 'SPREAD_BLOCK' || status === 'STARTUP_GUARD')
    return 'bad';
  return 'warn';
}

function recoveryEvidenceText(item) {
  const evidence = item?.expectedEvidence || {};
  const fields = Array.isArray(evidence.fields) ? evidence.fields.join(' / ') : '';
  if (evidence.file && fields) return `${evidence.file}｜${fields}`;
  return evidence.file || fields || item?.reasonZh || '';
}

function gapCurrentText(item) {
  const current = item?.current ?? 'UNKNOWN';
  const required = item?.required ?? 'PASS';
  return `当前 ${current}｜需要 ${required}`;
}

function iterationEvidenceText(item) {
  const evidence = Array.isArray(item?.expectedEvidence) ? item.expectedEvidence.join(' / ') : '';
  const mode = item?.mode || safeIterationPlan.value.mode || 'SHADOW_SIMULATION_ONLY';
  return evidence ? `${mode}｜${evidence}` : mode;
}

function actionTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function setActionStatus(kind, title, summary) {
  actionStatus.value = { kind, title, summary, time: actionTime() };
}

function statusSummary() {
  const state = payload.value.stateZh || payload.value.state || '状态待确认';
  const source = payload.value.singleSourceOfTruth || 'USDJPY_LIVE_LOOP';
  const blockers = blockedReasons.value.length;
  const missing = missingEvidence.value.length;
  return `已读取 ${source}：${state}；阻断 ${blockers} 条；缺失证据 ${missing} 条。`;
}

async function loadStatus({ silent = false } = {}) {
  loading.value = true;
  error.value = '';
  if (!silent)
    setActionStatus(
      'running',
      'Agent 正在刷新恢复证据',
      '正在读取 USDJPY Shadow Advisory、EA 影子观察和技术链路。',
    );
  try {
    payload.value = unwrap(await fetchAutomationChainStatus());
    if (!silent) setActionStatus('success', 'Agent 证据已刷新', statusSummary());
  } catch (err) {
    error.value = err?.message || '读取自动化链路失败';
    if (!silent) setActionStatus('error', 'Agent 刷新失败', error.value);
  } finally {
    loading.value = false;
  }
}

async function runOnce() {
  running.value = true;
  error.value = '';
  setActionStatus('running', 'Agent 正在生成恢复证据', '正在生成 USDJPY policy、EA 干跑和 live-loop 状态。');
  try {
    payload.value = unwrap(await runAutomationChain({ send: false }));
    setActionStatus('success', 'Agent 恢复证据已生成', statusSummary());
  } catch (err) {
    error.value = err?.message || '运行自动化链路失败';
    setActionStatus('error', 'Agent 生成失败', error.value);
  } finally {
    running.value = false;
  }
}

onMounted(() => loadStatus({ silent: true }));
</script>

<style scoped>
.qg-automation-chain-panel {
  border: 1px solid var(--qg-border-subtle, rgba(148, 163, 184, 0.22));
  border-radius: 18px;
  padding: 16px;
  background: var(--qg-surface-panel, rgba(15, 23, 42, 0.72));
  color: var(--qg-text-primary, #e5e7eb);
}

.qg-automation-chain-panel__header,
.qg-automation-chain-panel__summary,
.qg-automation-chain-panel__truth,
.qg-automation-chain-panel__grid {
  display: grid;
  gap: 12px;
}

.qg-automation-chain-panel__header {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.qg-automation-chain-panel__eyebrow {
  margin: 0 0 4px;
  color: var(--qg-text-muted, #94a3b8);
  font-size: 12px;
}

.qg-automation-chain-panel h2,
.qg-automation-chain-panel h3 {
  margin: 0;
}

.qg-automation-chain-panel__subtitle {
  max-width: 720px;
  margin: 6px 0 0;
  color: var(--qg-text-muted, #94a3b8);
  line-height: 1.55;
}

.qg-automation-chain-panel__actions {
  display: flex;
  gap: 8px;
}

.qg-automation-chain-panel button {
  border: 1px solid var(--qg-border-subtle, rgba(148, 163, 184, 0.22));
  border-radius: 999px;
  padding: 8px 12px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.qg-automation-chain-panel button.primary {
  background: var(--qg-accent, #38bdf8);
  color: #020617;
}

.qg-automation-chain-panel__action-result {
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.34);
  padding: 12px;
  margin-top: 14px;
}

.qg-automation-chain-panel__action-result div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.qg-automation-chain-panel__action-result span,
.qg-automation-chain-panel__action-result p {
  color: var(--qg-text-muted, #94a3b8);
}

.qg-automation-chain-panel__action-result p {
  margin: 6px 0 0;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.qg-automation-chain-panel__action-result--running {
  border-color: rgba(56, 189, 248, 0.55);
}

.qg-automation-chain-panel__action-result--success {
  border-color: rgba(34, 197, 94, 0.45);
}

.qg-automation-chain-panel__action-result--error {
  border-color: rgba(248, 113, 113, 0.55);
}

.qg-automation-chain-panel__summary {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 14px;
}

.qg-automation-chain-panel__summary > div,
.qg-automation-chain-panel__truth > article,
.qg-automation-chain-panel__grid > article {
  border: 1px solid var(--qg-border-subtle, rgba(148, 163, 184, 0.18));
  border-radius: 14px;
  padding: 12px;
  background: rgba(2, 6, 23, 0.28);
}

.qg-automation-chain-panel__summary span {
  display: block;
  color: var(--qg-text-muted, #94a3b8);
  font-size: 12px;
}

.qg-automation-chain-panel__summary strong,
.qg-automation-chain-panel__truth strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.qg-automation-chain-panel__truth {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 14px;
}

.qg-automation-chain-panel__truth span,
.qg-automation-chain-panel__truth small {
  display: block;
  color: var(--qg-text-muted, #94a3b8);
}

.qg-automation-chain-panel__truth small {
  margin-top: 6px;
  line-height: 1.45;
}

.qg-automation-chain-panel__grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.qg-automation-chain-panel ul {
  margin: 10px 0 0;
  padding-left: 18px;
}

.qg-automation-chain-panel__plain-list {
  list-style: none;
  padding-left: 0 !important;
}

.qg-automation-chain-panel li {
  margin: 6px 0;
}

.qg-automation-chain-panel small {
  display: block;
  color: var(--qg-text-muted, #94a3b8);
}

.good,
.ok {
  color: #22c55e;
}

.warn {
  color: #f59e0b;
}

.bad {
  color: #ef4444;
}

.qg-automation-chain-panel__error {
  margin-top: 12px;
  color: #f87171;
}

.qg-automation-chain-panel__loading {
  margin-top: 12px;
  color: var(--qg-text-muted, #94a3b8);
}

@media (max-width: 900px) {
  .qg-automation-chain-panel__header,
  .qg-automation-chain-panel__summary,
  .qg-automation-chain-panel__truth,
  .qg-automation-chain-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
