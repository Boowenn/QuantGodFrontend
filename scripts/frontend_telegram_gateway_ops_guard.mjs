import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const errors = [];
const files = [
  'src/services/telegramGatewayOpsApi.js',
  'src/utils/telegramStatus.js',
  'src/components/TelegramGatewayOpsPanel.vue',
  'src/components/USDJPYEvolutionPanel.vue',
  'package.json',
];
const forbidden =
  /\/QuantGod_.*\.(json|csv|jsonl)|runtime\/notifications|\bOrderSend\b|telegramCommandExecutionAllowed\s*[:=]\s*true|fetch\s*\(/i;

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

const service = read('src/services/telegramGatewayOpsApi.js');
for (const marker of [
  '/api/telegram-gateway',
  '/status',
  '/collect',
  '/telegram-text',
  'fetchTelegramGatewayOpsStatus',
  'collectTelegramGatewayOps',
  'fetchTelegramGatewayOpsTelegramText',
  'fetchJson',
  'postCommandJson',
]) {
  if (!service.includes(marker)) errors.push(`Telegram Gateway Ops service missing ${marker}`);
}

const component = read('src/components/TelegramGatewayOpsPanel.vue');
for (const marker of [
  'Telegram Gateway 运维观测',
  '队列数量',
  '真实发送',
  '去重 / 限频',
  '失败数量',
  'pending topic',
  'push-only',
  '不下单',
  '不接收 Telegram 交易命令',
]) {
  if (!component.includes(marker)) errors.push(`Telegram Gateway Ops panel missing marker: ${marker}`);
}
for (const marker of [
  'normalizeTelegramDelivery',
  'normalizeTelegramSafety',
  'telegramMetric',
  'unwrapTelegramPayload',
]) {
  if (!component.includes(marker))
    errors.push(`Telegram Gateway Ops panel missing fail-closed helper: ${marker}`);
}
if (/props\.payload\?\.status\s*\|\|/.test(component)) {
  errors.push('Telegram Gateway Ops panel must not replace a payload object with its string status field');
}
if (/row\.deliveryOk\s*\?\s*['"]已发送/.test(component)) {
  errors.push('Telegram Gateway Ops panel must not treat deliveryOk without a receipt as sent');
}

const telegramStatus = read('src/utils/telegramStatus.js');
for (const marker of ['BOUNDARY_UNCONFIRMED', 'PUSH_UNCONFIRMED', 'UNCONFIRMED', 'explicitSent && receipt']) {
  if (!telegramStatus.includes(marker)) errors.push(`Telegram status helper missing marker: ${marker}`);
}

const panel = read('src/components/USDJPYEvolutionPanel.vue');
for (const marker of [
  'TelegramGatewayOpsPanel',
  'telegramGatewayOpsPayload',
  'fetchTelegramGatewayOpsStatus',
  'collectTelegramGatewayOps',
  'runTelegramGatewayOpsCollect',
]) {
  if (!panel.includes(marker)) errors.push(`Evolution panel missing marker: ${marker}`);
}

const packageJson = JSON.parse(read('package.json') || '{}');
if (
  packageJson.scripts?.['telegram-gateway-ops'] !== 'node scripts/frontend_telegram_gateway_ops_guard.mjs'
) {
  errors.push('package.json must define scripts.telegram-gateway-ops');
}
if (
  packageJson.scripts?.['test:telegram-gateway-ops'] !==
  'node --test tests/frontend_telegram_gateway_ops_guard.test.mjs'
) {
  errors.push('package.json must define scripts.test:telegram-gateway-ops');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('frontend Telegram Gateway Ops guard OK');
