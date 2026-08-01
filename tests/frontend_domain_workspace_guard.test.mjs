import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkProject, DOMAIN_WORKSPACES } from '../scripts/frontend_domain_workspace_guard.mjs';

function write(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-domain-workspace-'));
  for (const [key, entry] of Object.entries(DOMAIN_WORKSPACES)) {
    write(path.join(root, 'src', 'workspaces', key, entry), '<template><div /></template>');
  }
  write(
    path.join(root, 'src', 'app', 'workspaceRegistry.js'),
    `
import DashboardWorkspace from '../workspaces/dashboard/DashboardWorkspace.vue';
import Mt5Workspace from '../workspaces/mt5/Mt5Workspace.vue';
import EvolutionWorkspace from '../workspaces/evolution/EvolutionWorkspace.vue';
import GovernanceWorkspace from '../workspaces/governance/GovernanceWorkspace.vue';
import ParamLabWorkspace from '../workspaces/paramlab/ParamLabWorkspace.vue';
import ResearchWorkspace from '../workspaces/research/ResearchWorkspace.vue';
export const WORKSPACE_COMPONENTS = { dashboard: DashboardWorkspace, mt5: Mt5Workspace, evolution: EvolutionWorkspace, governance: GovernanceWorkspace, paramlab: ParamLabWorkspace, research: ResearchWorkspace };
`,
  );
  write(
    path.join(root, 'src', 'app', 'navigation.js'),
    `
export const DEFAULT_WORKSPACE = 'dashboard';
export const WORKSPACE_GROUPS = [{ items: [
  { key: 'dashboard' }, { key: 'mt5' }, { key: 'evolution' }
] }];
export const HIDDEN_WORKSPACES = [{ key: 'governance' }, { key: 'paramlab' }, { key: 'research' }];
`,
  );
  write(
    path.join(root, 'src', 'services', 'domainApi.js'),
    `
export async function loadDashboardWorkspace() { return fetch('/api/latest'); }
export async function loadMt5Workspace() { return fetch('/api/mt5-readonly/status'); }
export async function loadGovernanceWorkspace() { return fetch('/api/governance/advisor'); }
export async function loadParamLabWorkspace() { return fetch('/api/paramlab/status'); }
export async function loadResearchWorkspace() { return fetch('/api/research/stats'); }
`,
  );
  return root;
}

test('accepts first-class domain workspaces', () => {
  const root = makeFixture();
  assert.deepEqual(checkProject(root), []);
});

test('rejects missing domain workspace entry', () => {
  const root = makeFixture();
  fs.rmSync(path.join(root, 'src', 'workspaces', 'governance', 'GovernanceWorkspace.vue'));
  assert.match(checkProject(root).join('\n'), /governance\/GovernanceWorkspace\.vue/);
});

test('rejects direct QuantGod runtime file reads', () => {
  const root = makeFixture();
  write(
    path.join(root, 'src', 'services', 'domainApi.js'),
    `
export async function loadDashboardWorkspace() { return fetch('/QuantGod_Dashboard.json'); }
export async function loadMt5Workspace() { return fetch('/api/mt5-readonly/status'); }
export async function loadGovernanceWorkspace() { return fetch('/api/governance/advisor'); }
export async function loadParamLabWorkspace() { return fetch('/api/paramlab/status'); }
export async function loadResearchWorkspace() { return fetch('/api/research/stats'); }
`,
  );
  assert.match(checkProject(root).join('\n'), /QuantGod runtime file path|non-\/api fetch/);
});

test('rejects a retired non-Forex lane in the domain API', () => {
  const root = makeFixture();
  write(
    path.join(root, 'src', 'services', 'domainApi.js'),
    `
export async function loadDashboardWorkspace() { return fetch('/api/crypto/status'); }
export async function loadMt5Workspace() { return fetch('/api/mt5-readonly/status'); }
export async function loadGovernanceWorkspace() { return fetch('/api/governance/advisor'); }
export async function loadParamLabWorkspace() { return fetch('/api/paramlab/status'); }
export async function loadResearchWorkspace() { return fetch('/api/research/stats'); }
`,
  );
  assert.match(checkProject(root).join('\n'), /retired non-Forex lane/);
});

test('rejects domain directories under generic components', () => {
  const root = makeFixture();
  write(path.join(root, 'src', 'components', 'mt5', 'Mt5Workspace.vue'), '<template><div /></template>');
  assert.match(checkProject(root).join('\n'), /components\/mt5/);
});

test('rejects archived tool workspaces in primary navigation', () => {
  const root = makeFixture();
  write(
    path.join(root, 'src', 'app', 'navigation.js'),
    `
export const DEFAULT_WORKSPACE = 'dashboard';
export const WORKSPACE_GROUPS = [{ items: [
  { key: 'dashboard' }, { key: 'mt5' }, { key: 'evolution' }, { key: 'governance' }
] }];
export const HIDDEN_WORKSPACES = [{ key: 'paramlab' }, { key: 'research' }];
`,
  );
  assert.match(checkProject(root).join('\n'), /governance must not be in primary navigation/);
});

test('rejects archived tool workspaces without hidden deep-link metadata', () => {
  const root = makeFixture();
  write(
    path.join(root, 'src', 'app', 'navigation.js'),
    `
export const DEFAULT_WORKSPACE = 'dashboard';
export const WORKSPACE_GROUPS = [{ items: [
  { key: 'dashboard' }, { key: 'mt5' }, { key: 'evolution' }
] }];
export const HIDDEN_WORKSPACES = [{ key: 'governance' }, { key: 'research' }];
`,
  );
  assert.match(checkProject(root).join('\n'), /paramlab must remain available as a hidden deep-link/);
});
