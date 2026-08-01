<template>
  <section class="qg-usdjpy-panel">
    <header class="qg-usdjpy-panel__header">
      <div>
        <p class="qg-usdjpy-panel__eyebrow">USDJPY 单品种策略实验室</p>
        <h2>只研究 USDJPYc，多策略评分与 EA 干跑</h2>
        <p class="qg-usdjpy-panel__subtitle">
          其他品种数据会被忽略；这里只展示策略是否标准入场、机会入场或阻断，以及缺失证据。
        </p>
      </div>
      <div class="qg-usdjpy-panel__actions">
        <button type="button" :disabled="loading" @click="load">Agent 刷新证据</button>
        <button type="button" :disabled="loading" @click="runChain">Agent 生成政策证据</button>
        <button type="button" :disabled="loading" @click="runLiveLoop">Agent 刷新实盘闭环</button>
        <button type="button" :disabled="loading" @click="runSignals">Agent 刷新信号证据</button>
      </div>
    </header>

    <div v-if="loading" class="qg-usdjpy-panel__state">正在加载 USDJPY 策略政策...</div>
    <div v-else-if="error" class="qg-usdjpy-panel__state qg-usdjpy-panel__state--error">{{ error }}</div>
    <template v-else>
      <div class="qg-usdjpy-panel__kpis">
        <article>
          <span>标准入场</span>
          <strong>{{ status?.standardEntryCount ?? 0 }}</strong>
        </article>
        <article>
          <span>机会入场</span>
          <strong>{{ status?.opportunityEntryCount ?? 0 }}</strong>
        </article>
        <article>
          <span>阻断</span>
          <strong>{{ status?.blockedCount ?? 0 }}</strong>
        </article>
        <article>
          <span>最高允许仓位</span>
          <strong>{{ formatLot(status?.maxLot) }}</strong>
        </article>
      </div>

      <article class="qg-usdjpy-panel__card qg-usdjpy-panel__live">
        <div>
          <p class="qg-usdjpy-panel__eyebrow">实盘 EA 恢复状态</p>
          <h3>{{ liveLoop?.stateZh || '等待 USDJPY 实盘闭环证据' }}</h3>
          <p>
            {{ liveLoop?.liveRouteZh || '实盘路线证据不可用；保持阻断并等待后端明确返回。' }}
          </p>
        </div>
        <div class="qg-usdjpy-panel__live-grid">
          <span :class="evidenceClass(liveLoop?.runtimeReady)"
            >运行快照 {{ boolLabel(liveLoop?.runtimeReady) }}</span
          >
          <span :class="evidenceClass(liveLoop?.presetReady)"
            >实盘配置 {{ boolLabel(liveLoop?.presetReady) }}</span
          >
          <span :class="evidenceClass(liveLoop?.policyReady)"
            >政策就绪 {{ boolLabel(liveLoop?.policyReady) }}</span
          >
          <span>自动仓位上限 {{ formatCount(liveLoop?.maxEaPositions) }}，人工仓位不计入</span>
        </div>
        <ul v-if="liveWhyNoEntry.length">
          <li v-for="reason in liveWhyNoEntry" :key="reason">{{ reason }}</li>
        </ul>
      </article>

      <div class="qg-usdjpy-panel__grid">
        <article class="qg-usdjpy-panel__card qg-usdjpy-panel__card--primary">
          <h3>当前优先策略</h3>
          <template v-if="topPolicy">
            <div class="qg-usdjpy-panel__topline">
              <strong>{{ topPolicy.strategy }}</strong>
              <span :class="['qg-usdjpy-pill', pillClass(topPolicy.entryMode)]">{{
                entryModeLabel(topPolicy.entryMode)
              }}</span>
            </div>
            <dl>
              <div>
                <dt>方向</dt>
                <dd>{{ directionLabel(topPolicy.direction) }}</dd>
              </div>
              <div>
                <dt>建议仓位</dt>
                <dd>{{ formatLot(topPolicy.recommendedLot) }} / {{ formatLot(topPolicy.maxLot) }}</dd>
              </div>
              <div>
                <dt>评分</dt>
                <dd>{{ formatScore(topPolicy.score) }}</dd>
              </div>
              <div>
                <dt>出场模式</dt>
                <dd>{{ exitLabel(topPolicy.exitMode) }}</dd>
              </div>
            </dl>
            <ul>
              <li v-for="reason in topReasons" :key="reason">{{ reason }}</li>
            </ul>
          </template>
          <p v-else>暂无 USDJPY 策略政策。</p>
        </article>

        <article class="qg-usdjpy-panel__card">
          <h3>证据链</h3>
          <ul class="qg-usdjpy-panel__evidence">
            <li :class="evidenceClass(status?.evidence?.runtimeOk)">
              运行快照：{{ boolLabel(status?.evidence?.runtimeOk) }}
            </li>
            <li :class="evidenceClass(status?.evidence?.fastlaneOk)">
              快通道质量：{{ boolLabel(status?.evidence?.fastlaneOk) }}
            </li>
            <li :class="evidenceClass(status?.evidence?.triggerPlanFound)">
              入场触发计划：{{ boolLabel(status?.evidence?.triggerPlanFound) }}
            </li>
            <li :class="evidenceClass(status?.evidence?.dynamicSltpFound)">
              动态止盈止损：{{ boolLabel(status?.evidence?.dynamicSltpFound) }}
            </li>
          </ul>
        </article>
      </div>

      <section class="qg-usdjpy-panel__factory">
        <article class="qg-usdjpy-panel__table-card">
          <div class="qg-usdjpy-panel__section-title">
            <h3>策略工厂目录</h3>
            <span>{{ catalogItems.length }} 条 shadow 策略</span>
          </div>
          <div class="qg-usdjpy-panel__strategy-cards">
            <article
              v-for="item in catalogItems"
              :key="item.strategyKey || item.key"
              class="qg-usdjpy-panel__strategy-card"
            >
              <p>{{ item.displayName || item.name || item.strategyKey || item.key }}</p>
              <strong>{{ item.strategyKey || item.key }}</strong>
              <span>{{ strategySummary(item) }}</span>
              <small>{{ safetySummary(item) }}</small>
            </article>
          </div>
        </article>

        <article class="qg-usdjpy-panel__table-card">
          <div class="qg-usdjpy-panel__section-title">
            <h3>实时候选信号</h3>
            <span>{{ signalItems.length }} 条</span>
          </div>
          <div v-if="signalItems.length" class="qg-usdjpy-panel__signal-list">
            <article v-for="(item, index) in signalItems.slice(0, 6)" :key="signalKey(item, index)">
              <strong>{{ item.displayName || item.strategyName || item.strategy || 'USDJPY 候选' }}</strong>
              <span>{{ directionLabel(item.direction) }} · {{ item.timeframe || 'M15' }}</span>
              <small>{{ signalReason(item) }}</small>
            </article>
          </div>
          <p v-else class="qg-usdjpy-panel__muted">
            还没有新的 shadow 候选信号，等待东京突破、夜盘回归或 H4 回调采样。
          </p>
        </article>
      </section>

      <section class="qg-usdjpy-panel__factory qg-usdjpy-panel__factory--secondary">
        <article class="qg-usdjpy-panel__table-card">
          <div class="qg-usdjpy-panel__section-title">
            <h3>回测计划</h3>
            <span>{{ backtestPlans.length }} 个策略</span>
          </div>
          <div class="qg-usdjpy-panel__plan-grid">
            <article v-for="item in backtestPlans" :key="item.strategyKey || item.strategy">
              <strong>{{
                item.displayName || item.strategyName || item.strategyKey || item.strategy
              }}</strong>
              <span>{{ item.timeframe || 'M15' }} · {{ item.window || item.period || 'walk-forward' }}</span>
              <small>{{ backtestSummary(item) }}</small>
            </article>
          </div>
        </article>

        <article class="qg-usdjpy-panel__table-card">
          <div class="qg-usdjpy-panel__section-title">
            <h3>已导入回测</h3>
            <span>{{ importedBacktests.length }} 条</span>
          </div>
          <div class="qg-usdjpy-panel__import-row">
            <input
              v-model="importSource"
              type="text"
              placeholder="粘贴本机回测 CSV/JSON 路径"
              aria-label="本机回测结果路径"
            />
            <button type="button" :disabled="loading || !importSource.trim()" @click="runImportBacktest">
              导入
            </button>
          </div>
          <div v-if="importedBacktests.length" class="qg-usdjpy-panel__import-list">
            <article
              v-for="item in importedBacktests.slice(0, 4)"
              :key="`${item.strategy}-${item.importedAt}`"
            >
              <strong>{{ item.strategyName || item.strategy }}</strong>
              <span
                >PF {{ formatScore(item.profitFactor) }} · 胜率 {{ percentLabel(item.winRate) }} ·
                {{ item.trades || 0 }} 笔</span
              >
              <small>{{ backtestImportStatus(item) }}</small>
            </article>
          </div>
          <p v-else class="qg-usdjpy-panel__muted">还没有导入 Strategy Tester 或外部回测结果。</p>
        </article>
      </section>

      <section class="qg-usdjpy-panel__factory qg-usdjpy-panel__factory--secondary">
        <article class="qg-usdjpy-panel__table-card">
          <div class="qg-usdjpy-panel__section-title">
            <h3>风险检查</h3>
            <span data-testid="risk-decision" :class="evidenceClass(riskOk)">
              {{ riskOk ? 'PASS' : 'BLOCKED' }}
            </span>
          </div>
          <ul class="qg-usdjpy-panel__evidence">
            <li :class="evidenceClass(riskCheck?.runtimeOk)">
              运行快照：{{ boolLabel(riskCheck?.runtimeOk) }}
            </li>
            <li :class="evidenceClass(riskCheck?.fastlaneOk)">
              快通道：{{ boolLabel(riskCheck?.fastlaneOk) }}
            </li>
            <li :class="evidenceClass(riskCheck?.newsOk)">
              USD/JPY 新闻：{{ boolLabel(riskCheck?.newsOk) }}
            </li>
            <li :class="evidenceClass(riskCheck?.shadowOnly)">
              新策略隔离：{{ boolLabel(riskCheck?.shadowOnly) }}
            </li>
          </ul>
        </article>
      </section>

      <article class="qg-usdjpy-panel__table-card">
        <h3>USDJPY 多策略矩阵</h3>
        <div class="qg-usdjpy-panel__table-wrap">
          <table>
            <thead>
              <tr>
                <th>策略</th>
                <th>方向</th>
                <th>状态</th>
                <th>建议仓位</th>
                <th>评分</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in strategies" :key="`${item.strategy}-${item.direction}-${item.regime}`">
                <td data-label="策略">{{ item.strategy }}</td>
                <td data-label="方向">{{ directionLabel(item.direction) }}</td>
                <td data-label="状态">
                  <span :class="['qg-usdjpy-pill', pillClass(item.entryMode)]">{{
                    entryModeLabel(item.entryMode)
                  }}</span>
                </td>
                <td data-label="建议仓位">{{ formatLot(item.recommendedLot) }}</td>
                <td data-label="评分">{{ formatScore(item.score) }}</td>
                <td data-label="原因">{{ firstReason(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  fetchUSDJPYImportedBacktests,
  fetchUSDJPYLiveLoop,
  fetchUSDJPYStrategyBacktestPlan,
  fetchUSDJPYStrategyCatalog,
  fetchUSDJPYStrategyLabStatus,
  fetchUSDJPYStrategyRiskCheck,
  fetchUSDJPYStrategySignals,
  importUSDJPYBacktest,
  runUSDJPYLiveLoop,
  runUSDJPYStrategyLab,
  runUSDJPYStrategySignals,
} from '../services/usdjpyStrategyLabApi.js';

const status = ref(null);
const catalog = ref(null);
const signals = ref(null);
const backtestPlan = ref(null);
const importedBacktest = ref(null);
const riskCheck = ref(null);
const liveLoop = ref(null);
const importSource = ref('');
const loading = ref(false);
const error = ref('');

const topPolicy = computed(() => status.value?.topPolicy || null);
const strategies = computed(() => (Array.isArray(status.value?.strategies) ? status.value.strategies : []));
const catalogItems = computed(() => {
  const items = catalog.value?.catalog || catalog.value?.strategies || [];
  return Array.isArray(items) ? items : [];
});
const signalItems = computed(() => {
  const items = signals.value?.signals || status.value?.candidateSignals || [];
  return Array.isArray(items) ? items : [];
});
const backtestPlans = computed(() => {
  const items = backtestPlan.value?.plans || backtestPlan.value?.strategies || [];
  return Array.isArray(items) ? items : [];
});
const importedBacktests = computed(() => {
  const items = importedBacktest.value?.imports || [];
  return Array.isArray(items) ? items : [];
});
const riskOk = computed(() => {
  if (!riskCheck.value) return false;
  if (riskCheck.value.ok !== true || riskCheck.value.riskOk !== true) return false;
  return ['runtimeOk', 'fastlaneOk', 'newsOk', 'shadowOnly'].every((key) => riskCheck.value?.[key] === true);
});
const liveWhyNoEntry = computed(() =>
  Array.isArray(liveLoop.value?.whyNoEntry) ? liveLoop.value.whyNoEntry.slice(0, 5) : [],
);
const topReasons = computed(() =>
  Array.isArray(topPolicy.value?.reasons) ? topPolicy.value.reasons.slice(0, 5) : [],
);

function entryModeLabel(mode) {
  return (
    {
      STANDARD_ENTRY: '标准入场',
      OPPORTUNITY_ENTRY: '机会入场',
      BLOCKED: '阻断',
    }[mode] || '未知'
  );
}

function directionLabel(direction) {
  return direction === 'LONG' ? '买入观察' : direction === 'SHORT' ? '卖出观察' : '方向待确认';
}

function exitLabel(mode) {
  return mode === 'LET_PROFIT_RUN' ? '让利润奔跑' : '不持仓';
}

function pillClass(mode) {
  if (mode === 'STANDARD_ENTRY') return 'qg-usdjpy-pill--standard';
  if (mode === 'OPPORTUNITY_ENTRY') return 'qg-usdjpy-pill--opportunity';
  return 'qg-usdjpy-pill--blocked';
}

function evidenceClass(ok) {
  if (ok === true) return 'qg-usdjpy-ok';
  if (ok === false) return 'qg-usdjpy-bad';
  return 'qg-usdjpy-unknown';
}

function boolLabel(ok) {
  if (ok === true) return 'PASS';
  if (ok === false) return 'BLOCKED';
  return 'UNKNOWN';
}

function formatLot(value) {
  if (value == null || value === '') return '不可用';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '不可用';
}

function formatCount(value) {
  if (value == null || value === '') return '不可用';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '不可用';
}

function formatScore(value) {
  const number = Number(value || 0);
  return number.toFixed(1);
}

function percentLabel(value) {
  const number = Number(value || 0);
  return `${(number * 100).toFixed(1)}%`;
}

function strategySummary(item) {
  const windowText = item?.session || item?.timeWindow || item?.entryWindow || '影子采样';
  const timeframe = item?.timeframe || item?.timeframes?.join('/') || 'M15';
  return `${timeframe} · ${item?.coreIdea || windowText}`;
}

function safetySummary(item) {
  const flags = item?.safety || item?.constraints || {};
  if (item?.shadowTradingOnly || item?.dryRunOnly || flags.shadowTradingOnly || flags.dryRunOnly) {
    return '只做模拟采样，不进入实盘下单';
  }
  return '等待安全边界确认';
}

function signalKey(item, index) {
  return `${item.strategy || item.strategyKey}-${item.direction}-${item.generatedAtIso || item.time || item.eventId || index}`;
}

function signalReason(item) {
  return item.reason || item.blocker || item.regime || item.status || '已进入 shadow 候选采样';
}

function backtestSummary(item) {
  return (
    item.description ||
    item.acceptance ||
    item.reason ||
    '用于 walk-forward、Strategy JSON、GA 和 Agent 治理门，不直接恢复实盘'
  );
}

function backtestImportStatus(item) {
  if (item.status === 'PROMOTABLE') return '统计达标，可进入 shadow 候选复核';
  if (item.status === 'NEEDS_RETEST') return '统计不足，需要重新回测';
  return '继续观察，不恢复实盘';
}

function firstReason(item) {
  const reasons = Array.isArray(item?.reasons) ? item.reasons : [];
  return reasons[0] || '无';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [
      statusPayload,
      catalogPayload,
      signalsPayload,
      planPayload,
      importedPayload,
      riskPayload,
      livePayload,
    ] = await Promise.all([
      fetchUSDJPYStrategyLabStatus(),
      fetchUSDJPYStrategyCatalog(),
      fetchUSDJPYStrategySignals({ limit: 20 }),
      fetchUSDJPYStrategyBacktestPlan(),
      fetchUSDJPYImportedBacktests({ limit: 20 }),
      fetchUSDJPYStrategyRiskCheck(),
      fetchUSDJPYLiveLoop(),
    ]);
    status.value = statusPayload;
    catalog.value = catalogPayload;
    signals.value = signalsPayload;
    backtestPlan.value = planPayload;
    importedBacktest.value = importedPayload;
    riskCheck.value = riskPayload;
    liveLoop.value = livePayload;
  } catch (err) {
    error.value = err?.message || 'USDJPY 策略政策加载失败';
  } finally {
    loading.value = false;
  }
}

async function runChain() {
  loading.value = true;
  error.value = '';
  try {
    status.value = await runUSDJPYStrategyLab();
    const [signalsPayload, riskPayload] = await Promise.all([
      fetchUSDJPYStrategySignals({ limit: 20 }),
      fetchUSDJPYStrategyRiskCheck(),
    ]);
    signals.value = signalsPayload;
    riskCheck.value = riskPayload;
  } catch (err) {
    error.value = err?.message || 'USDJPY 策略政策生成失败';
  } finally {
    loading.value = false;
  }
}

async function runSignals() {
  loading.value = true;
  error.value = '';
  try {
    signals.value = await runUSDJPYStrategySignals();
  } catch (err) {
    error.value = err?.message || 'USDJPY 候选信号刷新失败';
  } finally {
    loading.value = false;
  }
}

async function runLiveLoop() {
  loading.value = true;
  error.value = '';
  try {
    liveLoop.value = await runUSDJPYLiveLoop();
  } catch (err) {
    error.value = err?.message || 'USDJPY 实盘闭环刷新失败';
  } finally {
    loading.value = false;
  }
}

async function runImportBacktest() {
  if (!importSource.value.trim()) return;
  loading.value = true;
  error.value = '';
  try {
    await importUSDJPYBacktest({ source: importSource.value.trim() });
    importedBacktest.value = await fetchUSDJPYImportedBacktests({ limit: 20 });
    importSource.value = '';
  } catch (err) {
    error.value = err?.message || 'USDJPY 回测结果导入失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.qg-usdjpy-panel {
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.22));
  border-radius: 20px;
  padding: 18px;
  background: var(--qg-surface-elevated, rgb(15, 23, 42, 0.72));
  color: var(--qg-text-primary, #e5e7eb);
  overflow: hidden;
}

.qg-usdjpy-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.qg-usdjpy-panel__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--qg-text-muted, #94a3b8);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.qg-usdjpy-panel h2,
.qg-usdjpy-panel h3,
.qg-usdjpy-panel__subtitle {
  margin: 0;
}

.qg-usdjpy-panel h2 {
  font-size: 20px;
}

.qg-usdjpy-panel h3 {
  font-size: 15px;
  margin-bottom: 12px;
}

.qg-usdjpy-panel__subtitle {
  margin-top: 6px;
  color: var(--qg-text-secondary, #cbd5e1);
  line-height: 1.5;
}

.qg-usdjpy-panel__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.qg-usdjpy-panel button {
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.28));
  border-radius: 12px;
  background: var(--qg-surface-muted, rgb(30, 41, 59, 0.84));
  color: inherit;
  padding: 8px 12px;
  cursor: pointer;
}

