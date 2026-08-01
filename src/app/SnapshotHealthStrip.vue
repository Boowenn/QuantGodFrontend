<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/singleline-html-element-content-newline -->
  <section
    class="snapshot-health"
    :class="[`snapshot-health--${tone}`, { 'snapshot-health--no-axes': !shortAxisItems.length }]"
  >
    <div class="snapshot-health__status">
      <span>运行状态</span>
      <strong :title="rootCause.rootCauseLine">{{ title }}</strong>
      <small :title="detailLine">{{ detailLine }}</small>
    </div>

    <div v-if="initialized" class="snapshot-health__axes" aria-label="MT5 六轴状态">
      <span v-for="item in shortAxisItems" :key="item.label" :data-status="item.status">
        <b>{{ item.shortLabel }}</b>
        {{ item.shortValue }}
      </span>
    </div>

    <div class="snapshot-health__actions">
      <a href="/vue/?workspace=dashboard">查看原因</a>
      <button type="button" class="snapshot-health__refresh" :disabled="loading" @click="load">
        {{ loading ? '刷新中' : '刷新' }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowReactive } from 'vue';
import { loadSnapshotHealthCore } from '../services/domainApi.js';
import {
  buildOperatorOverviewAxisItems,
  buildSnapshotRootCauseBanner,
  normalizeDashboardSnapshot,
} from '../workspaces/dashboard/dashboardModel.js';

const state = shallowReactive({
  operatorOverview: null,
});

const loading = ref(false);
const initialized = ref(false);
const error = ref('');
let loadController = null;
let refreshTimer = null;
let loadRunId = 0;

const snapshot = computed(() => normalizeDashboardSnapshot(state));
const rootCause = computed(() => buildSnapshotRootCauseBanner(snapshot.value));
const axisItems = computed(() => buildOperatorOverviewAxisItems(snapshot.value));
const shortAxisItems = computed(() =>
  snapshot.value.operatorOverviewState?.valid
    ? axisItems.value.map((item) => ({
        ...item,
        shortLabel:
          {
            'MT5 writer': 'Writer',
            券商连接: '连接',
            账号授权: '授权',
            报价新鲜度: '报价',
            'MT5 监控就绪': '监控',
            执行通道锁: '锁定',
          }[item.label] || item.label,
        shortValue: shortAxisValue(item.value),
      }))
    : [],
);
const tone = computed(() => {
  if (error.value) return 'blocked';
  if (!initialized.value) return 'warn';
  return rootCause.value.status || 'warn';
});
const title = computed(() => {
  if (error.value) return '核心快照桥读取失败';
  if (!initialized.value) return '正在核对统一运营状态';
  if (rootCause.value.status === 'blocked' && rootCause.value.label) return rootCause.value.label;
  return rootCause.value.title;
});
const detailLine = computed(() => {
  if (error.value) return error.value;
  if (!initialized.value) return '正在读取 /api/operator/overview 聚合证据。';
  return rootCause.value.rootCauseLine || rootCause.value.nextAction;
});

function shortAxisValue(value) {
  const text = String(value || '未知');
  if (text.includes('MARKET_CLOSED')) return '休市';
  if (text.includes('Shadow / ReadOnly')) return '只读';
  if (text.includes('fresh=true') || text === 'FRESH') return '新鲜';
  if (text.includes('已连接')) return '已连接';
  if (text.includes('已授权')) return '已授权';
  if (text.includes('状态未知')) return '待确认';
  if (text.includes('未就绪')) return '未就绪';
  if (text.includes('不可用') || text.includes('阻断')) return '阻断';
  if (text.includes('就绪')) return '就绪';
  return text.length > 8 ? `${text.slice(0, 8)}…` : text;
}

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
  try {
    const coreState = await loadSnapshotHealthCore({ signal: controller.signal });
    if (controller.signal.aborted || runId !== loadRunId) return;
    Object.assign(state, coreState);
    initialized.value = true;
  } catch (exc) {
    if (controller.signal.aborted || runId !== loadRunId) return;
    error.value = exc?.message || '无法读取核心快照桥。';
  } finally {
    if (runId === loadRunId) {
      loading.value = false;
      loadController = null;
    }
  }
}

onMounted(() => {
  load();
  refreshTimer = globalThis.setInterval(load, 30000);
});

onBeforeUnmount(() => {
  abortLoad();
  if (refreshTimer) globalThis.clearInterval(refreshTimer);
});
</script>

<style scoped>
.snapshot-health {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  padding: 10px clamp(16px, 2vw, 28px);
  background: rgb(9 20 38 / 88%);
  border-bottom: 1px solid rgb(129 151 178 / 22%);
}

.snapshot-health--ok {
  background: rgb(8 34 31 / 88%);
  border-bottom-color: rgb(51 217 154 / 24%);
}

.snapshot-health--blocked {
  background: rgb(39 16 27 / 88%);
  border-bottom-color: rgb(255 107 134 / 28%);
}

.snapshot-health--no-axes {
  grid-template-columns: minmax(0, 1fr) auto;
}

.snapshot-health__status {
  display: grid;
  grid-template-columns: auto minmax(0, auto);
  gap: 2px 8px;
  align-items: baseline;
  min-width: 0;
}

.snapshot-health__status > span {
  color: var(--qg-text-muted);
  font-size: 13px;
  font-weight: 800;
}

.snapshot-health__status strong {
  overflow: hidden;
  color: var(--qg-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-health__status small {
  grid-column: 1 / -1;
  overflow: hidden;
  color: var(--qg-text-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-health__axes {
  display: grid;
  grid-template-columns: repeat(6, minmax(70px, 1fr));
  gap: 6px;
  min-width: 0;
}

.snapshot-health__axes span {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 32px;
  padding: 4px 7px;
  overflow: hidden;
  color: var(--qg-text-muted);
  font-size: 13px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(148 163 184 / 18%);
  border-radius: 999px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-health__axes span[data-status='ok'] {
  border-color: rgb(51 217 154 / 34%);
}

.snapshot-health__axes span[data-status='warn'] {
  border-color: rgb(251 191 36 / 34%);
}

.snapshot-health__axes span[data-status='blocked'] {
  border-color: rgb(255 107 134 / 38%);
}

.snapshot-health__axes b {
  color: var(--qg-text);
  font-weight: 750;
}

.snapshot-health__actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.snapshot-health__actions a,
.snapshot-health__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 10px;
  color: var(--qg-text);
  font-size: 13px;
  text-decoration: none;
}

.snapshot-health__actions a:focus-visible,
.snapshot-health__refresh:focus-visible {
  outline: 3px solid rgb(56 189 248 / 72%);
  outline-offset: 2px;
}

.snapshot-health__refresh {
  min-width: 64px;
  border: 1px solid rgb(148 163 184 / 26%);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--qg-text);
  background: rgb(255 255 255 / 6%);
}

.snapshot-health__refresh:disabled {
  cursor: wait;
  opacity: 0.64;
}

@media (width <= 1320px) {
  .snapshot-health {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .snapshot-health__axes {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (width <= 960px) {
  .snapshot-health {
    grid-template-columns: minmax(0, 1fr);
  }

  .snapshot-health__axes {
    grid-template-columns: repeat(3, minmax(80px, 1fr));
  }
}

@media (width <= 612px) {
  .snapshot-health__axes {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  .snapshot-health__actions {
    justify-content: stretch;
  }

  .snapshot-health__actions > * {
    flex: 1;
  }
}
</style>
