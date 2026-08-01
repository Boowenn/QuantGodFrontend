import { defineAsyncComponent } from 'vue';
import { DEFAULT_WORKSPACE, FLAT_WORKSPACES, findWorkspace } from './navigation.js';

function lazyWorkspace(loader) {
  return defineAsyncComponent({
    loader,
    delay: 80,
    timeout: 30000,
  });
}

export const WORKSPACE_COMPONENTS = {
  dashboard: lazyWorkspace(() => import('../workspaces/dashboard/DashboardWorkspace.vue')),
  mt5: lazyWorkspace(() => import('../workspaces/mt5/Mt5Workspace.vue')),
  evolution: lazyWorkspace(() => import('../workspaces/evolution/EvolutionWorkspace.vue')),
  governance: lazyWorkspace(() => import('../workspaces/governance/GovernanceWorkspace.vue')),
  paramlab: lazyWorkspace(() => import('../workspaces/paramlab/ParamLabWorkspace.vue')),
  research: lazyWorkspace(() => import('../workspaces/research/ResearchWorkspace.vue')),
  'backtest-ai': lazyWorkspace(() => import('../workspaces/backtest-ai/BacktestAiWorkspace.vue')),
  phase1: lazyWorkspace(() => import('../workspaces/phase1/Phase1Workspace.vue')),
  phase2: lazyWorkspace(() => import('../workspaces/phase2/Phase2OperationsWorkspace.vue')),
  phase3: lazyWorkspace(() => import('../workspaces/phase3/Phase3Workspace.vue')),
};

export function resolveWorkspaceComponent(key) {
  return WORKSPACE_COMPONENTS[key] || WORKSPACE_COMPONENTS[DEFAULT_WORKSPACE];
}

export function workspaceMeta(key) {
  return findWorkspace(key);
}

export function workspaceExists(key) {
  return Boolean(WORKSPACE_COMPONENTS[key]) && FLAT_WORKSPACES.some((workspace) => workspace.key === key);
}
