<template>
  <WorkspaceFrame
    eyebrow="AI 回测闭环"
    title="一键只读回测、中文分析与可选 Telegram 推送"
    description="把 MT5 后端回测和 DeepSeek 中文建议串成一个人工可控按钮；Telegram 默认不发送，勾选后才尝试一次外部投递。"
    :loading="loading"
    :error="error"
    @refresh="load"
  >
    <section class="backtest-ai-hero">
      <div>
        <p class="qg-eyebrow">自动化入口</p>
        <h2>只读回测闭环</h2>
        <p>
          点击后依次执行本地 Python 回测与 AI 中文复核；只有显式勾选时才尝试一次 Telegram
          投递。它不会启动实盘交易，也不会修改 MT5 preset、授权锁或风控状态。
        </p>
      </div>
      <div class="backtest-ai-hero__actions">
        <button type="button" class="qg-button qg-button--primary" :disabled="running" @click="runCycle">
          {{ running ? '闭环执行中…' : sendTelegram ? '一键回测并推送' : '一键只读回测' }}
        </button>
        <button type="button" class="qg-button" :disabled="running || loading" @click="load">刷新证据</button>
      </div>
    </section>

    <section class="backtest-ai-settings">
      <label>
        <span>回测品种</span>
        <input v-model="symbolText" autocomplete="off" placeholder="USDJPYc" />
      </label>
      <label>
        <span>回看天数</span>
        <input v-model.number="days" type="number" min="7" max="365" />
      </label>
      <label>
        <span>最多任务</span>
        <input v-model.number="maxTasks" type="number" min="1" max="50" />
      </label>
      <label class="backtest-ai-settings__check">
        <input v-model="sendTelegram" type="checkbox" />
        <span>完成后推送到 Telegram</span>
      </label>
      <label class="backtest-ai-settings__check">
        <input v-model="noDeepseek" type="checkbox" />
        <span>只做本地规则复核，不调用 DeepSeek</span>
      </label>
    </section>

    <MetricGrid :items="metrics" />
    <EndpointHealthGrid :items="healthItems" />

    <section v-if="runResult" class="backtest-ai-run-card">
      <header>
        <div>
          <p class="qg-eyebrow">本次执行</p>
          <h2>{{ runOutcome.label }}</h2>
        </div>
        <StatusPill :status="runOutcome.status" :label="runOutcome.statusLabel" />
      </header>
      <div class="backtest-ai-step-grid">
        <article v-for="step in runSteps" :key="step.label">
          <span>{{ step.label }}</span>
          <strong>{{ step.value }}</strong>
          <StatusPill :status="step.status" :label="step.statusLabel" />
        </article>
      </div>
    </section>

    <div class="qg-domain-grid qg-domain-grid--two">
      <LedgerTable title="回测候选建议" :rows="candidateRows" :limit="12" />
      <LedgerTable title="AI 中文复核" :rows="aiAdviceRows" :limit="8" />
      <LedgerTable title="Telegram 推送记录" :rows="telegramRows" :limit="8" />
      <section class="backtest-ai-summary-card">
        <p class="qg-eyebrow">最新建议</p>
        <h2>{{ aiSummary.verdict }}</h2>
        <p>{{ aiSummary.headline }}</p>
        <dl>
          <div>
            <dt>回测任务</dt>
            <dd>{{ backtestSummary.taskCount }} 个</dd>
          </div>
          <div>
            <dt>最佳路线</dt>
            <dd>{{ backtestSummary.topRouteKey }}</dd>
          </div>
          <div>
            <dt>Telegram</dt>
            <dd>{{ notifySummary.statusLabel }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </WorkspaceFrame>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import EndpointHealthGrid from '../shared/EndpointHealthGrid.vue';
import LedgerTable from '../shared/LedgerTable.vue';
import MetricGrid from '../shared/MetricGrid.vue';
import StatusPill from '../shared/StatusPill.vue';
import WorkspaceFrame from '../shared/WorkspaceFrame.vue';
import {
  aiRows,
  backtestRows,
  DEFAULT_BACKTEST_SYMBOLS,
  loadBacktestAiState,
  notifyRows,
  runBacktestAiCycle,
  summarizeAiReport,
  summarizeBacktest,
  summarizeNotifyConfig,
} from '../../services/backtestAiApi.js';
import { formatDisplayValue } from '../../utils/displayText.js';
import { normalizeTelegramDelivery } from '../../utils/telegramStatus.js';

const loading = ref(false);
const running = ref(false);
const error = ref('');
const runResult = ref(null);
const symbolText = ref(DEFAULT_BACKTEST_SYMBOLS.join(','));
const days = ref(180);
const maxTasks = ref(20);
const sendTelegram = ref(false);
const noDeepseek = ref(false);
const state = reactive({
  backtest: null,
  aiLatest: null,
  notifyConfig: null,
  notifyHistory: null,
});

const backtestSummary = computed(() => summarizeBacktest(state.backtest || runResult.value?.backtest || {}));
const aiSummary = computed(() => summarizeAiReport(state.aiLatest || runResult.value?.ai || {}));
const notifySummary = computed(() => summarizeNotifyConfig(state.notifyConfig || {}));
const candidateRows = computed(() => backtestRows(state.backtest || runResult.value?.backtest || {}));
const aiAdviceRows = computed(() => aiRows(state.aiLatest || runResult.value?.ai || {}));
const telegramRows = computed(() => notifyRows(state.notifyHistory || {}));
const symbols = computed(() =>
  symbolText.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const metrics = computed(() => [
  {
    label: 'Telegram联动',
    value: notifySummary.value.statusLabel,
    hint: notifySummary.value.statusDetail,
    status: notifySummary.value.statusTone,
  },
  {
    label: '回测任务',
    value: backtestSummary.value.taskCount,
    hint: `${backtestSummary.value.readyCount} 个可复核 / ${backtestSummary.value.cautionCount} 个谨慎`,
  },
  {
    label: '最佳候选',
    value: backtestSummary.value.topRouteKey,
    hint: formatDisplayValue(backtestSummary.value.topRankScore),
  },
  {
    label: 'AI结论',
    value: aiSummary.value.verdict,
    hint: aiSummary.value.confidence ? `置信度 ${aiSummary.value.confidence}%` : '等待分析',
  },
]);

const healthItems = computed(() => [
  {
    label: '只读回测',
    description: '本地 Python 回测，不启动实盘交易',
    status: state.backtest?.ok === false ? 'warn' : 'ok',
    statusLabel: state.backtest?.ok === false ? '待复核' : '可用',
  },
  {
    label: 'AI中文分析',
    description: noDeepseek.value ? '当前选择本地规则复核' : 'DeepSeek 可在点击后自动参与分析',
    status: aiSummary.value.itemCount ? 'ok' : 'pending',
    statusLabel: aiSummary.value.itemCount ? '已有报告' : '等待生成',
  },
  {
    label: 'Telegram频道',
    description: notifySummary.value.statusDetail,
    status: notifySummary.value.statusTone,
    statusLabel: notifySummary.value.statusLabel,
  },
]);

const runDelivery = computed(() => normalizeTelegramDelivery(runResult.value?.notify || {}));
const runOutcome = computed(() => {
  const result = runResult.value || {};
  if (result.ok === false) {
    return { label: '闭环需要复核', status: 'blocked', statusLabel: '执行失败' };
  }
  if (!result.sendTelegramRequested) {
    return { label: '只读闭环已完成', status: 'ok', statusLabel: '未请求推送' };
  }
  if (runDelivery.value.code === 'SENT') {
    return { label: '闭环与投递已完成', status: 'ok', statusLabel: '已投递' };
  }
  return {
    label: '回测已完成，投递未确认',
    status: runDelivery.value.tone,
    statusLabel: runDelivery.value.label,
  };
});

const runSteps = computed(() => {
  const result = runResult.value || {};
  const sendRequested = result.sendTelegramRequested === true;
  const delivery = runDelivery.value;
  return [
    {
      label: '只读回测',
      value: summarizeBacktest(result.backtest || {}).topRouteKey,
      status: result.backtest?.ok === false ? 'warn' : 'ok',
      statusLabel: result.backtest?.ok === false ? '需复核' : '完成',
    },
    {
      label: 'AI中文建议',
      value: summarizeAiReport(result.ai || {}).verdict,
      status: result.ai?.ok === false ? 'warn' : 'ok',
      statusLabel: result.ai?.ok === false ? '需复核' : '完成',
    },
    {
      label: 'Telegram推送',
      value: sendRequested ? delivery.detail : '默认关闭；本次未请求外部投递',
      status: sendRequested ? delivery.tone : 'locked',
      statusLabel: sendRequested ? delivery.label : '未发送',
    },
  ];
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    Object.assign(state, await loadBacktestAiState());
  } catch (exc) {
    error.value = exc?.message || 'AI 回测闭环证据加载失败';
  } finally {
    loading.value = false;
  }
}

async function runCycle() {
  running.value = true;
  error.value = '';
  try {
    const result = await runBacktestAiCycle({
      symbols: symbols.value,
      days: days.value,
      maxTasks: maxTasks.value,
      sendTelegram: sendTelegram.value,
      noDeepseek: noDeepseek.value,
    });
    runResult.value = result;
    await load();
  } catch (exc) {
    error.value = exc?.message || 'AI 回测闭环执行失败';
  } finally {
    running.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.backtest-ai-hero,
.backtest-ai-settings,
.backtest-ai-run-card,
.backtest-ai-summary-card {
  min-width: 0;
  border: 1px solid var(--qg-border);
  border-radius: var(--qg-radius-lg);
  background: var(--qg-bg-panel);
  box-shadow: var(--qg-shadow-soft);
}

.backtest-ai-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
}

.backtest-ai-hero h2,
.backtest-ai-hero p,
.backtest-ai-summary-card h2,
.backtest-ai-summary-card p {
  margin: 0;
}

.backtest-ai-hero h2 {
  margin-top: 4px;
  color: var(--qg-text);
  font-size: 28px;
  line-height: 1.12;
}

.backtest-ai-hero p:last-child,
.backtest-ai-summary-card p {
  margin-top: 8px;
  color: var(--qg-text-muted);
  line-height: 1.55;
}

.backtest-ai-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.backtest-ai-settings {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(120px, 0.45fr) minmax(120px, 0.45fr) repeat(
      2,
      minmax(190px, 0.8fr)
    );
  gap: 12px;
  align-items: end;
  padding: 14px;
}

.backtest-ai-settings label {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--qg-text-muted);
  font-size: 12px;
  font-weight: 850;
}

.backtest-ai-settings input:not([type='checkbox']) {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--qg-border);
  border-radius: var(--qg-radius-sm);
  padding: 10px 11px;
  background: var(--qg-surface);
  color: var(--qg-text);
  font: inherit;
}

.backtest-ai-settings__check {
  grid-auto-flow: column;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  min-height: 42px;
  border: 1px solid rgb(148, 163, 184, 0.14);
  border-radius: var(--qg-radius-sm);
  padding: 10px 11px;
  background: var(--qg-surface-soft);
  color: var(--qg-text-soft);
}

.backtest-ai-run-card {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.backtest-ai-run-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.backtest-ai-run-card h2 {
  margin: 4px 0 0;
  color: var(--qg-text);
}

.backtest-ai-step-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.backtest-ai-step-grid article {
  display: grid;
  gap: 7px;
  min-width: 0;
  border: 1px solid rgb(148, 163, 184, 0.14);
  border-radius: var(--qg-radius-md);
  padding: 12px;
  background: var(--qg-surface-soft);
}

.backtest-ai-step-grid span {
  color: var(--qg-text-muted);
  font-size: 12px;
  font-weight: 850;
}

.backtest-ai-step-grid strong {
  overflow-wrap: anywhere;
  color: var(--qg-text);
}

.backtest-ai-summary-card {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 16px;
}

.backtest-ai-summary-card dl {
  display: grid;
  gap: 10px;
  margin: 4px 0 0;
}

.backtest-ai-summary-card div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid rgb(148, 163, 184, 0.12);
  padding-top: 10px;
}

.backtest-ai-summary-card dt {
  color: var(--qg-text-muted);
}

.backtest-ai-summary-card dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--qg-text);
  font-weight: 850;
  text-align: right;
}

@media (width <= 1180px) {
  .backtest-ai-hero,
  .backtest-ai-settings,
  .backtest-ai-step-grid {
    grid-template-columns: 1fr;
  }

  .backtest-ai-hero__actions {
    justify-content: flex-start;
  }
}
</style>
