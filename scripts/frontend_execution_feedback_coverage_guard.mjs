import { readFileSync } from 'node:fs';
import process from 'node:process';

const failures = [];

const files = [
  'src/components/ExecutionFeedbackCoverageCard.vue',
  'src/components/USDJPYEvolutionPanel.vue',
  'src/services/productionEvidenceApi.js',
];

function fail(message) {
  failures.push(message);
}

function assertCondition(condition, message) {
  if (!condition) fail(message);
}

function readSource(file) {
  return readFileSync(file, 'utf8');
}

function assertReadableSource(file, text) {
  const lines = text.split(/\r?\n/);
  assertCondition(lines.length >= 10, `${file} should be readable multi-line source`);
}

function assertNoRuntimeReads(file, text) {
  assertCondition(
    !/QuantGod_.*\.(json|csv|jsonl)/.test(text),
    `${file} must not read runtime files directly`,
  );
}

function assertNoTradingTokens(file, text) {
  assertCondition(!/OrderSend|PositionClose|TRADE_ACTION_DEAL/.test(text), `${file} contains trading token`);
}

function assertContainsMarker(file, text, marker) {
  assertCondition(text.includes(marker), `${file} missing Shadow/historical feedback marker ${marker}`);
}

for (const file of files) {
  const text = readSource(file);
  assertReadableSource(file, text);
  assertNoRuntimeReads(file, text);
  assertNoTradingTokens(file, text);
}

const card = readSource('src/components/ExecutionFeedbackCoverageCard.vue');
for (const marker of [
  '影子 / 历史反馈覆盖率',
  '不代表当前可执行',
  'coverageGrade',
  'fieldCoverage',
  'coreCoverage',
  'numericSummary',
]) {
  assertContainsMarker('src/components/ExecutionFeedbackCoverageCard.vue', card, marker);
}

const panel = readSource('src/components/USDJPYEvolutionPanel.vue');
assertCondition(
  panel.includes('ExecutionFeedbackCoverageCard'),
  'Evolution panel should show execution feedback coverage',
);

if (failures.length > 0) {
  console.error('frontend execution feedback coverage guard failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('frontend execution feedback coverage guard OK');
