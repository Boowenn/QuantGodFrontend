<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  fetchProductionEvidenceStatus,
  runProductionEvidenceValidation,
} from '../services/productionEvidenceApi.js';

const loading = ref(false);
const error = ref('');
const report = ref(null);

const coverage = computed(() => report.value?.liveExecutionFeedbackCoverage || {});
const blockers = computed(() => coverage.value?.blockersZh || []);
const recommendations = computed(() => coverage.value?.recommendationsZh || []);
const numericSummary = computed(() => coverage.value?.numericSummary || {});

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

async function load(refresh = false) {
  loading.value = true;
  error.value = '';
  try {
    if (refresh) {
      const result = await runProductionEvidenceValidation();
      report.value = result?.report || result;
    } else {
      const result = await fetchProductionEvidenceStatus();
      report.value = result?.report || result;
    }
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => load(false));
</script>

<template>
  <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--execution-feedback">
    <div class="qg-usdjpy-evolution__section-head">
      <div>
        <h3>影子 / 历史反馈覆盖率</h3>
        <p>量化 Shadow 评估与历史兼容反馈是否足够进入 Case Memory 与 GA fitness；不代表当前可执行。</p>
      </div>
      <button type="button" :disabled="loading" @click="load(true)">
        {{ loading ? '刷新中...' : '刷新覆盖率' }}
      </button>
    </div>

    <p v-if="error" class="qg-usdjpy-evolution__state qg-usdjpy-evolution__state--error">{{ error }}</p>

    <div class="qg-usdjpy-evolution__scenario-grid">
      <article>
        <span>状态</span>
        <strong>{{ coverage.status || 'UNKNOWN' }}</strong>
        <p>{{ coverage.evidenceUsability || '等待样本' }}</p>
      </article>
      <article>
        <span>覆盖等级</span>
        <strong>{{ coverage.coverageGrade || '—' }}</strong>
        <p>核心覆盖率 {{ formatPercent(coverage.coreCoverage) }}</p>
      </article>
      <article>
        <span>样本</span>
        <strong>{{ coverage.sampleCount ?? 0 }}</strong>
        <p>完整样本 {{ coverage.completeSamples ?? 0 }} / 核心完整 {{ coverage.coreCompleteSamples ?? 0 }}</p>
      </article>
      <article>
        <span>字段覆盖率</span>
        <strong>{{ formatPercent(coverage.fieldCoverage) }}</strong>
        <p>用于判断能否进入高质量研究裁决。</p>
      </article>
    </div>

    <div class="qg-usdjpy-evolution__scenario-grid qg-usdjpy-evolution__scenario-grid--wide">
      <article>
        <span>阻断 / 警告</span>
        <strong>{{ blockers.length || 0 }} 项</strong>
        <p>{{ blockers[0] || '暂无反馈证据阻断。' }}</p>
      </article>
      <article>
        <span>建议动作</span>
        <strong>{{ recommendations.length || 0 }} 项</strong>
        <p>{{ recommendations[0] || '继续观察。' }}</p>
      </article>
      <article>
        <span>平均滑点</span>
        <strong>{{ numericSummary.slippagePips?.avg ?? '—' }}</strong>
        <p>pips，仅来自明确标注的历史或模拟反馈。</p>
      </article>
      <article>
        <span>平均延迟</span>
        <strong>{{ numericSummary.latencyMs?.avg ?? '—' }}</strong>
        <p>ms，仅来自 EA Shadow 或历史兼容反馈。</p>
      </article>
      <article>
        <span>平均 profitR</span>
        <strong>{{ numericSummary.profitR?.avg ?? '—' }}</strong>
        <p>R 口径，不和 USC 混算。</p>
      </article>
      <article>
        <span>平均 mfe / mae</span>
        <strong>{{ numericSummary.mfeR?.avg ?? '—' }} / {{ numericSummary.maeR?.avg ?? '—' }}</strong>
        <p>用于早出场、坏入场和 GA fitness。</p>
      </article>
    </div>
  </section>
</template>
