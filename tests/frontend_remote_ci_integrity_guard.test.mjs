import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(process.cwd());
const guardSource = path.join(repoRoot, 'scripts', 'frontend_remote_ci_integrity_guard.mjs');

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'qg-frontend-remote-ci-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'tests'), { recursive: true });
  mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  cpSync(guardSource, path.join(root, 'scripts', 'frontend_remote_ci_integrity_guard.mjs'));
  return root;
}

function runGuard(root) {
  return spawnSync('node', ['scripts/frontend_remote_ci_integrity_guard.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function multilineScript(extra = '') {
  return [
    "import process from 'node:process';",
    'const failures = [];',
    'function assert(condition, message) {',
    '  if (!condition) failures.push(message);',
    '}',
    'assert(true, "ok");',
    ...Array.from({ length: 45 }, (_, idx) => `const line${idx} = ${idx};`),
    extra,
    'if (failures.length) {',
    '  process.exit(1);',
    '}',
    'console.log("ok");',
    '',
  ].join('\n');
}

function writeBaseline(root) {
  const scripts = {
    'frontend_api_contract_guard.mjs': multilineScript(),
    'frontend_structure_guard.mjs': multilineScript(),
    'frontend_workspace_boundary_guard.mjs': multilineScript(),
    'frontend_domain_workspace_guard.mjs': multilineScript(),
    'frontend_dashboard_workspace_guard.mjs': multilineScript(),
    'frontend_mt5_workspace_guard.mjs': multilineScript(),
    'frontend_governance_workspace_guard.mjs': multilineScript(),
    'frontend_paramlab_workspace_guard.mjs': multilineScript(),
    'frontend_research_workspace_guard.mjs': multilineScript(),
    'frontend_legacy_deprecation_guard.mjs': multilineScript(),
    'frontend_lf_integrity_guard.mjs': multilineScript(),
    'frontend_legacy_slim_guard.mjs': multilineScript(),
  };
  for (const [name, content] of Object.entries(scripts)) {
    writeFileSync(path.join(root, 'scripts', name), content);
  }

  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          'responsive:check': 'node scripts/responsive_check.mjs',
          contract: 'node scripts/frontend_api_contract_guard.mjs',
          test: 'node --test tests/*.mjs',
          structure: 'node scripts/frontend_structure_guard.mjs',
          'workspace-boundary': 'node scripts/frontend_workspace_boundary_guard.mjs',
          'domain-workspace': 'node scripts/frontend_domain_workspace_guard.mjs',
          'dashboard-workspace': 'node scripts/frontend_dashboard_workspace_guard.mjs',
          'mt5-workspace': 'node scripts/frontend_mt5_workspace_guard.mjs',
          'governance-workspace': 'node scripts/frontend_governance_workspace_guard.mjs',
          'paramlab-workspace': 'node scripts/frontend_paramlab_workspace_guard.mjs',
          'research-workspace': 'node scripts/frontend_research_workspace_guard.mjs',
          'legacy-deprecation': 'node scripts/frontend_legacy_deprecation_guard.mjs',
          'lf-integrity': 'node scripts/frontend_lf_integrity_guard.mjs',
          'legacy-slim': 'node scripts/frontend_legacy_slim_guard.mjs',
          'remote-ci-integrity': 'node scripts/frontend_remote_ci_integrity_guard.mjs',
        },
        dependencies: {
          vue: '^3.5.13',
          'ant-design-vue': '^4.2.6',
          klinecharts: '^9.8.12',
          'lucide-vue-next': '^0.468.0',
          'monaco-editor': '^0.52.2',
        },
        devDependencies: {
          vite: '^6.0.7',
          '@vitejs/plugin-vue': '^5.2.1',
        },
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    path.join(root, '.github/workflows/ci.yml'),
    [
      'name: QuantGod Frontend CI',
      '',
      'on:',
      '  push:',
      '    branches: [main]',
      '  pull_request:',
      '    branches: [main]',
      '',
      'permissions:',
      '  contents: read',
      '',
      'concurrency:',
      '  group: quantgod-frontend-ci-${{ github.ref }}',
      '  cancel-in-progress: true',
      '',
      'jobs:',
      '  build:',
      '    name: Vue build and frontend contract guards',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - uses: actions/checkout@v4',
      '      - uses: actions/setup-node@v4',
      '        with:',
      '          node-version: "22"',
      '          cache: npm',
      '      - name: Install dependencies',
      '        run: npm install',
      '      - name: Remote CI integrity guard',
      '        run: npm run remote-ci-integrity',
      '      - name: LF integrity guard',
      '        run: npm run lf-integrity',
      '      - name: API contract guard',
      '        run: npm run contract',
      '      - name: Structure guard',
      '        run: npm run structure',
      '      - name: Workspace boundary guard',
      '        run: npm run workspace-boundary',
      '      - name: Domain workspace guard',
      '        run: npm run domain-workspace',
      '      - name: Dashboard workspace guard',
      '        run: npm run dashboard-workspace',
      '      - name: MT5 workspace guard',
      '        run: npm run mt5-workspace',
      '      - name: Governance workspace guard',
      '        run: npm run governance-workspace',
      '      - name: ParamLab workspace guard',
      '        run: npm run paramlab-workspace',
      '      - name: Research workspace guard',
      '        run: npm run research-workspace',
      '      - name: Legacy deprecation guard',
      '        run: npm run legacy-deprecation',
      '      - name: Legacy slim guard',
      '        run: npm run legacy-slim',
      '      - name: Unit tests',
      '        run: npm test',
      '      - name: Build',
      '        run: npm run build',
      '',
    ].join('\n'),
  );

  writeFileSync(path.join(root, 'src/App.vue'), "<template>\n  <AppShell />\n</template>\n<script setup>\nimport AppShell from './app/AppShell.vue';\n</script>\n");
  const testNames = [
    'frontend_api_contract_guard.test.mjs',
    'frontend_structure_guard.test.mjs',
    'frontend_workspace_boundary_guard.test.mjs',
    'frontend_domain_workspace_guard.test.mjs',
    'frontend_dashboard_workspace_guard.test.mjs',
    'frontend_mt5_workspace_guard.test.mjs',
    'frontend_governance_workspace_guard.test.mjs',
    'frontend_paramlab_workspace_guard.test.mjs',
    'frontend_research_workspace_guard.test.mjs',
    'frontend_code_splitting_guard.test.mjs',
  ];
  for (const name of testNames) {
    writeFileSync(
      path.join(root, 'tests', name),
      "import test from 'node:test';\nimport assert from 'node:assert/strict';\n" +
        'test("ok", () => assert.equal(1, 1));\n'.repeat(10),
    );
  }
}

test('rejects compressed workflow and hashbang no-op guards', () => {
  const root = makeRepo();
  try {
    writeBaseline(root);
    writeFileSync(path.join(root, '.github/workflows/ci.yml'), 'name: QuantGod Frontend CI on: push jobs: build: run: npm test\n');
    writeFileSync(path.join(root, 'scripts/frontend_api_contract_guard.mjs'), '#!/usr/bin/env node import process from "node:process"; console.log("hidden");');
    const result = runGuard(root);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}${result.stdout}`, /compressed|hashbang|single-line/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepts multiline CI and executable guard scripts', () => {
  const root = makeRepo();
  try {
    writeBaseline(root);
    const result = runGuard(root);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requires package script and CI step for remote-ci-integrity', () => {
  const root = makeRepo();
  try {
    writeBaseline(root);
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    delete pkg.scripts['remote-ci-integrity'];
    writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    const result = runGuard(root);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}${result.stdout}`, /remote-ci-integrity/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
