<template>
  <section class="production-evidence-card">
    <header class="production-evidence-card__header">
      <div>
        <p class="eyebrow">P4-6 Production Evidence</p>
        <h3>生产证据验证</h3>
        <p class="muted">验证历史数据、策略一致性、影子/历史反馈和 GA 多代稳定性；永久只读。</p>
      </div>
      <div class="production-evidence-card__actions">
        <button type="button" :disabled="loading" @click="load">刷新</button>
        <button type="button" :disabled="loading" @click="run">生成验证报告</button>
      </div>
    </header>

    <div v-if="loading" class="muted">正在读取生产证据...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="production-evidence-grid">
      <article v-for="item in cards" :key="item.key" class="production-evidence-cardlet">
        <span class="label">{{ item.label }}</span>
        <strong :class="['status', item.status.toLowerCase()]">{{ item.status }}</strong>
        <p>{{ item.detail }}</p>
      </article>
    </div>

    <div v-if="blockers.length" class="production-evidence-blockers">
      <h4>主要阻断</h4>
      <ul>
        <li v-for="item in blockers" :key="item">{{ item }}</li>
      </ul>
    </div>

    <div v-if="coreBlockerRows.length" class="production-evidence-core-blockers">
      <h4>核心晋级阻断摘要</h4>
      <div
        class="production-evidence-mini-table production-evidence-mini-table--core-blockers"
        role="table"
        aria-label="Core runtime promotion blockers"
      >
        <div
          class="production-evidence-mini-table__head production-evidence-mini-table__head--core-blockers"
          role="row"
        >
          <span role="columnheader">证据</span>
          <span role="columnheader">优先级</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">阻断</span>
          <span role="columnheader">关键缺口</span>
          <span role="columnheader">下一步</span>
          <span role="columnheader">安全边界</span>
        </div>
        <div
          v-for="row in coreBlockerRows"
          :key="row.key"
          class="production-evidence-mini-table__row production-evidence-mini-table__row--core-blockers"
          role="row"
        >
          <span role="cell">{{ row.artifactLabel }}</span>
          <span role="cell">{{ row.priority }}</span>
          <strong :class="['status', row.statusClass]" role="cell">{{ row.status }}</strong>
          <span role="cell">{{ row.blockerCount }} 项：{{ row.blockerLine }}</span>
          <span role="cell">{{ row.evidenceGapLine }}</span>
          <span role="cell">{{ row.nextActionZh }}</span>
          <span role="cell">{{ row.safetyLine }}</span>
        </div>
      </div>
    </div>

    <div v-if="historyRows.length" class="production-evidence-history">
      <h4>History Freshness 恢复队列</h4>
      <div
        class="production-evidence-mini-table production-evidence-mini-table--history"
        role="table"
        aria-label="History freshness recovery"
      >
        <div
          class="production-evidence-mini-table__head production-evidence-mini-table__head--history"
          role="row"
        >
          <span role="columnheader">周期</span>
          <span role="columnheader">优先级</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">CopyRates</span>
          <span role="columnheader">SyncLoop</span>
          <span role="columnheader">最新延迟</span>
          <span role="columnheader">恢复命令</span>
          <span role="columnheader">验收</span>
        </div>
        <div
          v-for="row in historyRows"
          :key="row.timeframe"
          class="production-evidence-mini-table__row production-evidence-mini-table__row--history"
          role="row"
        >
          <span role="cell">{{ row.timeframe }}</span>
          <span role="cell">{{ row.priority }}</span>
          <strong :class="['status', row.statusClass]" role="cell">{{ row.status }}</strong>
          <span role="cell">{{ row.copyRatesLine }}</span>
          <span role="cell">{{ row.syncLoopLine }}</span>
          <span role="cell">{{ row.latestLagHours }}h / {{ row.maxLatestLagHours }}h</span>
          <span role="cell">{{ row.recoveryCommandLine }}</span>
          <span role="cell">{{ row.acceptanceZh }}</span>
        </div>
      </div>
    </div>

    <div v-if="caseMemoryRows.length" class="production-evidence-case-memory">
      <h4>Case Memory 缺失分类</h4>
      <div
        class="production-evidence-mini-table production-evidence-mini-table--case-memory"
        role="table"
        aria-label="Case Memory coverage"
      >
        <div
          class="production-evidence-mini-table__head production-evidence-mini-table__head--case-memory"
          role="row"
        >
          <span role="columnheader">分类</span>
          <span role="columnheader">优先级</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">样本缺口</span>
          <span role="columnheader">源状态</span>
          <span role="columnheader">证据缺口</span>
          <span role="columnheader">前置命令</span>
          <span role="columnheader">补证命令</span>
          <span role="columnheader">下一步</span>
        </div>
        <div
          v-for="row in caseMemoryRows"
          :key="row.category"
          class="production-evidence-mini-table__row production-evidence-mini-table__row--case-memory"
          role="row"
        >
          <span role="cell">{{ row.category }}</span>
          <span role="cell">{{ row.priority }}</span>
          <strong :class="['status', row.statusClass]" role="cell">{{ row.status }}</strong>
          <span role="cell">{{ row.observedCount }} / {{ row.targetCount }}</span>
          <span role="cell">{{ row.sourceGapStatus || '—' }}</span>
          <span role="cell">{{ row.evidenceGapZh || row.sourceGapStatus || '—' }}</span>
          <span role="cell">{{ row.prerequisiteCommand || '—' }}</span>
          <span role="cell">{{ row.collectionCommand || row.collectionEndpoint || row.source }}</span>
          <span role="cell">{{ row.nextActionZh }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  fetchProductionEvidenceStatus,
  runProductionEvidenceValidation,
} from '../services/productionEvidenceApi.js';

