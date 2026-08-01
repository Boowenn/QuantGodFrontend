<template>
  <section class="phase3-workspace">
    <div class="phase3-header">
      <div>
        <p class="eyebrow">策略研究 / 只读闭环</p>
        <h2>策略工坊</h2>
        <p class="muted">
          自然语言生成策略、research-only 回测、AI 多智能体辩论与 K 线叠加。所有策略只进入 Shadow / tester
          研究；回测、ParamLab、Governance 和 Version Gate 只提高证据质量，不能创建 execution lane。
        </p>
      </div>
      <div class="safety-pill">只做研究 · 不改实盘</div>
    </div>
    <div class="phase3-tabs">
      <button type="button" :class="{ active: tab === 'vibe' }" @click="tab = 'vibe'">策略生成</button>
      <button type="button" :class="{ active: tab === 'ai' }" @click="tab = 'ai'">AI 辩论</button>
      <button type="button" :class="{ active: tab === 'kline' }" @click="tab = 'kline'">K 线叠加</button>
    </div>
    <Suspense>
      <VibeCodingWorkspace v-if="tab === 'vibe'" />
      <AiV2DebateWorkspace v-else-if="tab === 'ai'" />
      <KlineEnhancementPanel v-else />
      <template #fallback>
        <LoadingState
          title="正在加载策略工坊"
          description="Monaco、AI V2 与 K线增强模块会按标签页延迟加载。"
        />
      </template>
    </Suspense>
  </section>
</template>

<script setup>
import { defineAsyncComponent, ref } from 'vue';
import LoadingState from '../../components/LoadingState.vue';

const VibeCodingWorkspace = defineAsyncComponent(() => import('./vibe/VibeCodingWorkspace.vue'));
const AiV2DebateWorkspace = defineAsyncComponent(() => import('./ai/AiV2DebateWorkspace.vue'));
const KlineEnhancementPanel = defineAsyncComponent(() => import('./kline/KlineEnhancementPanel.vue'));

const tab = ref('vibe');
</script>

<style scoped>
.phase3-workspace {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 18px;
  color: var(--qg-text);
  background: linear-gradient(180deg, var(--qg-bg-panel), rgb(7, 17, 31, 0.88));
  border: 1px solid var(--qg-border);
  border-radius: var(--qg-radius-lg);
}

.phase3-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  min-width: 0;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--qg-accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

h2 {
  margin: 0 0 8px;
  font-size: 28px;
  line-height: 1.15;
}

.muted {
  max-width: 820px;
  margin: 0;
  color: var(--qg-text-muted);
  line-height: 1.5;
}

.safety-pill {
  flex: 0 0 auto;
  max-width: 100%;
  border: 1px solid rgb(56, 189, 248, 0.35);
  color: var(--qg-accent);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--qg-accent-soft);
}

.phase3-tabs {
  display: flex;
  gap: 8px;
  margin: 0;
  flex-wrap: wrap;
}

.phase3-tabs button {
  border: 1px solid var(--qg-border);
  border-radius: 999px;
  background: var(--qg-surface-soft);
  color: var(--qg-text-soft);
  padding: 9px 12px;
  cursor: pointer;
  font-weight: 800;
}

.phase3-tabs button.active {
  background: var(--qg-accent-soft);
  color: var(--qg-text);
  border-color: rgb(56, 189, 248, 0.5);
}

@media (width <= 760px) {
  .phase3-header {
    display: grid;
  }

  h2 {
    font-size: 24px;
  }
}
</style>
