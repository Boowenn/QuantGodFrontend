# QuantGod Frontend Domain Workspaces

本轮把 legacy 工作台中的主要业务域先提升为独立 workspace 入口：

- `src/workspaces/dashboard/DashboardWorkspace.vue`
- `src/workspaces/mt5/Mt5Workspace.vue`
- `src/workspaces/governance/GovernanceWorkspace.vue`
- `src/workspaces/paramlab/ParamLabWorkspace.vue`
- `src/workspaces/research/ResearchWorkspace.vue`
- `src/workspaces/evolution/EvolutionWorkspace.vue`

这不是一次高风险的模板抽取；`src/workspaces/legacy/LegacyWorkbench.vue` 仍然保留完整回退。新 workspace 使用 `src/services/domainApi.js` 通过 `/api/*` 拉取数据，避免前端直接读取 `QuantGod_*.json` 或 `QuantGod_*.csv`。

## 安全边界

- 不改 backend API。
- 不改 MT5 preset。
- 不改交易逻辑。
- 不增加任何 order / close / cancel 能力。
- 前端仍然只通过 `/api/*` 获取运行时数据。

## 新增 CI 护栏

```bash
npm run domain-workspace
```

该检查会确保：

1. 外汇业务域 workspace 都在 `src/workspaces/*` 下。
2. `workspaceRegistry.js` 注册了全部业务域。
3. `navigation.js` 以 `dashboard` 作为默认入口。
4. `domainApi.js` 只使用 `/api/*`，不直接读取 runtime JSON/CSV。
5. 业务域代码不会回流到 `src/components/*`。