const loading = ref(false);
const error = ref('');
const payload = ref(null);

const report = computed(() => payload.value?.report || payload.value || {});
const blockers = computed(() => report.value?.blockersZh || []);
const coreEvidence = computed(
  () => report.value?.coreRuntimeEvidenceSummary || report.value?.coreRuntimeEvidenceIntegrity || {},
);
const coreBlockerRows = computed(() => {
  const rows = Array.isArray(coreEvidence.value?.promotionBlockerSummary)
    ? coreEvidence.value.promotionBlockerSummary
    : [];
  return rows.map((row) => ({
    key: row.artifactId || row.gateId || row.category || row.status,
    artifactLabel: promotionArtifactLabel(row.artifactId, row.category),
    priority: row.priority || 'HIGH',
    status: row.status || 'BLOCKED',
    statusClass: String(row.status || 'BLOCKED').toLowerCase(),
    blockerCount: row.blockerCount ?? (Array.isArray(row.blockers) ? row.blockers.length : 0),
    blockerLine: compactList(row.blockers),
    evidenceGapLine: promotionEvidenceGapLine(row),
    nextActionZh: row.nextActionZh || '按恢复队列补齐只读证据后重新运行 production evidence。',
    safetyLine: safetyBoundaryLine(row),
  }));
});
const historyRows = computed(() => {
  const rows = Array.isArray(report.value?.historyProduction?.freshnessRecoveryQueue)
    ? report.value.historyProduction.freshnessRecoveryQueue
    : [];
  return rows.map((row) => ({
    timeframe: row.timeframe || 'UNKNOWN',
    priority: row.priority || 'MEDIUM',
    status: row.status || 'UNKNOWN',
    statusClass: String(row.status || 'UNKNOWN').toLowerCase(),
    latestLagHours: row.latestLagHours ?? '待确认',
    maxLatestLagHours: row.maxLatestLagHours ?? 96,
    excessLagHours: row.excessLagHours ?? 0,
    copyRatesLine: copyRatesRecoveryLine(row),
    syncLoopLine: syncLoopRecoveryLine(row),
    refreshCommand: row.refreshCommand || '等待 sync-klines 恢复命令',
    recoveryCommandLine: recoveryCommandLine(row),
    verifyCommand: row.verifyCommand || '',
    nextActionZh: row.nextActionZh || '继续刷新 USDJPY 历史 K 线。',
    acceptanceZh: row.acceptanceZh || 'spanOk / densityOk / freshnessOk 均为 true。',
  }));
});
const caseMemoryRows = computed(() => {
  const rows = Array.isArray(report.value?.caseMemoryCoverage?.missingRows)
    ? report.value.caseMemoryCoverage.missingRows
    : Array.isArray(report.value?.caseMemoryCoverage?.rows)
      ? report.value.caseMemoryCoverage.rows
      : [];
  return rows.map((row) => ({
    category: row.category || 'UNKNOWN',
    priority: row.priority || 'MEDIUM',
    status: row.status || 'UNKNOWN',
    statusClass: String(row.status || 'UNKNOWN').toLowerCase(),
    observedCount: row.observedCount ?? 0,
    targetCount: row.targetCount ?? 1,
    remainingCount: row.remainingCount ?? 0,
    evidenceGapZh: row.evidenceGapZh || row.sourceGap?.evidenceGapZh || '',
    sourceGapStatus: row.sourceGapStatus || row.sourceGap?.status || '',
    sourceGapArtifact: row.sourceGapArtifact || row.sourceGap?.sourceArtifact || '',
    source: row.source || 'Case Memory evidence',
    collectionEndpoint: row.collectionEndpoint || '',
    collectionCommand: row.collectionCommand || '',
    prerequisiteCommand: row.prerequisiteCommand || row.sourceGap?.prerequisiteCommand || '',
    caseMemoryBuildCommand: row.caseMemoryBuildCommand || '',
    verifyCommand: row.verifyCommand || '',
    acceptanceZh: row.acceptanceZh || '',
    nextActionZh: row.nextActionZh || '继续补齐 shadow/tester 样本证据。',
  }));
});
const cards = computed(() => {
  const r = report.value || {};
  const core = coreEvidence.value || {};
  return [
    {
      key: 'core-runtime-evidence',
      label: '核心证据晋级闸',
      status:
        core.promotionGateStatus ||
        (core.promotionGatePassed === false ? 'BLOCKED' : core.status || 'UNKNOWN'),
      detail: core.promotionBlockerSummaryCount
        ? `聚合阻断 ${core.promotionBlockerSummaryCount} 类，恢复队列 ${core.promotionRecoveryQueueCount || 0} 项`
        : core.nextActionZh || core.statusZh || '等待核心证据摘要',
    },
    {
      key: 'history',
      label: '历史数据',
      status: r.historyProduction?.status || 'UNKNOWN',
      detail:
        r.historyProduction?.nextRecoveryActionZh ||
        r.historyProduction?.recommendation ||
        '等待历史同步验证',
    },
    {
      key: 'parity',
      label: '策略一致性',
      status: r.strategyFamilyParity?.status || 'UNKNOWN',
      detail: `通过 ${r.strategyFamilyParity?.passCount || 0} / 缺失 ${r.strategyFamilyParity?.missingCount || 0} / 失败 ${r.strategyFamilyParity?.failCount || 0}`,
    },
    {
      key: 'feedback',
      label: '影子 / 历史反馈',
      status: r.liveExecutionFeedbackCoverage?.status || 'UNKNOWN',
      detail: `样本 ${r.liveExecutionFeedbackCoverage?.sampleCount || 0}，字段覆盖 ${(r.liveExecutionFeedbackCoverage?.fieldCoverage || 0) * 100}%`,
    },
    {
      key: 'ga',
      label: 'GA 多代稳定性',
      status: r.gaMultiGenerationStability?.status || 'UNKNOWN',
      detail: `代数 ${r.gaMultiGenerationStability?.currentGeneration || 0}，候选 ${r.gaMultiGenerationStability?.candidateCount || 0}`,
    },
    {
      key: 'case-memory',
      label: 'Case Memory 覆盖',
      status: r.caseMemoryCoverage?.status || 'UNKNOWN',
      detail: `覆盖 ${r.caseMemoryCoverage?.coveredCategoryCount || 0} / ${r.caseMemoryCoverage?.requiredCategoryCount || 0}，缺失 ${(r.caseMemoryCoverage?.missingCategories || []).join(' / ') || '无'}`,
    },
  ];
});

