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
if (!panel.includes('fetchUSDJPYLiveLoop') || !panel.includes('实盘 EA 恢复状态'))
  errors.push('panel must read and display USDJPY live-loop status directly');
if (!panel.includes('机会入场')) errors.push('panel must show opportunity-entry Chinese wording');
if (!panel.includes('阻断')) errors.push('panel must show blocked Chinese wording');
for (const marker of ['策略工厂目录', '实时候选信号', '回测计划', '已导入回测', '风险检查']) {
  if (!panel.includes(marker)) errors.push(`panel missing ${marker} section`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend USDJPY strategy lab guard OK');
