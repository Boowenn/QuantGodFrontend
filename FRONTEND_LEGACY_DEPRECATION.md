# QuantGod Frontend Legacy Deprecation Guard

本轮已经完成 LegacyWorkbench 的完整源码移除，不再保留 fallback-only 入口。

## 背景

当前 frontend 已经完成：

- AppShell 模块化入口。
- Phase 1 / 2 / 3 workspace 迁移。
- 6 个业务域 workspace 第一层 parity。
- 业务域 guard 矩阵。

此前 `src/workspaces/legacy/LegacyWorkbench.vue` 和 `archive/legacy-workbench/LegacyWorkbenchFull.vue` 只用于迁移对照。独立外汇业务域完成接入后，旧工作台已经不再作为运行时代码或 archive 源码保留。

## 本轮新增

- `scripts/frontend_legacy_deprecation_guard.mjs`
- `tests/frontend_legacy_deprecation_guard.test.mjs`
- `npm run legacy-deprecation`
- CI 中新增 Legacy deprecation guard

## Guard 检查内容

- `src/workspaces/legacy` 不允许存在。
- `archive/legacy-workbench/LegacyWorkbenchFull.vue` 不允许存在。
- 任何 active source 不允许 import 或引用 LegacyWorkbench。
- Legacy 不能成为默认 workspace。
- 当前外汇业务域 workspace 必须存在。
- CI 必须运行 `npm run legacy-deprecation`。
- 业务域 workspace 不能直接 `fetch()` 或读取 `/QuantGod_*.json/csv`。

## 验证命令

```bash
npm run contract
npm run structure
npm run workspace-boundary
npm run domain-workspace
npm run dashboard-workspace
npm run mt5-workspace
npm run governance-workspace
npm run paramlab-workspace
npm run research-workspace
npm run legacy-deprecation
npm test
npm run build
node --check scripts/responsive_check.mjs
git diff --check
```

## 下一步

后续只允许在独立业务域 workspace 内新增功能，不再恢复 legacy workbench。

每一步都保留可回滚提交，不跨域混改。
