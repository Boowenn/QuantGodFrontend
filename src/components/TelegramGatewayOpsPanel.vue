<template>
  <section class="qg-usdjpy-evolution__list qg-usdjpy-evolution__list--telegram-gateway">
    <div class="qg-usdjpy-evolution__section-head">
      <div>
        <h3>Telegram Gateway 运维观测</h3>
        <p>队列、去重、限频、投递 ledger 和 topic 状态的 push-only 运维视图。</p>
      </div>
      <button type="button" :disabled="loading" @click="$emit('collect')">收集 Gateway 报告</button>
    </div>

    <div class="qg-usdjpy-evolution__scenario-grid">
      <article>
        <span>Gateway 状态</span>
        <strong data-testid="telegram-gateway-status">{{ statusText }}</strong>
        <p>{{ statusDetail }}</p>
      </article>
      <article>
        <span>队列数量</span>
        <strong data-testid="telegram-queued-count">{{ metric(state.queuedCount) }}</strong>
        <p>待投递 {{ metric(state.pendingCount) }}；ledger {{ metric(state.ledgerCount) }}。</p>
      </article>
      <article>
        <span>真实发送（已确认）</span>
        <strong data-testid="telegram-sent-count">{{ confirmedSentCount }}</strong>
        <p>最近 topic：{{ state.lastTopic || '无' }}</p>
      </article>
      <article>
        <span>去重 / 限频</span>
        <strong>{{ metric(state.suppressedCount) }}</strong>
        <p>{{ lastDeliveryState.label }}</p>
      </article>
      <article>
        <span>失败数量</span>
        <strong>{{ metric(state.failedCount) }}</strong>
        <p>{{ delivery.lastFailureReason || '暂无可确认失败记录' }}</p>
      </article>
      <article>
        <span>安全边界</span>
        <strong data-testid="telegram-safety-status">{{ safety.label }}</strong>
        <p>{{ safety.reason }}</p>
      </article>
    </div>

    <div v-if="latestRows.length" class="qg-usdjpy-evolution__table-wrap">
      <table class="qg-usdjpy-evolution__table qg-usdjpy-evolution__table--compact">
        <thead>
          <tr>
            <th>topic</th>
            <th>结果</th>
            <th>原因</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in latestRows" :key="row.eventId || row.topic">
            <td>{{ row.topic }}</td>
            <td>{{ deliveryState(row).label }}</td>
            <td>{{ deliveryState(row).detail }}</td>
            <td>{{ formatTelegramTimestamp(deliveryTimestamp(row)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pendingRows.length" class="qg-usdjpy-evolution__mini-list">
      <article v-for="row in pendingRows.slice(0, 4)" :key="row.topic">
        <span>pending topic</span>
        <strong>{{ row.topic }}</strong>
        <p>{{ row.textPreview || row.eventId || '等待统一投递。' }}</p>
      </article>
    </div>

    <p class="qg-usdjpy-evolution__note">
      安全边界：Gateway Ops 只观测和收集中文 push-only 报告；不下单、不平仓、不撤单、不修改 MT5 live
      preset、不接收 Telegram 交易命令。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  formatTelegramTimestamp,
  normalizeTelegramDelivery,
  normalizeTelegramSafety,
  telegramMetric,
  unwrapTelegramPayload,
} from '../utils/telegramStatus.js';

defineEmits(['collect']);

const props = defineProps({
  payload: {
    type: Object,
    default: null,
  },
  fallback: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const state = computed(() => unwrapTelegramPayload(props.payload || props.fallback || {}));
const delivery = computed(() => state.value?.deliveryObservability || {});
const safety = computed(() => normalizeTelegramSafety(state.value));
const statusText = computed(() =>
  safety.value.ready
    ? state.value?.statusZh || state.value?.status || safety.value.label
    : safety.value.label,
);
const statusDetail = computed(() =>
  safety.value.ready ? state.value?.reasonZh || safety.value.reason : safety.value.reason,
);
const lastDeliveryState = computed(() =>
  state.value?.lastDelivery
    ? normalizeTelegramDelivery({ delivery: state.value.lastDelivery })
    : normalizeTelegramDelivery({ status: Number(state.value?.pendingCount) > 0 ? 'QUEUED' : '' }),
);
const confirmedSentCount = computed(() => {
  const count = telegramMetric(state.value?.actualSentCount);
  if (count === '—' || Number(count) === 0) return count;
  return delivery.value?.lastActualSentAtIso ? count : '—';
});
const latestRows = computed(() => {
  const rows = state.value?.latestTopicRows || [];
  return Array.isArray(rows) ? rows : [];
});
const pendingRows = computed(() => {
  const rows = state.value?.pendingTopicRows || [];
  return Array.isArray(rows) ? rows : [];
});

function deliveryState(row) {
  return normalizeTelegramDelivery(row);
}

function deliveryTimestamp(row) {
  return row?.sentAtIso || row?.deliveredAtIso || row?.processedAtIso;
}

function metric(value) {
  return telegramMetric(value);
}
</script>