.qg-usdjpy-panel button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.qg-usdjpy-panel__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.qg-usdjpy-panel__kpis article,
.qg-usdjpy-panel__card,
.qg-usdjpy-panel__table-card {
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.18));
  border-radius: 16px;
  background: var(--qg-surface, rgb(2, 6, 23, 0.36));
}

.qg-usdjpy-panel__kpis article {
  padding: 12px;
  min-width: 0;
}

.qg-usdjpy-panel__kpis span {
  color: var(--qg-text-muted, #94a3b8);
  font-size: 12px;
}

.qg-usdjpy-panel__kpis strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.qg-usdjpy-panel__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
  gap: 12px;
  margin-bottom: 14px;
}

.qg-usdjpy-panel__live {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 14px;
  margin-bottom: 14px;
  border-color: rgb(56, 189, 248, 0.26);
  background: linear-gradient(135deg, rgb(14, 165, 233, 0.12), rgb(15, 23, 42, 0.42));
}

.qg-usdjpy-panel__live p {
  margin: 6px 0 0;
  color: var(--qg-text-secondary, #cbd5e1);
  line-height: 1.5;
}

.qg-usdjpy-panel__live-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.qg-usdjpy-panel__live-grid span {
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.18));
  border-radius: 12px;
  padding: 10px;
  background: rgb(2, 6, 23, 0.26);
  min-width: 0;
  overflow-wrap: anywhere;
}

