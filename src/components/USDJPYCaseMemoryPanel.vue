<template>
  <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--case-memory">
    <div class="qg-usdjpy-evolution__section-head">
      <div>
        <h3>Case Memory → Strategy JSON Candidate</h3>
        <p>root cause、proposed mutation、shadow Strategy JSON candidate 和 GA seed 只读汇总。</p>
      </div>
      <button type="button" :disabled="loading" @click="$emit('build')">生成经验候选</button>
    </div>

    <div class="qg-usdjpy-evolution__scenario-grid">
      <article>
        <span>候选状态</span>
        <strong>{{ status }}</strong>
        <p>{{ nextAction }}</p>
      </article>
      <article>
        <span>PARITY_FAIL 门禁</span>
        <strong>{{ parityStatus }}</strong>
        <p>{{ parityReason }}</p>
      </article>
      <article>
        <span>Case Memory</span>
        <strong>{{ caseCount }} 条</strong>
        <p>
          {{ fallbackCaseMemory?.summaryZh || '等待 replay / execution feedback / GA blocker 生成经验。' }}
        </p>
      </article>
      <article>
        <span>GA seed</span>
        <strong>{{ gaSeedCount }} 条</strong>
        <p>所有候选保持 Shadow，只进遗传进化种子池，不下单、不改 preset，也不创建 execution lane。</p>
      </article>
      <article>
        <span>样本类型晋级门</span>
        <strong>{{ caseMemoryPromotionStatusText }}</strong>
        <p>{{ caseMemoryPromotionReason }}</p>
      </article>
      <article>
        <span>历史 freshness 门禁</span>
        <strong>{{ historyPromotionStatusText }}</strong>
        <p>{{ historyPromotionReason }}</p>
      </article>
      <article>
        <span>长期记忆</span>
        <strong>{{ tradeMemoryCount }} 笔</strong>
        <p>{{ longTermNextAction }}</p>
      </article>
      <article>
        <span>滚动复盘</span>
        <strong>{{ rollingStatus }}</strong>
        <p>{{ rollingSummaryText }}</p>
      </article>
      <article>
        <span>候选扣分</span>
        <strong>{{ candidatePenaltyCount }} 条</strong>
        <p>{{ feedbackStatusText }}</p>
      </article>
      <article>
        <span>GA 记忆惩罚</span>
        <strong>{{ gaMemoryPenaltyText }}</strong>
        <p>{{ gaMemoryReason }}</p>
      </article>
    </div>

    <div class="qg-usdjpy-evolution__mini-list qg-usdjpy-evolution__mini-list--case-memory">
      <article>
        <span>亏损形态</span>
        <strong>{{ topLossPatternText }}</strong>
        <p>{{ topDataGapText }}</p>
      </article>
      <article>
        <span>防守模式</span>
        <strong>{{ defenseModeText }}</strong>
        <p>{{ defenseReason }}</p>
      </article>
      <article>
        <span>TP/SL 记忆建议</span>
        <strong>{{ tpSlModeText }}</strong>
        <p>{{ tpSlActionText }}</p>
      </article>
    </div>

    <div v-if="missingCoverageRows.length" class="qg-usdjpy-evolution__mini-list">
      <article v-for="item in missingCoverageRows" :key="item.category">
        <span>补证分类 · {{ item.priority || 'MEDIUM' }}</span>
        <strong>{{ item.category }} · 缺 {{ item.remainingCount ?? 0 }} 条</strong>
        <p>
          {{ item.nextActionZh }} 来源：{{ item.collectionEndpoint || item.source }}。验收：{{
            item.acceptanceZh || '补齐 shadow/tester 样本。'
          }}
        </p>
      </article>
    </div>

    <div v-if="candidatePenaltyRows.length" class="qg-usdjpy-evolution__table-wrap">
      <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
        <thead>
          <tr>
            <th>记忆规则</th>
            <th>扣分</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in candidatePenaltyRows" :key="penaltyRuleKey(item)">
            <td>{{ penaltyRuleMatchText(item.match) }}</td>
            <td>{{ metricText(item.penalty) }}</td>
            <td>{{ item.reasonZh || '长期记忆扣分规则。' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="candidateRows.length" class="qg-usdjpy-evolution__table-wrap">
      <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
        <thead>
          <tr>
            <th>经验</th>
            <th>root cause</th>
            <th>proposed mutation</th>
            <th>shadow Strategy JSON candidate</th>
            <th>GA seed</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in candidateRows" :key="item.candidateId || item.caseId">
            <td>{{ item.caseId || 'CASE_MEMORY' }}</td>
            <td>{{ item.rootCause || item.caseType || 'UNKNOWN' }}</td>
            <td>{{ mutationText(item.proposedMutation || item.mutationHint) }}</td>
            <td>{{ candidateStrategyId(item) }} / {{ validationText(item) }}</td>
            <td>{{ item.priority || 'MEDIUM' }} / {{ item.status || 'shadow' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="qg-usdjpy-evolution__mini-list">
      <article>
        <span>只读候选</span>
        <strong>{{ emptyTitle }}</strong>
        <p>{{ emptyText }}</p>
      </article>
    </div>

    <p class="qg-usdjpy-evolution__note">
      这个面板只展示 Case Memory 到 Strategy JSON candidate 的转换结果；PARITY_FAIL 会阻断候选进入 shadow / GA
      elite。旧 MICRO_LIVE 字段已退役，不能创建 execution lane。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';

defineEmits(['build']);

const props = defineProps({
  payload: {
    type: Object,
    default: null,
  },
  fallbackCaseMemory: {
    type: Object,
    default: null,
  },
  coreEvidence: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const report = computed(() => props.payload?.report || props.payload || {});
const coveragePlan = computed(() => report.value?.coveragePlan || {});
const coverageRows = computed(() => {
  const rows = coveragePlan.value?.rows || [];
  return Array.isArray(rows) ? rows : [];
});
const missingCoverageRows = computed(() =>
  coverageRows.value.filter((row) => row?.status === 'MISSING').slice(0, 6),
);
const coreReport = computed(
  () =>
    props.coreEvidence?.report?.coreRuntimeEvidenceIntegrity ||
    props.coreEvidence?.report?.coreRuntimeEvidenceSummary ||
    props.coreEvidence ||
    {},
);
const coreArtifacts = computed(() => {
  const rows = coreReport.value?.artifacts || [];
  return Array.isArray(rows) ? rows : [];
});
const caseMemoryArtifact = computed(
  () => coreArtifacts.value.find((row) => row?.artifactId === 'caseMemoryArtifactManifest') || {},
);
const historyArtifact = computed(
  () => coreArtifacts.value.find((row) => row?.artifactId === 'historyProductionStatus') || {},
);
const caseMemoryPromotionGate = computed(() => caseMemoryArtifact.value?.promotionGate || {});
const historyPromotionGate = computed(() => historyArtifact.value?.promotionGate || {});
const candidateRows = computed(() => {
  const rows = report.value?.candidates || report.value?.strategyCandidates || [];
  return Array.isArray(rows) ? rows.slice(0, 10) : [];
});
const gaSeedRows = computed(() => {
  const rows =
    report.value?.gaSeeds || report.value?.gaSeedHints || props.fallbackCaseMemory?.gaSeedHints || [];
  return Array.isArray(rows) ? rows : [];
});
const parityGate = computed(() => report.value?.parityGate || {});
const longTermMemory = computed(() => report.value?.longTermTradeMemory || {});
const rollingReview = computed(() => longTermMemory.value?.rollingReview || {});
const entryFeedbackPolicy = computed(() => longTermMemory.value?.entryFeedbackPolicy || {});
const defenseMode = computed(() => entryFeedbackPolicy.value?.defenseMode || {});
const tpSlGuidance = computed(() => entryFeedbackPolicy.value?.tpSlGuidance || {});
const selectedGASeed = computed(() => {
  const rows = gaSeedRows.value;
  return rows.find((row) => row?.fitnessBreakdown?.longTermMemoryFeedback) || rows[0] || {};
});
const gaLongTermMemoryFeedback = computed(
  () => selectedGASeed.value?.fitnessBreakdown?.longTermMemoryFeedback || {},
);
const status = computed(() => report.value?.status || report.value?.candidateStatus || 'WAITING_CASE_MEMORY');
const caseCount = computed(
  () => report.value?.caseSummary?.caseCount || props.fallbackCaseMemory?.caseCount || 0,
);
const gaSeedCount = computed(() => report.value?.gaSeedCount || gaSeedRows.value.length || 0);
const missingCaseMemoryCategories = computed(() => {
  const rows =
    coveragePlan.value?.missingCategories || caseMemoryPromotionGate.value?.missingCategories || [];
  return Array.isArray(rows) ? rows : [];
});
const staleHistoryTimeframes = computed(() => {
  const timeframes = historyPromotionGate.value?.timeframes || {};
  return Object.entries(timeframes)
    .filter(([, row]) => row?.freshnessOk === false || row?.passed === false)
    .map(([timeframe]) => timeframe);
});
const caseMemoryPromotionStatusText = computed(() => {
  const status =
    coveragePlan.value?.status ||
    caseMemoryPromotionGate.value?.status ||
    coreReport.value?.promotionGateStatus;
  if (status === 'PASS') return '样本类型已覆盖';
  if (status === 'BLOCKED') return '样本类型不足';
  return '等待样本门禁';
});
const caseMemoryPromotionReason = computed(() => {
  if (missingCaseMemoryCategories.value.length) {
    return `缺少 ${missingCaseMemoryCategories.value.join(' / ')}；这些样本补齐前不能把候选升为 champion。`;
  }
  return (
    coveragePlan.value?.statusZh ||
    caseMemoryPromotionGate.value?.statusZh ||
    '等待 Core Runtime Evidence 输出 Case Memory taxonomy gate。'
  );
});
const historyPromotionStatusText = computed(() => {
  const status = historyPromotionGate.value?.status || coreReport.value?.promotionGateStatus;
  if (status === 'PASS') return '历史样本新鲜';
  if (status === 'BLOCKED') return 'freshness 阻断';
  return '等待历史门禁';
});
const historyPromotionReason = computed(() => {
  if (staleHistoryTimeframes.value.length) {
    return `过期周期 ${staleHistoryTimeframes.value.join(' / ')}；history freshness PASS 前只允许 shadow/tester。`;
  }
  return historyPromotionGate.value?.statusZh || '等待 USDJPY history production freshness gate。';
});
const tradeMemoryCount = computed(() => longTermMemory.value?.tradeMemoryCount || 0);
const rollingStatus = computed(() => rollingReview.value?.status || 'WAITING_TRADE_MEMORY');
const candidatePenaltyRows = computed(() => {
  const rows = entryFeedbackPolicy.value?.candidatePenaltyRules || [];
  return Array.isArray(rows) ? rows.slice(0, 8) : [];
});
const candidatePenaltyCount = computed(() => candidatePenaltyRows.value.length);
const parityStatus = computed(
  () => parityGate.value?.status || report.value?.parityStatus || 'WAITING_PARITY',
);
const parityReason = computed(
  () =>
    parityGate.value?.reasonZh || report.value?.parityReasonZh || '等待 Strategy / Replay / EA 一致性结果。',
);
const nextAction = computed(
  () =>
    report.value?.nextActionZh || props.fallbackCaseMemory?.caseMemoryToGA?.nextActionZh || '等待生成候选。',
);
const longTermNextAction = computed(
  () => longTermMemory.value?.nextActionZh || '等待逐笔交易记忆、离场标签和滚动复盘样本。',
);
const rollingSummaryText = computed(() => {
  const samples = rollingReview.value?.sampleCount || 0;
  const winRate = metricText(rollingReview.value?.winRate);
  const profit = metricText(rollingReview.value?.totalProfitR);
  return `有效样本 ${samples} 笔；胜率 ${winRate}；总R ${profit}`;
});
const feedbackStatusText = computed(() => {
  const statusText = entryFeedbackPolicy.value?.status || 'MEMORY_WAITING';
  const streak = entryFeedbackPolicy.value?.lossStreak || 0;
  return `${statusText}；连续亏损 ${streak}`;
});
const defenseModeText = computed(() => (defenseMode.value?.enabled ? '已开启' : '未开启'));
const defenseReason = computed(() => defenseMode.value?.reasonZh || '样本未触发防守上限。');
const tpSlModeText = computed(() => tpSlGuidance.value?.mode || 'KEEP_CURRENT_AND_OBSERVE');
const tpSlActionText = computed(() => {
  const rows = tpSlGuidance.value?.actionsZh || [];
  return Array.isArray(rows) && rows.length ? rows[0] : '继续积累 TP/SL 复盘样本。';
});
const topLossPatternText = computed(() => topCounterText(rollingReview.value?.commonLossPatterns));
const topDataGapText = computed(() =>
  topCounterText(rollingReview.value?.commonDataGaps, '暂无数据缺口模式。'),
);
const gaMemoryPenaltyText = computed(() => metricText(gaLongTermMemoryFeedback.value?.penalty));
const gaMemoryReason = computed(
  () => gaLongTermMemoryFeedback.value?.reasonZh || '等待 GA fitness 输出长期记忆惩罚。',
);
const emptyTitle = computed(() =>
  parityStatus.value === 'PARITY_FAIL' ? 'PARITY_FAIL 已阻断' : '等待候选生成',
);
const emptyText = computed(() =>
  parityStatus.value === 'PARITY_FAIL'
    ? '先修复 Strategy JSON / Python Replay / MQL5 EA 差异，再允许生成 shadow Strategy JSON candidate。'
    : '点击生成经验候选后，系统会把 root cause 转成 proposed mutation 和 GA seed。',
);

function mutationText(value) {
  if (!value) return '等待 proposed mutation';
  if (typeof value === 'string') return value;
  const parts = [value.field, value.action, value.reason].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'proposed mutation';
}

function candidateStrategyId(item) {
  return item?.strategyJson?.strategyId || item?.strategyId || item?.seedId || 'SHADOW_ONLY';
}

function validationText(item) {
  if (item?.validationStatus) return item.validationStatus;
  if (item?.validation?.valid === false) return 'REJECTED';
  if (item?.validation?.valid === true) return 'VALIDATED';
  return 'PENDING';
}

function metricText(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (Number.isFinite(number)) return Number(number.toFixed(4)).toString();
  return String(value);
}

function topCounterText(rows, fallback = '暂无重复亏损形态。') {
  if (!Array.isArray(rows) || rows.length === 0) return fallback;
  const first = rows[0] || {};
  return `${first.name || first.trigger || 'UNKNOWN'} × ${first.count || 0}`;
}

function penaltyRuleMatchText(match) {
  if (!match || typeof match !== 'object') return '全局记忆';
  const parts = [];
  if (match.symbol) parts.push(`symbol=${match.symbol}`);
  if (match.side) parts.push(`side=${match.side}`);
  if (match.dataGap) parts.push(`gap=${match.dataGap}`);
  if (match.adverseFactor) parts.push(`factor=${match.adverseFactor}`);
  return parts.length ? parts.join(' / ') : '全局记忆';
}

function penaltyRuleKey(item) {
  return `${penaltyRuleMatchText(item?.match)}-${metricText(item?.penalty)}`;
}
</script>
