import { readFileSync, existsSync } from 'node:fs';

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function finish() {
  if (failures.length === 0) {
    console.log('frontend responsive hardening guard passed');
    return;
  }

  console.error('Frontend responsive hardening guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const requiredFiles = [
  'src/styles/responsive-hardening.css',
  'src/main.js',
  'scripts/responsive_check.mjs',
  'src/components/AutomationChainPanel.vue',
];

for (const file of requiredFiles) {
  assert(existsSync(file), `Missing responsive hardening dependency: ${file}`);
}

if (failures.length > 0) finish();

const css = readFileSync('src/styles/responsive-hardening.css', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
const responsiveCheck = readFileSync('scripts/responsive_check.mjs', 'utf8');

const mustContain = [
  '--qg-breakpoint-phone',
  '--qg-breakpoint-iab',
  '--qg-breakpoint-tablet',
  '@media (max-width: 900px)',
  '@media (max-width: 612px)',
  '@media (max-width: 390px)',
  'overflow-x: auto',
  'overflow-x: clip',
  'grid-template-columns: minmax(0, 1fr)',
  '.automation-chain-panel',
  '.data-table-card',
  '.viz-card',
  '.table-panel',
  '.qg-ledger-table__scroll',
];

for (const token of mustContain) {
  assert(css.includes(token), `responsive-hardening.css missing required token: ${token}`);
}

assert(
  main.includes('./styles/responsive-hardening.css') || main.includes('src/styles/responsive-hardening.css'),
  'src/main.js must import ./styles/responsive-hardening.css',
);

const forbidden = [
  /fetch\s*\(/,
  /\/QuantGod_[^'"`\s]+\.(json|csv)/i,
  /OrderSend|OrderSendAsync|PositionClose|TRADE_ACTION_DEAL|telegramCommandExecutionAllowed\s*[:=]\s*true/i,
];

for (const pattern of forbidden) {
  assert(!pattern.test(css), `responsive-hardening.css contains forbidden pattern: ${pattern}`);
}

for (const route of ['dashboard', 'mt5', 'evolution']) {
  assert(
    responsiveCheck.includes(`name: '${route}'`),
    `responsive_check.mjs must continue covering ${route}`,
  );
}

finish();
