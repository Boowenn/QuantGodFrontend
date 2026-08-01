import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function finish() {
  if (failures.length === 0) {
    console.log('frontend automation chain guard OK');
    return;
  }

  console.error('Frontend automation chain guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const required = ['src/services/automationChainApi.js', 'src/components/AutomationChainPanel.vue'];

for (const rel of required) {
  assert(existsSync(join(root, rel)), `missing required automation chain frontend file: ${rel}`);
}

if (failures.length > 0) finish();

const service = readFileSync(join(root, 'src/services/automationChainApi.js'), 'utf8');
const panel = readFileSync(join(root, 'src/components/AutomationChainPanel.vue'), 'utf8');

assert(service.includes('/api/automation-chain'), 'automationChainApi must call /api/automation-chain only');
assert(service.includes('symbols=USDJPYc'), 'automationChainApi must scope every request to USDJPYc');
assert(
  service.includes('postCommandJson'),
  'automationChainApi commands must fail closed through postCommandJson',
);
assert(
  !/USDJPYc,EURUSDc,XAUUSDc/.test(service + panel),
  'automation chain frontend must not default to multi-symbol scope',
);
assert(
  !/QuantGod_.*\.(json|csv)/i.test(service + panel),
  'frontend automation chain must not read QuantGod runtime files directly',
);
assert(
  !/OrderSend|quick-trade|telegram command|privateKey|password|apiKey/i.test(service + panel),
  'frontend automation chain contains forbidden execution/secret wording',
);
assert(
  panel.includes('USDJPY Shadow / ReadOnly') &&
    panel.includes('主状态来源') &&
    panel.includes('Shadow 候选') &&
    panel.includes('阻断原因') &&
    panel.includes('机会信号（只读）'),
  'AutomationChainPanel must expose Chinese status sections',
);
assert(
  panel.includes('USDJPY Live Loop') && panel.includes('技术链路详情'),
  'AutomationChainPanel must explain USDJPY live loop source of truth',
);

finish();