.qg-usdjpy-panel__card,
.qg-usdjpy-panel__table-card {
  padding: 14px;
  min-width: 0;
}

.qg-usdjpy-panel__topline {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.qg-usdjpy-panel dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 12px;
}

.qg-usdjpy-panel dt {
  color: var(--qg-text-muted, #94a3b8);
  font-size: 12px;
}

.qg-usdjpy-panel dd {
  margin: 2px 0 0;
  font-variant-numeric: tabular-nums;
}

.qg-usdjpy-panel ul {
  margin: 0;
  padding-left: 18px;
  color: var(--qg-text-secondary, #cbd5e1);
}

.qg-usdjpy-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  white-space: nowrap;
}

.qg-usdjpy-pill--standard {
  background: rgb(34, 197, 94, 0.18);
  color: #86efac;
}

.qg-usdjpy-pill--opportunity {
  background: rgb(234, 179, 8, 0.18);
  color: #fde68a;
}

.qg-usdjpy-pill--blocked {
  background: rgb(248, 113, 113, 0.18);
  color: #fecaca;
}

.qg-usdjpy-ok {
  color: #86efac;
}

.qg-usdjpy-bad {
  color: #fecaca;
}

.qg-usdjpy-unknown {
  color: #fde68a;
}

.qg-usdjpy-panel__factory {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 12px;
  margin-bottom: 14px;
}

.qg-usdjpy-panel__factory--secondary {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
}

.qg-usdjpy-panel__section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.qg-usdjpy-panel__section-title span {
  color: var(--qg-text-muted, #94a3b8);
  font-size: 12px;
  white-space: nowrap;
}

.qg-usdjpy-panel__strategy-cards,
.qg-usdjpy-panel__signal-list,
.qg-usdjpy-panel__plan-grid,
.qg-usdjpy-panel__import-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
}

.qg-usdjpy-panel__signal-list,
.qg-usdjpy-panel__plan-grid,
.qg-usdjpy-panel__import-list {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.qg-usdjpy-panel__strategy-card,
.qg-usdjpy-panel__signal-list article,
.qg-usdjpy-panel__plan-grid article,
.qg-usdjpy-panel__import-list article {
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.14));
  border-radius: 12px;
  padding: 10px;
  background: rgb(15, 23, 42, 0.34);
  min-width: 0;
}