function compactList(value, limit = 3) {
  const rows = Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  if (!rows.length) return '—';
  const head = rows.slice(0, limit).join(' / ');
  const overflow = rows.length > limit ? ` +${rows.length - limit}` : '';
  return `${head}${overflow}`;
}

function promotionArtifactLabel(artifactId = '', category = '') {
  const labels = {
    historyProductionStatus: 'History freshness',
    gaMultiGenerationStabilityReport: 'GA 多代稳定性',
    caseMemoryArtifactManifest: 'Case Memory 覆盖',
    strategyParityReport: 'Strategy parity',
  };
  return labels[artifactId] || category || artifactId || 'Core evidence';
}

function promotionEvidenceGapLine(row = {}) {
  if (Array.isArray(row.staleTimeframes) && row.staleTimeframes.length) {
    return `历史 freshness 过期 ${row.staleTimeframes.join('/')}; CopyRates ${row.copyRatesExportFreshnessStatus || '待确认'}; SyncLoop ${row.continuousSyncStatus || '待确认'}`;
  }
  if (Array.isArray(row.missingCategories) && row.missingCategories.length) {
    return `缺少样本 ${row.missingCategories.join('/')}; candidate ${row.candidateCount ?? 0}; GA seed ${row.gaSeedCount ?? 0}`;
  }
  if (row.stabilityGrade || row.closureMode) {
    return `稳定性 ${row.stabilityGrade || '待确认'}; closure ${row.closureMode || '待确认'}; elite ${row.eliteCount ?? 0}`;
  }
  if (row.reportStatus || row.promotionAllowed === false) {
    return `report ${row.reportStatus || '待确认'}; promotionAllowed=${row.promotionAllowed === true ? 'true' : 'false'}`;
  }
  return compactList(row.blockers);
}

