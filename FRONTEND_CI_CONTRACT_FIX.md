# QuantGodFrontend CI / API Contract Guard 修复

这次修复用于四仓库拆分后的前端仓库加固，目标是让前端 CI 真正检查 Phase 2 约定：Vue 前端只能通过 `/api/*` 访问 QuantGodBackend，不再直接读取 `QuantGod_*.json` 或 `QuantGod_*.csv` 运行时文件。

## 修复内容

- 新增 `scripts/frontend_api_contract_guard.mjs`。
- 新增 `tests/frontend_api_contract_guard.test.mjs`。
- 更新 `.github/workflows/ci.yml`：在 build 前先跑 contract guard 和 Node 单测。
- 更新 `package.json` scripts：
  - `npm run contract`
  - `npm test`
- 清理 `src/services/api.js` 中的 daily review / daily autopilot 直接 JSON fallback。
- 继续检查前端仓库拆分边界：不允许出现 `Dashboard/`、`MQL5/`、`tools/`。

## 本地验证

```powershell
cd C:\QuantGod\QuantGodFrontend
npm install
npm run contract
npm test
npm run build
node --check scripts\responsive_check.mjs
```

## Contract guard 规则

`frontend_api_contract_guard.mjs` 会扫描 `src/` 下的 `.js/.mjs/.ts/.vue/.jsx/.tsx` 文件，并拦截：

1. 直接引用 `/QuantGod_*.json` 或 `/QuantGod_*.csv`。
2. 非 `/api/*` 的本地 `fetch('/...')`。
3. UI 组件里直接调用 `fetch()`；组件应该调用 `src/services/*` 中的 service wrapper。
4. 前端仓库里残留 backend/infra 目录。

## 安全边界

这个修复只增强前端 CI 和服务层约束，不修改交易逻辑，不接触 MT5 preset，不发送订单，不平仓，不绕过 Kill Switch、authorization lock 或 dry-run 边界。
