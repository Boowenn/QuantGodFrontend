import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];
const files = [
  'src/services/strategyGaFactoryApi.js',
  'src/components/USDJPYGAFactoryPanel.vue',
  'src/components/USDJPYEvolutionPanel.vue',
  'package.json',
];
const forbidden =
  /\/QuantGod_.*\.(json|csv|jsonl)|runtime\/ga_factory|OrderSend|telegramCommandExecutionAllowed\s*[:=]\s*true|fetch\s*\(|hyperliquid|moss|\bcrypto\b|\bbtc\b/i;

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

const service = read('src/services/strategyGaFactoryApi.js');
for (const marker of [
  '/api/strategy-ga-factory',
  '/status',
  '/build',
  '/intent-plan',
  '/telegram-text',
  'fetchStrategyGaFactoryStatus',
  'buildStrategyGaFactory',
  'fetchStrategyFactoryIntentPlan',
  'buildStrategyFactoryIntentPlan',
  'fetchStrategyGaFactoryTelegramText',
  'fetchJson',
  'postCommandJson',
]) {
  if (!service.includes(marker)) errors.push(`strategy GA factory service missing ${marker}`);
}

const component = read('src/components/USDJPYGAFactoryPanel.vue');
for (const marker of [
  'GA Factory 生产化',
  'Strategy JSON',
  'Case Memory seed',
  'fitness',
  'elite',
  'graveyard',
  'lineage',
  '下一代生产状态',
  '性格锁',
  'PERSONALITY_LOCKED',
  'Strategy Factory intent',
  'SHADOW / FAST_SHADOW / TESTER_ONLY / PAPER_LIVE_SIM',
  '不会写入 MT5',
  '不会修改 live preset',
]) {
  if (!component.includes(marker)) errors.push(`GA factory panel missing marker: ${marker}`);
}

const panel = read('src/components/USDJPYEvolutionPanel.vue');
for (const marker of [
  'USDJPYGAFactoryPanel',
  'gaFactoryPayload',
  'fetchStrategyGaFactoryStatus',
  'buildStrategyGaFactory',
  'fetchStrategyFactoryIntentPlan',
  'buildStrategyFactoryIntentPlan',
  'runStrategyFactoryIntentPlan',
  'runGAFactoryBuild',
  'gaFactorySummary',
  'strategyFactoryIntentSummary',
  '生成 GA 工厂',
  '生成大白话策略',
]) {
  if (!panel.includes(marker)) errors.push(`Evolution panel missing marker: ${marker}`);
}

const packageJson = JSON.parse(read('package.json') || '{}');
if (packageJson.scripts?.['strategy-ga-factory'] !== 'node scripts/frontend_strategy_ga_factory_guard.mjs') {
  errors.push('package.json must define scripts.strategy-ga-factory');
}
if (
  packageJson.scripts?.['test:strategy-ga-factory'] !==
  'node --test tests/frontend_strategy_ga_factory_guard.test.mjs'
) {
  errors.push('package.json must define scripts.test:strategy-ga-factory');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend Strategy GA Factory guard OK');
