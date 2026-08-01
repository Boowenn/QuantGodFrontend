import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];
const files = [
  'src/services/caseMemoryApi.js',
  'src/components/USDJPYCaseMemoryPanel.vue',
  'src/components/USDJPYEvolutionPanel.vue',
  'package.json',
];
const forbidden =
  /\/QuantGod_.*\.(json|csv|jsonl)|runtime\/case_memory|OrderSend|telegramCommandExecutionAllowed\s*[:=]\s*true|fetch\s*\(/i;

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
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount < 8 && file !== 'package.json') errors.push(`${file} looks collapsed or incomplete`);
}

const service = read('src/services/caseMemoryApi.js');
for (const marker of [
  '/api/case-memory',
  '/status',
  '/build',
  '/telegram-text',
  'fetchCaseMemoryStatus',
  'buildCaseMemoryCandidates',
  'fetchCaseMemoryTelegramText',
  'fetchJson',
  'postCommandJson',
]) {
  if (!service.includes(marker)) errors.push(`case memory service missing ${marker}`);
}

const component = read('src/components/USDJPYCaseMemoryPanel.vue');
for (const marker of [
  'Case Memory → Strategy JSON Candidate',
  'root cause',
  'proposed mutation',
  'shadow Strategy JSON candidate',
  'GA seed',
  'PARITY_FAIL',
  '只读',
  '不下单',
  '不改 preset',
  '不创建 execution lane',
  '长期记忆',
  '滚动复盘',
  '候选扣分',
  'GA 记忆惩罚',
  'longTermTradeMemory',
  'rollingReview',
  'candidatePenaltyRules',
  'longTermMemoryFeedback',
  'defineEmits',
  'candidateRows',
  'candidatePenaltyRows',
  'parityGate',
  'remainingCount',
  'collectionEndpoint',
  'acceptanceZh',
]) {
  if (!component.includes(marker)) errors.push(`case memory panel missing marker: ${marker}`);
}

const evolutionPanel = read('src/components/USDJPYEvolutionPanel.vue');
for (const marker of [
  'USDJPYCaseMemoryPanel',
  'caseMemoryCandidatePayload',
  'fetchCaseMemoryStatus',
  'buildCaseMemoryCandidates',
  'runCaseMemoryBuild',
  'caseMemoryCandidateSummary',
  '生成经验候选',
]) {
  if (!evolutionPanel.includes(marker)) errors.push(`evolution panel missing marker: ${marker}`);
}

const packageJson = JSON.parse(read('package.json') || '{}');
if (packageJson.scripts?.['case-memory'] !== 'node scripts/frontend_case_memory_guard.mjs') {
  errors.push('package.json must define scripts.case-memory');
}
if (packageJson.scripts?.['test:case-memory'] !== 'node --test tests/frontend_case_memory_guard.test.mjs') {
  errors.push('package.json must define scripts.test:case-memory');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend Case Memory guard OK');
