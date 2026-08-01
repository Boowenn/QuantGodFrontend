# Frontend P0 工具链

本次增量把前端基础工程工具链接进 CI：ESLint、Prettier、Stylelint、Vitest 和 Vue Test Utils。

## 当前范围

这一步先覆盖 UX Foundation、新增共享组件、轻量 i18n、数字格式化、命令面板和相关 guard。历史工作台文件保持原样，避免为了启用工具链引入大规模格式化噪声。

## 命令

```bash
npm run lint
npm run format:check
npm run stylelint
npm run test:unit
npm run p0-toolchain
```

`npm run p0-toolchain` 会串行执行 lint、format check、stylelint 和 Vitest 单元测试。

## CI 规则

Frontend CI 现在会在原有只读 API contract、workspace guard、legacy guard、Node 测试和 build 之外，额外执行：

```bash
npm run ux-foundation
npm run p0-toolchain
```

这些检查只约束前端源码，不允许新增 MT5、Backend tools 或本地 runtime 数据读取。

## 后续扩展

下一轮可以按目录逐步扩大检查范围：

1. `src/workspaces/dashboard`
2. `src/workspaces/mt5`
3. `src/workspaces/paramlab`
4. `src/workspaces/phase1` / `phase2` / `phase3`

每次扩大范围时先修局部问题，再把对应目录加入 `package.json` 的脚本，避免一次性把历史债务全压进一个提交。
