/**
 * Guard the frontend code-splitting contract.
 *
 * Heavy workspaces and chart/editor libraries must stay lazy-loaded so the
 * dashboard can open quickly on small Mac screens and in the local Docker stack.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function failIf(errors, condition, message) {
  if (condition) errors.push(message);
}

export function runCodeSplittingGuard(root = process.cwd()) {
  const errors = [];
  const registry = read(root, 'src/app/workspaceRegistry.js');
  const main = read(root, 'src/main.js');
  const mt5 = read(root, 'src/workspaces/mt5/Mt5Workspace.vue');
  const phase1 = read(root, 'src/workspaces/phase1/Phase1Workspace.vue');
  const phase3 = read(root, 'src/workspaces/phase3/Phase3Workspace.vue');
  const klineChart = read(root, 'src/workspaces/phase1/kline/KlineChart.vue');
  const vite = read(root, 'vite.config.js');

  failIf(
    errors,
    !registry.includes('defineAsyncComponent'),
    'workspaceRegistry.js must use defineAsyncComponent',
  );
  for (const workspace of [
    'DashboardWorkspace',
    'Mt5Workspace',
    'GovernanceWorkspace',
    'ParamLabWorkspace',
    'ResearchWorkspace',
    'BacktestAiWorkspace',
    'LegacyWorkbench',
    'Phase1Workspace',
    'Phase2OperationsWorkspace',
    'Phase3Workspace',
  ]) {
    const staticImport = new RegExp(`import\\s+${workspace}\\s+from\\s+['"]`);
    failIf(errors, staticImport.test(registry), `workspaceRegistry.js statically imports ${workspace}`);
  }

  failIf(
    errors,
    !registry.includes('../workspaces/backtest-ai/BacktestAiWorkspace.vue'),
    'Backtest AI workspace must be lazy-loaded from src/workspaces/backtest-ai',
  );
  failIf(
    errors,
    /from\s+['"]ant-design-vue['"]/.test(main) || /app\.use\s*\(\s*Antd\s*\)/.test(main),
    'src/main.js must not globally load ant-design-vue',
  );
  failIf(
    errors,
    /import\s+KlineWorkspace\s+from\s+['"]\.\.\/phase1\/kline\/KlineWorkspace\.vue['"]/.test(mt5),
    'MT5 workspace must not statically import the Kline workspace',
  );
  failIf(
    errors,
    !mt5.includes("import('../phase1/kline/KlineWorkspace.vue')"),
    'MT5 Kline workspace must be lazy-loaded',
  );
  failIf(
    errors,
    !phase1.includes("import('./kline/KlineWorkspace.vue')"),
    'Phase1 Kline workspace must be lazy-loaded',
  );
  failIf(
    errors,
    !phase1.includes("import('./AiAnalysisWorkspace.vue')"),
    'Phase1 AI workspace must be lazy-loaded',
  );
  failIf(
    errors,
    !phase3.includes("import('./vibe/VibeCodingWorkspace.vue')"),
    'Phase3 Vibe workspace must be lazy-loaded',
  );
  failIf(
    errors,
    !phase3.includes("import('./ai/AiV2DebateWorkspace.vue')"),
    'Phase3 AI V2 workspace must be lazy-loaded',
  );
  failIf(
    errors,
    !phase3.includes("import('./kline/KlineEnhancementPanel.vue')"),
    'Phase3 Kline panel must be lazy-loaded',
  );

  failIf(
    errors,
    /from\s+['"]klinecharts['"]/.test(klineChart),
    'KlineChart.vue must not statically import klinecharts',
  );
  failIf(
    errors,
    !klineChart.includes("import('klinecharts')"),
    'KlineChart.vue must dynamically import klinecharts',
  );

  failIf(errors, !vite.includes('manualChunks'), 'vite.config.js must define manualChunks');
  for (const chunk of ['monaco-editor', 'klinecharts']) {
    failIf(errors, !vite.includes(chunk), `vite.config.js missing ${chunk} chunk rule`);
  }
  for (const chunk of ['workspace-phase3', 'workspace-kline']) {
    failIf(
      errors,
      vite.includes(chunk),
      `vite.config.js must not force ${chunk}; the shared K-line graph produced a startup cycle`,
    );
  }

  return errors;
}

export function main(argv = process.argv.slice(2)) {
  const root = argv[0] ? path.resolve(argv[0]) : process.cwd();
  const errors = runCodeSplittingGuard(root);
  if (errors.length) {
    console.error('QuantGod frontend code-splitting guard failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('QuantGod frontend code-splitting guard OK');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
