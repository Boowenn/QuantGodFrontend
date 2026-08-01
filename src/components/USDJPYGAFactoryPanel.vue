<template>
  <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--ga-factory">
    <div class="qg-usdjpy-evolution__section-head">
      <div>
        <h3>GA Factory 生产化</h3>
        <p>Strategy JSON、Case Memory seed、fitness、elite、graveyard 和 lineage 的只读工厂归档。</p>
      </div>
      <button type="button" :disabled="loading" @click="$emit('build')">生成 GA 工厂</button>
    </div>

    <div class="qg-usdjpy-evolution__scenario-grid">
      <article>
        <span>工厂状态</span>
        <strong>{{ statusText }}</strong>
        <p>{{ nextGeneration.reasonZh || '等待 GA trace 进入工厂归档。' }}</p>
      </article>
      <article>
        <span>候选数量</span>
        <strong>{{ candidateCount }}</strong>
        <p>当前 GA generation {{ currentGeneration }}；仅整理 Shadow 候选，不能创建 execution lane。</p>
      </article>
      <article>
        <span>精英候选</span>
        <strong>{{ eliteCount }}</strong>
        <p>{{ eliteArchive.reasonZh || '等待 elite archive。' }}</p>
      </article>
      <article>
        <span>策略墓园</span>
        <strong>{{ graveyardCount }}</strong>
        <p>{{ graveyard.reasonZh || '硬阻断候选会进入 graveyard，避免重复踩坑。' }}</p>
      </article>
      <article>
        <span>lineage 节点</span>
        <strong>{{ lineageNodeCount }}</strong>
        <p>{{ lineageTree.reasonZh || '等待 lineage tree。' }}</p>
      </article>
      <article>
        <span>下一代生产状态</span>
        <strong>{{ nextGeneration.status || 'WAITING_GA_TRACE' }}</strong>
        <p>mutation / crossover / elite archive 仍只进 shadow/tester/paper-live-sim。</p>
      </article>
      <article>
        <span>性格锁</span>
        <strong>{{ evolutionLockText }}</strong>
        <p>风险内核不可变；战术参数单轮变异上限 {{ tacticalMutationBoundsPct }}%。</p>
      </article>
      <article>
        <span>大白话策略</span>
        <strong>{{ intentStatusText }}</strong>
        <p>有效 seed {{ intentValidSeedCount }}；{{ intentReasonText }}</p>
      </article>
    </div>

    <div class="qg-usdjpy-evolution__scenario-grid">
      <article>
        <span>Strategy Factory intent</span>
        <textarea v-model="intentPrompt" :disabled="loading" rows="3" />
        <button type="button" :disabled="loading" @click="$emit('build-intent', intentPrompt)">
          生成 intent plan
        </button>
      </article>
    </div>

    <div v-if="eliteRows.length" class="qg-usdjpy-evolution__table-wrap">
      <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
        <thead>
          <tr>
            <th>elite seed</th>
            <th>策略族</th>
            <th>fitness</th>
            <th>rank</th>
            <th>阶段</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in eliteRows" :key="item.seedId">
            <td>{{ item.seedId }}</td>
            <td>{{ item.strategyFamily || 'UNKNOWN' }} / {{ item.source || 'GA' }}</td>
            <td>{{ item.fitness ?? '—' }}</td>
            <td>{{ item.rank ?? '—' }}</td>
            <td>{{ item.promotionStage || 'TESTER_ONLY' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="graveyardRows.length" class="qg-usdjpy-evolution__mini-list">
      <article v-for="item in graveyardRows.slice(0, 4)" :key="item.seedId || item.blockerCode">
        <span>graveyard</span>
        <strong>{{ item.blockerCode || item.status || 'BLOCKED' }}</strong>
        <p>{{ item.seedId || 'UNKNOWN' }}：{{ item.blockerZh || '候选进入策略墓园。' }}</p>
      </article>
    </div>

    <p class="qg-usdjpy-evolution__note">
      安全边界：GA Factory 只允许 SHADOW / FAST_SHADOW / TESTER_ONLY / PAPER_LIVE_SIM；不会写入 MT5
      OrderRequest、不会修改 live preset，也不会接收 Telegram 交易命令。
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';

defineEmits(['build', 'build-intent']);

const props = defineProps({
  payload: {
    type: Object,
    default: null,
  },
  gaStatus: {
    type: Object,
    default: null,
  },
  intentPlan: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const intentPrompt = ref('USDJPY 震荡短线，多空都做，低风险，回撤超过百分之十停手。');
const state = computed(() => props.payload?.state || props.payload || {});
const intentState = computed(() => props.intentPlan?.plan || props.intentPlan || {});
const eliteArchive = computed(() => state.value?.eliteArchive || {});
const graveyard = computed(() => state.value?.graveyard || {});
const lineageTree = computed(() => state.value?.lineageTree || {});
const nextGeneration = computed(() => state.value?.nextGeneration || {});
const evolutionLockPolicy = computed(() => state.value?.evolutionLockPolicy || {});
const statusText = computed(() => state.value?.statusZh || state.value?.status || 'WAITING_GA_FACTORY_BUILD');
const currentGeneration = computed(
  () => state.value?.currentGeneration || props.gaStatus?.currentGeneration || 0,
);
const candidateCount = computed(() => state.value?.candidateCount || 0);
const eliteCount = computed(() => state.value?.eliteCount || eliteArchive.value?.eliteCount || 0);
const graveyardCount = computed(() => state.value?.graveyardCount || graveyard.value?.graveyardCount || 0);
const lineageNodeCount = computed(() => state.value?.lineageNodeCount || lineageTree.value?.nodeCount || 0);
const evolutionLockText = computed(() =>
  evolutionLockPolicy.value?.personalityLocked ? 'PERSONALITY_LOCKED' : 'WAITING_LOCK_POLICY',
);
const tacticalMutationBoundsPct = computed(() => evolutionLockPolicy.value?.tacticalMutationBoundsPct ?? 30);
const intentStatusText = computed(
  () =>
    intentState.value?.statusZh ||
    intentState.value?.status ||
    intentState.value?.inferredPersonality?.strategyFamily ||
    'WAITING_INTENT_PLAN',
);
const intentValidSeedCount = computed(() => intentState.value?.validation?.validSeedCount || 0);
const intentReasonText = computed(
  () =>
    intentState.value?.evolutionPolicy?.reasonZh ||
    intentState.value?.reasonZh ||
    '等待自然语言 intent plan。',
);
const eliteRows = computed(() => {
  const rows = eliteArchive.value?.elites || [];
  return Array.isArray(rows) ? rows.slice(0, 8) : [];
});
const graveyardRows = computed(() => {
  const rows = graveyard.value?.strategies || [];
  return Array.isArray(rows) ? rows : [];
});
</script>
