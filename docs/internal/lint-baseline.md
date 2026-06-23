# Lint Baseline 快照

> 生成于 2026-06-23，配套 commit：边界规则可执行化（A+B+C 第一轮）。
> 用途：作为 Phase D「存量违规只减不增」的基线。新代码命中 = 立即修；
> 下表数字只能下降，不能上升。CI 通过 `pnpm lint`（warning 不阻断，error 阻断）。

## 规则分级策略

| 类别 | 级别 | 说明 |
|---|---|---|
| 安全红线（agent 直连 provider / renderer 碰 electron-fs / local-bff） | **error** | 当前 0 命中，纯防回归。已验证规则确实会拦截。 |
| 结构边界（features/store 直连 `window.orisonDesktop`、裸 HTTP、shared→features 倒置） | **warn** | 存量 backlog，Phase D 分批清后逐项升 error。 |
| i18n 裸文本 | **warn** | 量大且非功能性，逐步清。 |
| 通用代码质量（unused-vars/expressions、control-regex 等） | **warn** | 留待后续 code-quality 专项升 error。 |

## ESLint warning 基线（共 252）

| 规则 | 数量 | 归属阶段 |
|---|---|---|
| `i18next/no-literal-string` | 138 | D（i18n 清理） |
| `no-restricted-syntax`（window.orisonDesktop 直连 + 裸 HTTP） | 73 | D（IPC 收口） |
| `@typescript-eslint/no-unused-vars` | 24 | 代码质量专项 |
| `@typescript-eslint/no-unused-expressions` | 7 | 代码质量专项 |
| `react-hooks/exhaustive-deps` | 3 | 代码质量专项 |
| `no-useless-escape` / `no-require-imports` / `no-control-regex` | 各 1 | 代码质量专项 |

## dependency-cruiser warning 基线（共 13）

| 规则 | 数量 | 归属阶段 |
|---|---|---|
| `no-circular`（agent runtime / shell toolHandlers 等内部环） | 12 | D（解环，需谨慎） |
| `no-shared-to-features`（`SettingsDialog`→`ModelSettingsPage`） | 1 | D（层级倒置修复） |

## error 基线
0。`pnpm lint` 退出码 0。

## 已验证规则真实生效
- agent 内写 `import axios` / `fetch(...)` → error（no-restricted-imports / no-restricted-globals）。
- 探针文件已删除，未留残留。
