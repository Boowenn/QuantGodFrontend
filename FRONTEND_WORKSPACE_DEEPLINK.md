# Frontend Workspace Deep-link

本补丁为 QuantGodFrontend 增加轻量 router-like navigation，不引入 `vue-router`，只使用 `?workspace=` query 参数。

## 支持入口

```text
/?workspace=dashboard
/?workspace=mt5
/?workspace=governance
/?workspace=paramlab
/?workspace=research
/?workspace=evolution
/?workspace=backtest-ai
/?workspace=phase1
/?workspace=phase2
/?workspace=phase3
/?workspace=legacy
```

## 设计原则

- 默认入口仍为 `dashboard`。
- URL 中的非法 workspace 自动回退到 `dashboard`。
- 点击侧栏会使用 `history.pushState` 更新 URL。
- 浏览器前进/后退通过 `popstate` 同步 workspace。
- AppShell 提供当前 workspace 的复制链接按钮。
- 不新增后端 API，不改交易逻辑，不改 MT5 preset。
- 前端仍然通过 `/api/*` 获取数据，不直接读取 `/QuantGod_*.json` 或 `/QuantGod_*.csv`。

## 新增护栏

```bash
npm run deeplink
```

该护栏检查：

- `workspaceUrl.js` 存在并导出 URL 读写工具。
- `workspaceStore.js` 监听 `popstate`，并通过 `history.pushState` / `replaceState` 同步 URL。
- `AppShell.vue` 展示当前 workspace URL，并支持复制链接。
- 不引入 `vue-router`。
- 不出现组件级 `fetch()` 或本地 runtime 文件读取。
- CI 与 `package.json` 包含 `deeplink` guard。

## 验证命令

```bash
npm run git-blob-integrity
npm run remote-ci-integrity
npm run lf-integrity
npm run contract
npm run structure
npm run workspace-boundary
npm run domain-workspace
npm run deeplink
npm run dashboard-workspace
npm run mt5-workspace
npm run governance-workspace
npm run paramlab-workspace
npm run research-workspace
npm run legacy-deprecation
npm run legacy-slim
npm test
npm run build
node --check scripts/responsive_check.mjs
git diff --check
```
