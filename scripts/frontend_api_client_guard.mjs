import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.env.QG_FRONTEND_ROOT ? path.resolve(process.env.QG_FRONTEND_ROOT) : process.cwd();

const errors = [];

function fail(message) {
  errors.push(message);
}

function read(relPath) {
  const target = path.join(root, relPath);
  if (!fs.existsSync(target)) {
    fail(`${relPath} is missing`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function readJson(relPath) {
  try {
    return JSON.parse(read(relPath));
  } catch (error) {
    fail(`${relPath} is not valid JSON: ${error.message}`);
    return {};
  }
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile() && ['.js', '.mjs', '.ts'].includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const apiClient = read('src/services/apiClient.js');
const domainApi = read('src/services/domainApi.js');
const eslintConfig = read('eslint.config.js');
const pkg = readJson('package.json');
const workflow = read('.github/workflows/ci.yml');

const requiredExports = [
  'assertApiPath',
  'joinApiBaseUrl',
  'makeApiUrl',
  'queryString',
  'rowsFromPayload',
  'attachApiMeta',
  'fetchApiJson',
  'postApiJson',
  'fetchJson',
  'postJson',
  'fetchCommandJson',
  'postCommandJson',
  'fetchRows',
  'apiFallback',
  'apiThrowMessage',
  'fetchJsonOrFallback',
  'postJsonOrFallback',
  'fetchJsonOrThrow',
  'postJsonOrThrow',
];

for (const name of requiredExports) {
  if (
    !apiClient.includes(`export function ${name}`) &&
    !apiClient.includes(`export async function ${name}`)
  ) {
    fail(`apiClient.js must export ${name}`);
  }
}

if (!apiClient.includes("startsWith('/api/')") && !apiClient.includes('startsWith("/api/")')) {
  fail('apiClient.js must enforce /api/* paths');
}

if (!apiClient.includes('RUNTIME_FILE_PATTERN') || !apiClient.includes('QuantGod_')) {
  fail('apiClient.js must reject raw QuantGod runtime JSON/CSV paths');
}

if (
  !apiClient.includes('_api') ||
  !apiClient.includes('method') ||
  !apiClient.includes('fetchedAt') ||
  !apiClient.includes('durationMs')
) {
  fail('apiClient.js must attach uniform _api observability metadata');
}

if (/^https?:\/\//i.test(apiClient)) {
  fail('apiClient.js source must not hard-code external URLs');
}

if (!domainApi.includes("from './apiClient.js'")) {
  fail('domainApi.js must import helpers from apiClient.js');
}

const forbiddenDomainHelpers = [
  'const JSON_HEADERS',
  'async function fetchJson',
  'async function postJson',
  'function rowsFromPayload',
  'async function fetchRows',
  'function params',
];

for (const token of forbiddenDomainHelpers) {
  if (domainApi.includes(token)) {
    fail(`domainApi.js still defines duplicated helper: ${token}`);
  }
}

if (/\bfetch\s*\(/.test(domainApi)) {
  fail('domainApi.js must not call fetch() directly after apiClient migration');
}

if (/\/QuantGod_[^\s'"?#]+\.(json|csv)\b/i.test(domainApi)) {
  fail('domainApi.js must not reference raw QuantGod runtime JSON/CSV files');
}

const serviceDir = path.join(root, 'src/services');
const serviceFiles = walkFiles(serviceDir);
const servicePaths = serviceFiles
  .map((filePath) => path.relative(root, filePath).replaceAll(path.sep, '/'))
  .sort();
const serviceSources = new Map();
for (const filePath of serviceFiles) {
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');
  if (relativePath === 'src/services/apiClient.js') continue;
  const source = fs.readFileSync(filePath, 'utf8');
  serviceSources.set(relativePath, source);
  if (!source.includes("from './apiClient.js'")) {
    fail(`${relativePath} must import API helpers from apiClient.js`);
  }
  if (/\bfetch\s*\(/.test(source)) {
    fail(`${relativePath} must not call fetch() directly; use apiClient.js helpers`);
  }
  if (/\/QuantGod_[^\s'"?#]+\.(json|csv)\b/i.test(source)) {
    fail(`${relativePath} must not reference raw QuantGod runtime JSON/CSV files`);
  }
  if (relativePath !== 'src/services/domainApi.js' && /from\s+['"]\.\/domainApi\.js['"]/.test(source)) {
    fail(`${relativePath} must import API helpers from apiClient.js instead of domainApi.js`);
  }
  for (const token of [
    'const JSON_HEADERS',
    'const CSRF_HEADERS',
    'async function fetchJson',
    'async function postJson',
    'async function apiGet',
    'async function apiPost',
    'function postJson',
    'function getJson',
    'function apiGet',
    'function apiPost',
    'function requestJson',
  ]) {
    if (source.includes(token)) {
      fail(`${relativePath} still defines duplicated API helper/header: ${token}`);
    }
  }
}

const backtestAiSource = serviceSources.get('src/services/backtestAiApi.js') || '';
if (!backtestAiSource.includes('function fetchBacktestAiJson')) {
  fail('src/services/backtestAiApi.js must expose semantic fetchBacktestAiJson wrapper');
}
if (!backtestAiSource.includes('function postBacktestAiJson')) {
  fail('src/services/backtestAiApi.js must expose semantic postBacktestAiJson wrapper');
}
for (const token of ['fetchJsonOrFallback(', 'postJsonOrFallback(']) {
  const firstIndex = backtestAiSource.indexOf(token);
  const secondIndex = firstIndex < 0 ? -1 : backtestAiSource.indexOf(token, firstIndex + token.length);
  if (secondIndex >= 0) {
    fail(`src/services/backtestAiApi.js must call ${token} only inside its semantic wrapper`);
  }
}
if (!backtestAiSource.includes('postCommandJson(') || !backtestAiSource.includes('fetchCommandJson(')) {
  fail('src/services/backtestAiApi.js commands must use strict command helpers');
}
if (backtestAiSource.includes('postJsonOrFallback(')) {
  fail('src/services/backtestAiApi.js commands must not use postJsonOrFallback');
}

const phase1Source = serviceSources.get('src/services/phase1Api.js') || '';
if (!phase1Source.includes('function fetchPhase1Json')) {
  fail('src/services/phase1Api.js must expose semantic fetchPhase1Json wrapper');
}
if (!phase1Source.includes('function postPhase1Json')) {
  fail('src/services/phase1Api.js must expose semantic postPhase1Json wrapper');
}
for (const token of ['fetchJsonOrFallback(', 'postJsonOrFallback(']) {
  const firstIndex = phase1Source.indexOf(token);
  const secondIndex = firstIndex < 0 ? -1 : phase1Source.indexOf(token, firstIndex + token.length);
  if (secondIndex >= 0) {
    fail(`src/services/phase1Api.js must call ${token} only inside its semantic wrapper`);
  }
}
if (!phase1Source.includes('postCommandJson(') || phase1Source.includes('postJsonOrFallback(')) {
  fail('src/services/phase1Api.js commands must use postCommandJson exclusively');
}
for (const token of ['fetchJsonOrThrow', 'postJsonOrThrow']) {
  if (phase1Source.includes(token)) {
    fail(`src/services/phase1Api.js must not use throwing helper ${token}; return API envelopes`);
  }
}

const legacyApiSource = serviceSources.get('src/services/api.js') || '';
if (
  legacyApiSource.includes('loadDashboardState') &&
  !legacyApiSource.includes('loadLegacyDashboardEntries')
) {
  fail('src/services/api.js loadDashboardState must use per-endpoint fallback loading');
}
for (const marker of [
  '/api/dashboard/state',
  '/api/mt5-readonly-secondary/snapshot',
  'secondaryMt5Snapshot',
  'secondarySnapshot: secondaryMt5Snapshot',
]) {
  if (!legacyApiSource.includes(marker)) {
    fail(`src/services/api.js legacy dashboard loader must keep whole-frontend freshness marker: ${marker}`);
  }
}
if (
  /const\s*\[[\s\S]*?\]\s*=\s*await\s*Promise\.all\s*\(\s*\[/.test(legacyApiSource) ||
  /return\s+Promise\.all\s*\(\s*\[/.test(legacyApiSource)
) {
  fail('src/services/api.js must not use blocking Promise.all array loaders for dashboard state');
}

const phase2Source = serviceSources.get('src/services/phase2Api.js') || '';
if (!phase2Source.includes('function fetchPhase2Json')) {
  fail('src/services/phase2Api.js must expose semantic fetchPhase2Json wrapper');
}
if (!phase2Source.includes('function postPhase2Json')) {
  fail('src/services/phase2Api.js must expose semantic postPhase2Json wrapper');
}
for (const token of ['fetchJsonOrFallback(', 'postJsonOrFallback(']) {
  const firstIndex = phase2Source.indexOf(token);
  const secondIndex = firstIndex < 0 ? -1 : phase2Source.indexOf(token, firstIndex + token.length);
  if (secondIndex >= 0) {
    fail(`src/services/phase2Api.js must call ${token} only inside its semantic wrapper`);
  }
}
if (!phase2Source.includes('postCommandJson(') || phase2Source.includes('postJsonOrFallback(')) {
  fail('src/services/phase2Api.js commands must use postCommandJson exclusively');
}

const phase3Source = serviceSources.get('src/services/phase3Api.js') || '';
if (!phase3Source.includes('function fetchPhase3Json')) {
  fail('src/services/phase3Api.js must expose semantic fetchPhase3Json wrapper');
}
if (!phase3Source.includes('function postPhase3Json')) {
  fail('src/services/phase3Api.js must expose semantic postPhase3Json wrapper');
}
for (const token of ['fetchJsonOrFallback(', 'postJsonOrFallback(']) {
  const firstIndex = phase3Source.indexOf(token);
  const secondIndex = firstIndex < 0 ? -1 : phase3Source.indexOf(token, firstIndex + token.length);
  if (secondIndex >= 0) {
    fail(`src/services/phase3Api.js must call ${token} only inside its semantic wrapper`);
  }
}
if (!phase3Source.includes('postCommandJson(') || phase3Source.includes('postJsonOrFallback(')) {
  fail('src/services/phase3Api.js commands must use postCommandJson exclusively');
}
if (/\bfunction\s+getJson\b/.test(phase3Source)) {
  fail('src/services/phase3Api.js must not use generic getJson wrapper; use fetchPhase3Json');
}

const usdJpyLabSource = serviceSources.get('src/services/usdjpyStrategyLabApi.js') || '';
if (!usdJpyLabSource.includes('function fetchUSDJPYLabJson')) {
  fail('src/services/usdjpyStrategyLabApi.js must expose semantic fetchUSDJPYLabJson wrapper');
}
if (!usdJpyLabSource.includes('function postUSDJPYLabJson')) {
  fail('src/services/usdjpyStrategyLabApi.js must expose semantic postUSDJPYLabJson wrapper');
}
for (const token of ['fetchJson(', 'postJson(']) {
  const firstIndex = usdJpyLabSource.indexOf(token);
  const secondIndex = firstIndex < 0 ? -1 : usdJpyLabSource.indexOf(token, firstIndex + token.length);
  if (secondIndex >= 0) {
    fail(`src/services/usdjpyStrategyLabApi.js must call ${token} only inside its semantic wrapper`);
  }
}
if (/\bfunction\s+getJson\b/.test(usdJpyLabSource)) {
  fail('src/services/usdjpyStrategyLabApi.js must not use generic getJson wrapper; use fetchUSDJPYLabJson');
}

if (legacyApiSource.includes('/api/paramlab/auto-tester/')) {
  if (!legacyApiSource.includes('postCommandJson(') || legacyApiSource.includes('postJson(')) {
    fail('src/services/api.js ParamLab commands must use postCommandJson exclusively');
  }
}

if (!domainApi.includes('queryString as params')) {
  fail('domainApi.js should alias queryString as params to preserve loader readability');
}

if (!pkg.scripts || pkg.scripts['api-client'] !== 'node scripts/frontend_api_client_guard.mjs') {
  fail('package.json must define npm run api-client');
}

const p0Toolchain = String(pkg.scripts?.['p0-toolchain'] || '');
if (!p0Toolchain.includes('npm run contract') || !p0Toolchain.includes('npm run api-client')) {
  fail('package.json p0-toolchain must run contract and api-client guards before frontend acceptance');
}

for (const servicePath of servicePaths) {
  for (const scriptName of ['lint', 'format:check']) {
    if (!String(pkg.scripts?.[scriptName] || '').includes(servicePath)) {
      fail(`package.json ${scriptName} must include ${servicePath}`);
    }
  }
  if (!eslintConfig.includes(servicePath)) {
    fail(`eslint.config.js foundationFiles must include ${servicePath}`);
  }
}

if (!workflow.includes('npm run api-client')) {
  fail('Frontend CI workflow must run npm run api-client');
}

if (errors.length) {
  console.error('Frontend API client guard failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Frontend API client guard OK');
}
