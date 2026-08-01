# Frontend UX Foundation Upgrade

This change starts the frontend upgrade plan from the design document without changing the QuantGod safety model.

## Scope

Added:

- CSS design tokens and theme variables.
- Dark / light / high-contrast theme switching.
- zh-CN / en-US locale resources for new UX surfaces.
- Global operator command palette and keyboard shortcuts.
- Number formatting utilities with tabular numeric rendering.
- Shared KPI / empty / loading / error / mini sparkline components.
- Dashboard operator scan panel with KPI, alert, health, and position snapshot widgets.
- Static guard for the new UX foundation files.

Not added:

- Billing or membership.
- Quick trade panel.
- Trading command controls.
- Credential storage.
- Direct `QuantGod_*.json` or CSV file reads.
- External dependencies that would require package-lock churn.

## Keyboard shortcuts

- `/`: open command palette.
- `?`: open command palette/help.
- `g d`: dashboard.
- `g m`: MT5.
- `g r`: research.
- `g p`: ParamLab.
- `g e`: Evolution.
- `g v`: Phase 3 AI/Vibe.

## Verification

```powershell
npm run ux-foundation
npm test
npm run build
npm run responsive:check
```

## Follow-up

The next frontend layer can safely add real `vue-i18n`, Pinia, Vitest, and heavier dashboard widgets once package-lock and CI dependency policy are updated deliberately.
