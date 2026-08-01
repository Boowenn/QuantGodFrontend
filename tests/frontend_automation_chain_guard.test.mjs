import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('automation chain frontend uses api facade and Chinese UX', () => {
  const service = readFileSync(join(root, 'src/services/automationChainApi.js'), 'utf8');
  const panel = readFileSync(join(root, 'src/components/AutomationChainPanel.vue'), 'utf8');
  assert.match(service, /\/api\/automation-chain/);
  assert.match(service, /fetchJson/);
  assert.match(service, /postCommandJson/);
  assert.match(service, /symbols=USDJPYc/);
  assert.doesNotMatch(service + panel, /USDJPYc,EURUSDc,XAUUSDc/);
  assert.doesNotMatch(service, /apiGet|apiPost/);
  assert.match(panel, /USDJPY Shadow \/ ReadOnly/);
  assert.match(panel, /主状态来源/);
  assert.match(panel, /Shadow 候选/);
  assert.match(panel, /USDJPY Live Loop/);
  assert.match(panel, /技术链路详情/);
  assert.match(panel, /信号评估时间线/);
  assert.match(panel, /信号延迟/);
  assert.match(panel, /证据完整度/);
  assert.match(panel, /首个缺口/);
  assert.match(panel, /GA 精英/);
  assert.match(panel, /安全迭代计划/);
  assert.match(panel, /就绪缺口/);
  assert.match(panel, /缺失证据/);
  assert.match(panel, /阻断原因/);
  assert.match(panel, /机会信号（只读）/);
});

test('automation chain frontend avoids direct runtime files and execution controls', () => {
  const combined =
    readFileSync(join(root, 'src/services/automationChainApi.js'), 'utf8') +
    readFileSync(join(root, 'src/components/AutomationChainPanel.vue'), 'utf8');
  assert.doesNotMatch(combined, /QuantGod_.*\.(json|csv)/i);
  assert.doesNotMatch(combined, /OrderSend|quick-trade|privateKey|password|apiKey/i);
});
