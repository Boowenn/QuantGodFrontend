# Frontend Remote CI Integrity Fix

这轮修复专门处理 GitHub raw / Actions 端看到的单行 CI 与 hashbang guard no-op 风险。

## 修复内容

- `.github/workflows/ci.yml` 重写成真实多行 YAML。
- `package.json` pretty-print，并增加 `npm run remote-ci-integrity`。
- `scripts/*.mjs` 移除 hashbang，并将压缩单行 guard 拆成多行。
- `tests/*.mjs` 拆成多行，便于 review。
- 新增 `frontend_remote_ci_integrity_guard.mjs`，防止 CI/workflow/package/guard 再次压缩成单行。

## 验证

```bash
npm run remote-ci-integrity
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
npm run legacy-slim
npm test
npm run build
```
