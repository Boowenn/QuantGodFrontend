<template>
  <section class="qg-panel qg-ga-stability-panel">
    <div class="qg-panel__header">
      <div>
        <p class="qg-kicker">GA 多代稳定性</p>
        <h3>GA 工厂生产证据</h3>
        <p class="qg-muted">读取 P4-6 生产证据报告，不新增第二真相来源。</p>
      </div>
      <button class="qg-button" type="button" @click="load" :disabled="loading">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <div v-if="error" class="qg-error">{{ error }}</div>
    <div v-else class="qg-ga-stability-grid">
      <article class="qg-mini-card">
        <span>状态</span>
        <strong>{{ ga.status || 'UNKNOWN' }}</strong>
        <small>{{ ga.stabilityGrade || '等待证据' }}</small>
      </article>
      <article class="qg-mini-card">
        <span>代数</span>
        <strong>{{ ga.generationCount ?? ga.currentGeneration ?? 0 }}</strong>
        <small>候选 {{ ga.candidateCount ?? 0 }}</small>
      </article>
      <article class="qg-mini-card">
        <span>精英 / 墓园</span>
        <strong>{{ ga.eliteCount ?? 0 }} / {{ ga.graveyardCount ?? 0 }}</strong>
        <small>Lineage {{ ga.lineageNodeCount ?? 0 }} 节点</small>
      </article>
      <article class="qg-mini-card">
        <span>可用性</span>
        <strong>{{ ga.evidenceUsability || 'UNKNOWN' }}</strong>
        <small>永久 Shadow / 无 execution lane</small>
      </article>
    </div>

    <div class="qg-list" v-if="recommendations.length">
      <h4>Agent 建议</h4>
      <ul>
        <li v-for="item in recommendations" :key="item">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { fetchGAStability } from '../services/gaStabilityApi.js';

const loading = ref(false);
const error = ref('');
const payload = ref({});

const ga = computed(
  () =>
    payload.value?.report?.gaMultiGenerationStability ||
    payload.value?.gaMultiGenerationStability ||
    payload.value?.ga ||
    payload.value?.gaStability ||
    payload.value?.gaAudit ||
    {},
);
const recommendations = computed(
  () => ga.value?.recommendationsZh || (ga.value?.recommendation ? [ga.value.recommendation] : []),
);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    payload.value = await fetchGAStability();
  } catch (err) {
    error.value = err?.message || '无法读取 GA 多代稳定性。';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
