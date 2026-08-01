import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const required = ['src/services/usdjpyStrategyLabApi.js', 'src/components/USDJPYStrategyPolicyPanel.vue'];
const forbidden =
  /\/QuantGod_.*\.(json|csv)|OrderSend|quick-trade|telegramCommandExecutionAllowed\s*[:=]\s*true|fetch\s*\(/i;
const errors = [];

for (const file of required) {
  const full = path.join(repoRoot, file);
  if (!fs.existsSync(full)) errors.push(`${file} is missing`);
}

for (const file of required) {
  const full = path.join(repoRoot, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  if (forbidden.test(text)) errors.push(`${file} contains forbidden pattern`);
}

const service = fs.existsSync(path.join(repoRoot, 'src/services/usdjpyStrategyLabApi.js'))
  ? fs.readFileSync(path.join(repoRoot, 'src/services/usdjpyStrategyLabApi.js'), 'utf8')
  : '';
if (!service.includes('/api/usdjpy-strategy-lab')) errors.push('service must use /api/usdjpy-strategy-lab');
if (!service.includes('fetchJson') || !service.includes('postCommandJson'))
  errors.push('service must use fetchJson for queries and postCommandJson for commands');
for (const marker of [
  '/catalog',
  '/signals',
  '/backtest-plan',
  '/imported-backtests',
  '/import-backtest',
  '/risk-check',
  '/candidate-policy',
  '/live-loop',
]) {
  if (!service.includes(marker)) errors.push(`service missing ${marker} endpoint helper`);
}

const panel = fs.existsSync(path.join(repoRoot, 'src/components/USDJPYStrategyPolicyPanel.vue'))
  ? fs.readFileSync(path.join(repoRoot, 'src/components/USDJPYStrategyPolicyPanel.vue'), 'utf8')
  : '';
if (!panel.includes('USDJPYc') || !panel.includes('其他品种'))
  errors.push('panel must explain USDJPY-only scope in Chinese');
if (!panel.includes('fetchUSDJPYLiveLoop') || !panel.includes('Shadow advisory 状态'))
  errors.push('panel must read and display USDJPY live-loop status directly');
for (const marker of ['SHADOW_ADVISORY_READY', 'READY_FOR_EXISTING_EA', 'advisoryRouteZh']) {
  if (!panel.includes(marker)) errors.push(`panel missing Shadow advisory contract marker ${marker}`);
}
for (const staleCopy of ['实盘 EA 恢复状态', 'Agent 刷新实盘闭环', '自动仓位上限']) {
  if (panel.includes(staleCopy)) errors.push(`panel contains retired execution wording: ${staleCopy}`);
}
if (!panel.includes('机会入场')) errors.push('panel must show opportunity-entry Chinese wording');
if (!panel.includes('阻断')) errors.push('panel must show blocked Chinese wording');
for (const marker of ['策略工厂目录', '实时候选信号', '回测计划', '已导入回测', '风险检查']) {
  if (!panel.includes(marker)) errors.push(`panel missing ${marker} section`);
}

const shadowContractFiles = [
  'src/components/USDJPYEvolutionPanel.vue',
  'src/workspaces/phase3/Phase3Workspace.vue',
  'src/workspaces/governance/GovernanceWorkspace.vue',
  'src/workspaces/governance/governanceModel.js',
  'src/workspaces/dashboard/dashboardModel.js',
  'src/workspaces/mt5/mt5Model.js',
];
const shadowContractText = shadowContractFiles
  .map((file) => {
    const full = path.join(repoRoot, file);
    if (!fs.existsSync(full)) {
      errors.push(`${file} is missing`);
      return '';
    }
    return fs.readFileSync(full, 'utf8');
  })
  .join('\n');

for (const staleCopy of [
  '执行候选车道（只读）',
  '交易执行就绪',
  '策略治理与升实盘闸门',
  '允许升实盘',
  '自动升实盘',
  '实盘车道等待',
  '等待真实执行反馈后再评估',
  '可进配置提案',
  '不会直接实盘',
]) {
  if (shadowContractText.includes(staleCopy))
    errors.push(`active frontend contains retired execution promise: ${staleCopy}`);
}
for (const marker of [
  'Shadow Advisory 车道',
  'execution lane',
  'Shadow 研究晋级',
  '执行通道锁',
  '影子 / 历史反馈可信度门',
]) {
  if (!shadowContractText.includes(marker))
    errors.push(`active frontend missing permanent Shadow contract marker: ${marker}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend USDJPY strategy lab guard OK');