function copyRatesRecoveryLine(row = {}) {
  const status = row.copyRatesExportFreshnessStatus || (row.copyRatesExportStale ? 'STALE' : '待确认');
  const version = row.copyRatesExportSchemaVersion ? `v${row.copyRatesExportSchemaVersion}` : '';
  const lag = row.copyRatesExportGeneratedLagHours
    ? `导出 ${Number(row.copyRatesExportGeneratedLagHours).toFixed(1)}h`
    : '';
  return [status, version, lag].filter(Boolean).join(' · ');
}

function syncLoopRecoveryLine(row = {}) {
  const status =
    row.continuousSyncStatus ||
    (row.continuousSyncRunning === true
      ? 'RUNNING'
      : row.continuousSyncRunning === false
        ? 'MISSING'
        : '待确认');
  const version = row.continuousSyncSchemaVersion ? `v${row.continuousSyncSchemaVersion}` : '';
  const probe = row.continuousSyncProbePermissionDenied ? '探针受限' : '';
  return [status, version, probe].filter(Boolean).join(' · ');
}

function recoveryCommandLine(row = {}) {
  const hostProbe = row.continuousSyncProbePermissionDenied ? row.continuousSyncHostProbeCommand : '';
  return [hostProbe, row.refreshCommand || '等待 sync-klines 恢复命令'].filter(Boolean).join('；');
}