.qg-usdjpy-panel__strategy-card p,
.qg-usdjpy-panel__strategy-card strong,
.qg-usdjpy-panel__strategy-card span,
.qg-usdjpy-panel__strategy-card small,
.qg-usdjpy-panel__signal-list strong,
.qg-usdjpy-panel__signal-list span,
.qg-usdjpy-panel__signal-list small,
.qg-usdjpy-panel__plan-grid strong,
.qg-usdjpy-panel__plan-grid span,
.qg-usdjpy-panel__plan-grid small,
.qg-usdjpy-panel__import-list strong,
.qg-usdjpy-panel__import-list span,
.qg-usdjpy-panel__import-list small {
  display: block;
  overflow-wrap: anywhere;
}

.qg-usdjpy-panel__strategy-card p {
  margin: 0 0 4px;
  color: #7dd3fc;
  font-weight: 700;
}

.qg-usdjpy-panel__strategy-card span,
.qg-usdjpy-panel__signal-list span,
.qg-usdjpy-panel__plan-grid span,
.qg-usdjpy-panel__import-list span {
  margin-top: 6px;
  color: var(--qg-text-secondary, #cbd5e1);
}

.qg-usdjpy-panel__strategy-card small,
.qg-usdjpy-panel__signal-list small,
.qg-usdjpy-panel__plan-grid small,
.qg-usdjpy-panel__import-list small,
.qg-usdjpy-panel__muted {
  margin-top: 6px;
  color: var(--qg-text-muted, #94a3b8);
  line-height: 1.45;
}

.qg-usdjpy-panel__import-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 10px;
}

.qg-usdjpy-panel__import-row input {
  min-width: 0;
  border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.22));
  border-radius: 12px;
  background: rgb(15, 23, 42, 0.58);
  color: inherit;
  padding: 8px 10px;
}

