# Frontend LF Integrity Guard

本轮只处理前端仓库的换行和 CI 有效性，不修改业务逻辑。

## 背景

GitHub raw 视图里多个 guard 脚本可能显示为单行 hashbang。如果文件实际是 CR-only，Node 会把整份脚本视为 hashbang 注释，导致 CI 步骤看似执行但实际 no-op。

## 本轮新增

- `scripts/frontend_lf_integrity_guard.mjs`
- `tests/frontend_lf_integrity_guard.test.mjs`
- `npm run lf-integrity`
- CI 中新增 LF integrity guard

## 检查内容

1. `scripts/`、`tests/`、`src/`、workflow、package 文件不能含有 `
`。
2. hashbang 脚本必须在第一行后存在真实 LF。
3. 关键 guard/test/workflow 文件必须超过最低行数，防止被压缩成 no-op。
4. `src/App.vue` 仍必须保持轻量。
5. Legacy fallback 仍必须存在，后续才能逐域删除重复 UI。

## 验证命令

```bash
npm run lf-integrity
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