function safetyBoundaryLine(row = {}) {
  const forbidden = Array.isArray(row.forbiddenSideEffects) ? row.forbiddenSideEffects : [];
  if (forbidden.includes('ORDER_SEND') || forbidden.includes('MT5_REQUEST_WRITE')) {
    return '只读/shadow/tester 补证；禁止下单、写请求、改 preset';
  }
  return forbidden.length ? `禁止 ${compactList(forbidden, 2)}` : '保持只读证据面';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    payload.value = await fetchProductionEvidenceStatus();
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
}

async function run() {
  loading.value = true;
  error.value = '';
  try {
    payload.value = await runProductionEvidenceValidation();
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.production-evidence-card {
  border: 1px solid var(--qg-border, rgb(148 163 184 / 22%));
  border-radius: 16px;
  padding: 16px;
  background: var(--qg-surface, rgb(15 23 42 / 72%));
  margin-block: 16px;
}

.production-evidence-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.production-evidence-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.production-evidence-card__actions button {
  border: 1px solid var(--qg-border, rgb(148 163 184 / 30%));
  border-radius: 999px;
  padding: 6px 12px;
  background: transparent;
  color: inherit;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.72;
}

.muted {
  opacity: 0.72;
}

.error {
  color: #fca5a5;
}

.production-evidence-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.production-evidence-cardlet {
  padding: 12px;
  border-radius: 12px;
  background: rgb(15 23 42 / 50%);
  min-width: 0;
}

.label {
  display: block;
  opacity: 0.72;
  font-size: 12px;
  margin-bottom: 6px;
}

.status {
  display: block;
  font-size: 18px;
}

.status.pass {
  color: #86efac;
}

.status.warn,
.status.unknown {
  color: #fde68a;
}

.status.fail,
.status.blocked,
.status.missing {
  color: #fca5a5;
}

.status.covered {
  color: #86efac;
}

.production-evidence-blockers {
  margin-top: 12px;
}

.production-evidence-case-memory {
  margin-top: 12px;
}

.production-evidence-core-blockers {
  margin-top: 12px;
}

.production-evidence-mini-table {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  overflow-x: auto;
}

.production-evidence-mini-table__head,
.production-evidence-mini-table__row {
  display: grid;
  gap: 8px;
  align-items: start;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgb(15 23 42 / 36%);
}

.production-evidence-mini-table__head > span,
.production-evidence-mini-table__row > span,
.production-evidence-mini-table__row > strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.production-evidence-mini-table__head--history,
.production-evidence-mini-table__row--history {
  grid-template-columns:
    minmax(84px, 0.55fr) minmax(76px, 0.5fr) minmax(116px, 0.7fr) minmax(150px, 1fr)
    minmax(170px, 1.05fr) minmax(128px, 0.8fr) minmax(280px, 1.8fr) minmax(280px, 2fr);
}

.production-evidence-mini-table__head--core-blockers,
.production-evidence-mini-table__row--core-blockers {
  grid-template-columns:
    minmax(150px, 1fr) minmax(78px, 0.5fr) minmax(112px, 0.7fr) minmax(220px, 1.4fr)
    minmax(280px, 1.8fr) minmax(300px, 2fr) minmax(250px, 1.5fr);
}

.production-evidence-mini-table__head--case-memory,
.production-evidence-mini-table__row--case-memory {
  grid-template-columns:
    minmax(130px, 1fr) minmax(78px, 0.55fr) minmax(96px, 0.65fr) minmax(88px, 0.55fr)
    minmax(150px, 1fr) minmax(240px, 1.7fr) minmax(230px, 1.5fr) minmax(220px, 1.4fr)
    minmax(260px, 1.8fr);
}

.production-evidence-mini-table__head {
  font-size: 12px;
  opacity: 0.72;
}

@media (width <= 900px) {
  .production-evidence-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 720px) {
  .production-evidence-mini-table__head,
  .production-evidence-mini-table__row {
    grid-template-columns: 1fr;
  }
}

@media (width <= 520px) {
  .production-evidence-card__header {
    flex-direction: column;
  }

  .production-evidence-grid {
    grid-template-columns: 1fr;
  }
}
</style>
