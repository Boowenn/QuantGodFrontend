import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];
const files = [
  'src/services/usdjpyStrategyLabApi.js',
  'src/components/USDJPYEvolutionPanel.vue',
  'src/components/USDJPYCaseMemoryPanel.vue',
  'src/workspaces/dashboard/DashboardWorkspace.vue',
];
const forbidden =
  /\/QuantGod_.*\.(json|csv)|OrderSend|quick-trade|telegramCommandExecutionAllowed\s*[:=]\s*true|fetch\s*\(|hyperliquid|moss|\bcrypto\b|\bbtc\b/i;

function read(rel) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) {
    errors.push(`${rel} is missing`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

for (const file of files) {
  const text = read(file);
  if (forbidden.test(text)) errors.push(`${file} contains forbidden runtime or execution pattern`);
}

const service = read('src/services/usdjpyStrategyLabApi.js');
for (const marker of [
  '/evolution/status',
  '/evolution/build',
  '/evolution/replay',
  '/evolution/tune',
  '/evolution/proposal',
  '/evolution/telegram-text',
  '/bar-replay/status',
  '/bar-replay/build',
  '/bar-replay/entry',
  '/bar-replay/exit',
  '/bar-replay/telegram-text',
  '/walk-forward/status',
  '/walk-forward/build',
  '/walk-forward/selection',
  '/walk-forward/proposal',
  '/walk-forward/telegram-text',
  '/autonomous-agent/state',
  '/autonomous-agent/run',
  '/autonomous-agent/decision',
  '/autonomous-agent/patch',
  '/autonomous-agent/lifecycle',
  '/autonomous-agent/lanes',
  '/autonomous-agent/mt5-shadow',
  '/autonomous-agent/ea-repro',
  '/autonomous-agent/daily-autopilot-v2',
  '/autonomous-agent/daily-autopilot-v2/run',
  '/autonomous-agent/daily-autopilot-v2/telegram-text',
  '/daily-todo',
  '/daily-todo/run',
  '/daily-todo/telegram-text',
  '/daily-review',
  '/daily-review/run',
  '/daily-review/telegram-text',
  '/autonomous-agent/telegram-text',
  '/ga/status',
  '/ga/run-generation',
  '/ga/generations',
  '/ga/candidates',
  '/ga/candidate/',
  '/ga/evolution-path',
  '/ga/blockers',
  '/ga/telegram-text',
  '/strategy-contract/status',
  '/strategy-contract/build',
  '/strategy-contract/telegram-text',
  '/strategy-backtest/status',
  '/strategy-backtest/production-status',
  '/strategy-backtest/sample',
  '/strategy-backtest/run',
  '/strategy-backtest/telegram-text',
  '/strategy-backtest/sync-klines',
  '/evidence-os/status',
  '/evidence-os/run',
  '/evidence-os/parity',
  '/evidence-os/execution-feedback',
  '/evidence-os/case-memory',
  '/evidence-os/telegram-text',
  '/telegram-gateway/status',
  '/telegram-gateway/test-event',
  '/telegram-gateway/dispatch',
  '/agent-ops-health/status',
]) {
  if (!service.includes(marker)) errors.push(`service missing ${marker}`);
}
if (!service.includes('fetchJson') || !service.includes('postCommandJson')) {
  errors.push('service must use fetchJson for queries and postCommandJson for commands');
}

const panel = read('src/components/USDJPYEvolutionPanel.vue');
for (const marker of [
  'USDJPY Shadow / ReadOnly 研究闭环',
  '数据集',
  '回放',
  '参数候选',
  '自主治理代理',
  '不会改源码或 live preset',
  '回放候选对比',
  '预期影响',
  '风险变化',
  '因果 bar/tick 回放',
  '未来后验只评分，不触发',
  '前向验证稳定性筛选',
  '本页不生成执行授权',
  '硬风控失败时保持阻断',
  '自动回滚',
  '三车道 Shadow / ReadOnly 生命周期',
  '美分账户',
  'MT5 模拟车道',
  '自动日报 2.0',
  '今日待办',
  '每日复盘',
  '下一阶段任务',
  '策略契约',
  '遗传进化',
  '通知网关',
  'EA 对账',
  'actionStatus',
  '因果回放已完成',
  '自主治理已完成',
  '自动日报已完成',
  '复盘闭环已完成',
  '遗传进化全过程审计',
  '运行遗传进化',
  '第 {{ item.generation }} 代',
  '种子',
  'PF',
  '胜率',
  '最大回撤',
  'Sharpe / Sortino',
  '交易数',
  '历史样本',
  'Parity / 执行',
  '阻断原因',
  '完整审计',
  '权益曲线',
  '父代路径',
  '主血统时间线',
  '进化树',
  '精英路径高亮',
  '折叠旁支',
  '展开全部血统',
  '变异 / 交叉来源',
  '变异 / 交叉路径',
  '完整证据链',
  'fetchUSDJPYGACandidate',
  'fetchUSDJPYStrategyBacktestProductionStatus',
  'selectGASeed',
  'gaEquityPolyline',
  'gaEvidenceChain',
  'gaLineageSummary',
  'gaLineagePathNodes',
  'gaLineagePathSummary',
  'gaLineagePathNodeMeta',
  'gaLineageTreeLevels',
  'gaLineageTreeEdges',
  'gaVisibleLineageTreeNodes',
  'gaLineageTreeHiddenCount',
  'lineageTreeExpanded',
  'qg-usdjpy-evolution__lineage-path-node--elite',
  'lineageEdgeTypeZh',
  'onElitePath',
  'fitnessBreakdown',
  '策略契约回测证据',
  '单候选前向验证',
  '训练段',
  '验证段',
  '前推段',
  'gaWalkForwardSegments',
  'gaWalkForwardSummary',
  'gaWalkForwardStatus',
  '策略契约 → EA 只读契约',
  '只读评估',
  'EA 回执',
  'EA 影子评估',
  'eaShadowEvaluationRecent',
  '收益与回撤',
  '稳定性',
  '晋级证据',
  'gaBacktestMetric',
  'gaEvidenceGateSummary',
  'blockerCode',
  'selectedGASeed',
  'gaSeedSelectionPinned',
  'preferredGASeedCandidateQueue',
  'selectPreferredGASeedWithLineage',
  'gaCandidateHasLineagePath',
  'gaCandidateLineageSourcePriority',
  'ELITE_SELECTED',
  'CROSSOVER',
  'MUTATION',
  '策略契约高保真回测',
  'Runner 覆盖',
  '全策略族',
  '交易成本',
  '逐候选',
  '运行策略回测',
  'USDJPY SQLite K线',
  '策略回测已完成',
  '真实 K线入库',
  '遗传进化历史样本',
  '生产历史样本',
  'Parity 校验',
  '三方一致性',
  '策略契约',
  'Python 回放',
  'EA 输出',
  'Parity 硬差异',
  'Parity 缺字段',
  'deepParity',
  '执行反馈',
  '执行反馈、经验记忆与下一代遗传进化',
  '执行晋级门',
  '执行阻断',
  '执行警告',
  '执行反馈阻断',
  '经验 → 遗传进化',
  '下一代变异提示',
  'gaSeedHints',
  'caseMemoryToGA',
  'promotionGate',
  'fetchProductionEvidenceStatus',
  'coreRuntimeEvidence',
  '经验记忆',
  '通知网关',
  '待投递',
  'ledger 已接入',
  '生成证据系统',
]) {
  if (!panel.includes(marker)) errors.push(`panel missing Chinese marker: ${marker}`);
}

const caseMemoryPanel = read('src/components/USDJPYCaseMemoryPanel.vue');
for (const marker of [
  '样本类型晋级门',
  '历史 freshness 门禁',
  '补证分类',
  'coveragePlan',
  'missingCaseMemoryCategories',
  'staleHistoryTimeframes',
  'caseMemoryArtifactManifest',
  'historyProductionStatus',
  'Core Runtime Evidence',
  'shadow/tester',
]) {
  if (!caseMemoryPanel.includes(marker)) errors.push(`case memory panel missing marker: ${marker}`);
}
if (panel.includes('patchAllowed') || panel.includes('待人工确认') || panel.includes('人工回灌。')) {
  errors.push('panel must use v2.5 Agent semantics without patchAllowed or human-backfill wording');
}
if (
  !panel.includes('fetchUSDJPYEvolutionStatus') ||
  !panel.includes('runUSDJPYEvolutionBuild') ||
  !panel.includes('fetchUSDJPYBarReplayStatus') ||
  !panel.includes('runUSDJPYBarReplayBuild') ||
  !panel.includes('fetchUSDJPYAutonomousAgent') ||
  !panel.includes('runUSDJPYAutonomousAgent')
) {
  errors.push('panel must load and build through USDJPY evolution service helpers');
}
if (
  !panel.includes('fetchUSDJPYGAStatus') ||
  !panel.includes('runUSDJPYGAGeneration') ||
  !panel.includes('fetchUSDJPYGACandidates') ||
  !panel.includes('fetchUSDJPYGAEvolutionPath')
) {
  errors.push('panel must load and run Strategy JSON GA through service helpers');
}
if (!panel.includes('fetchUSDJPYStrategyBacktestStatus') || !panel.includes('runUSDJPYStrategyBacktest')) {
  errors.push('panel must load and run Strategy JSON backtest through service helpers');
}
if (
  !panel.includes('fetchUSDJPYEvidenceOSStatus') ||
  !panel.includes('runUSDJPYEvidenceOS') ||
  !panel.includes('syncUSDJPYStrategyBacktestKlines') ||
  !panel.includes('fetchUSDJPYTelegramGatewayStatus')
) {
  errors.push(
    'panel must load/run USDJPY evidence OS, Telegram Gateway, and sync real K-lines through service helpers',
  );
}

const dashboard = read('src/workspaces/dashboard/DashboardWorkspace.vue');
if (dashboard.includes('<USDJPYEvolutionPanel') || dashboard.includes('<USDJPYStrategyPolicyPanel')) {
  errors.push('Dashboard must not mount heavy USDJPY strategy/evolution panels directly');
}
for (const marker of ['按需打开重证据页面', 'workspace=evolution', 'workspace=mt5']) {
  if (!dashboard.includes(marker))
    errors.push(`Dashboard missing lightweight workspace link marker: ${marker}`);
}

const automationPanel = read('src/components/AutomationChainPanel.vue');
for (const marker of ['actionStatus', 'Agent 恢复证据已生成', 'Agent 证据已刷新', 'USDJPY_LIVE_LOOP']) {
  if (!automationPanel.includes(marker))
    errors.push(`automation panel missing action feedback marker: ${marker}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend USDJPY evolution guard OK');