.qg-usdjpy-panel__table-wrap {
  width: 100%;
  overflow-x: auto;
}

.qg-usdjpy-panel table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

.qg-usdjpy-panel th,
.qg-usdjpy-panel td {
  border-bottom: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.16));
  padding: 8px;
  text-align: left;
  vertical-align: top;
}

.qg-usdjpy-panel th {
  color: var(--qg-text-muted, #94a3b8);
  font-weight: 600;
}

.qg-usdjpy-panel__state {
  padding: 18px;
  border-radius: 12px;
  background: rgb(15, 23, 42, 0.42);
}

.qg-usdjpy-panel__state--error {
  color: #fecaca;
}

@media (width <= 900px) {
  .qg-usdjpy-panel__header,
  .qg-usdjpy-panel__live,
  .qg-usdjpy-panel__grid,
  .qg-usdjpy-panel__factory,
  .qg-usdjpy-panel__factory--secondary {
    grid-template-columns: 1fr;
    display: grid;
  }

  .qg-usdjpy-panel__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 520px) {
  .qg-usdjpy-panel {
    padding: 12px;
    border-radius: 14px;
  }

  .qg-usdjpy-panel__kpis {
    grid-template-columns: 1fr;
  }

  .qg-usdjpy-panel dl {
    grid-template-columns: 1fr;
  }

  .qg-usdjpy-panel__live-grid {
    grid-template-columns: 1fr;
  }

  .qg-usdjpy-panel__table-wrap {
    overflow-x: visible;
  }

  .qg-usdjpy-panel table,
  .qg-usdjpy-panel tbody,
  .qg-usdjpy-panel tr,
  .qg-usdjpy-panel td {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .qg-usdjpy-panel table {
    border-collapse: separate;
    border-spacing: 0;
  }

  .qg-usdjpy-panel thead {
    display: none;
  }

  .qg-usdjpy-panel tr {
    border: 1px solid var(--qg-border-subtle, rgb(148, 163, 184, 0.16));
    border-radius: 12px;
    padding: 10px;
    margin-bottom: 10px;
    background: rgb(15, 23, 42, 0.34);
  }

  .qg-usdjpy-panel td {
    display: grid;
    grid-template-columns: minmax(68px, 0.42fr) minmax(0, 1fr);
    gap: 10px;
    border-bottom: 0;
    padding: 5px 0;
    overflow-wrap: anywhere;
  }

  .qg-usdjpy-panel td::before {
    content: attr(data-label);
    color: var(--qg-text-muted, #94a3b8);
    font-size: 12px;
    font-weight: 600;
  }
}
</style>
