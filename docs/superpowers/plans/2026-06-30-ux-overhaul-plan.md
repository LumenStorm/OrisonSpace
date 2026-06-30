# Orison Space UX 重构与产品化对齐计划

> **For agentic workers:** 需求对齐 + 实施计划。执行前先阅读本文，与 owner 确认范围后再动手。

**Owner 确认项（需回复）：**
1. 大纲界面重构的范围：只修 CSS 样式，还是连交互布局一起调整？
2. Phase 3 设置中心：General/Appearance/Writing/Export/Backup/Privacy 是做成真实配置页还是先占位？
3. Phase 7 Agent Workbench：子代理嵌套事件 UI 升级为树状（需要较多工作量），还是先保持 badge 标注？
4. Phase 4 备份恢复：自动保存已有，是否需要做快照/版本历史？

---

## 项目当前状态总览

### CI 质量
- `pnpm typecheck` ✅ 全绿
- `pnpm test` ✅ 全绿（7 packages，53 tests passed）
- `pnpm lint` ⚠️ 244 warnings（baseline 252，下降 8）
  - ESLint: 244（多为 i18n 裸文本、window.orisonDesktop 直连）
  - dependency-cruiser: 13 warnings（全为 `no-circular` 工具链内部循环）

### 文档与信任面
- README / CHANGELOG / SECURITY ✅ 版本号一致，mojibake 已清
- License ✅ Apache-2.0
- README 截图 ⚠️ 仍为 TODO 占位

---

## P0 阻塞项（必须修）

### P0-1：`mockFileContents` 残留

**位置：** `apps/desktop/client/ui/src/features/project-tree/ProjectTree.tsx`
**问题：** 打开失败时降级到 demo mock 内容，用户看不见真实错误
**状态：** ⚠️ 未处理

```ts
// 当前：真实项目失败时 fallback 到 demo
openFile(entry.path, entry.name, mockFileContents[entry.path] ?? '');
```
**修复：** 移除 mock fallback，失败时展示空状态或错误提示

---

### P0-2：`mockClips` 残留

**位置：** `apps/desktop/client/ui/src/features/editor/VideoEditor.tsx`
**问题：** 硬编码显示假视频片段，无真实生成逻辑
**状态：** ⚠️ 未处理

```tsx
// 当前：固定假数据
const mockClips = [{id: 'Shot 01', ...}, ...];
```
**修复：** 移除 mockClips，展示空状态或调用真实生成 API

---

## P1 待处理

### P1-1：IPC Data Flow Cleanup（data-flow-ipc-cleanup.md）

| Task | 内容 | 状态 |
|------|------|------|
| Task 1 | `applyAgentFieldPatch` BFF 函数 | ❌ 未实现 |
| Task 2 | `field:apply-agent-patch` IPC 注册 | ❌ 未实现 |
| Task 4 | `searchProject` preload 暴露 | ✅ 已完成 |
| Task 7 | 保存失败正确抛出异常 | ❌ 仍是 `return {ok:false}` |
| Task 8 | `desktopIpcSchema` 与实际 surface 对齐 | ❌ 仅 25/45 channels |

---

### P1-2：质量门禁

- 244 ESLint warnings（baseline 252）— 有改善但未清零
- 建议：i18n 裸文本、window.orisonDesktop 直连分批清理
- 暂不升为 error，保持 warning 逐步收敛

---

## Phase 3：设置中心（需要做）

**当前状态：** 无统一 Settings 页面
- ✅ `ModelSettingsPage` — API Key / 模型发现 / 连接测试完整
- ✅ `AgentSettings` — Skills 启用禁用完整
- ⚠️ MCP / Plugins — 占位文本
- ❌ General / Appearance / Writing / Export / Backup / Privacy — 不存在

**建议范围：**
1. 创建统一 Settings 入口页（左侧导航 + 内容区）
2. General / Appearance / Writing / Export / Backup / Privacy 先做骨架 + 真实数据绑定（用现有 `useAppStore` 的 `preferences`）
3. Backup 优先接入自动保存状态（已有 `autoSaveSlice`）

---

## Phase 4：备份恢复（需要做）

**当前状态：**
- ✅ `useAutoSave` + `autoSaveSlice` 真实可用（1500ms debounce，状态指示器）
- ❌ 快照/版本历史/备份包/关闭守卫 — 不存在

**建议范围：**
1. 关闭守卫（已有 `onBeforeClose` IPC，用它做未保存提示）
2. 基于时间线的版本快照（复用 `gitIpc` 的 commit 能力作为快照）
3. 项目健康检查（读取 project.yaml 校验完整性）

---

## Phase 7：Agent Workbench（需要做）

**当前状态：**
- ✅ 流式输出 / Typewriter / Tool Card / Diff Card / Confirm Card
- ✅ Agent session 管理（create/stream/abort/history）
- ✅ Skill 包列表 + 启用禁用
- ⚠️ Child 嵌套事件：badge 标注，非树状折叠
- ❌ 子代理 `tools`/`model` frontmatter 未接入真实路由

**建议范围：**
1. Child 事件升级为可折叠树状（`<details>/<summary>` 或缩进层级）
2. 子代理 model routing（接入 model gateway）
3. 子代理 tools 权限收紧（接入 tool registry）

---

## 大纲界面重构（核心任务）

### 当前问题

**OutlineEditor** 使用自定义 CSS 类（`.outline-*`），但这些样式完全不存在于任何 CSS 文件中。

对比其他组件：
- `AgentPanel` → `agent-panel.css`（1253 行，完整 token 系统覆盖）
- `TiptapEditor` → `tiptap.css`（完整 toolbar/content 样式）
- `AssetsPanel` → `workspace.css`（完整设计系统覆盖）
- `OutlineEditor` → **无对应 CSS 文件** ❌

### 现有设计系统分析

项目有一套完整 token 系统：
- CSS Variables：`tokens.css`（surface / accent / border / input / error / chip 等）
- 半径系统：`scales.css`
- 组件层：`components.css`（按钮 / 输入框 / 卡片 / 列表 / 空状态）
- 面板层：`workspace.css`（workspace / bottom-panel / agent-side-tab）

### 重构方向

1. **创建 `editor/outline.css`** — 用 CSS Variables 重写所有 `.outline-*` 类
2. **参考 `agent-panel.css` 的 token 使用方式** — 保持 `--surface` / `--accent` / `--border-default` 一致
3. **参考 `workspace.css` 的面板样式** — bottom-panel / section-header / card 模式

---

## 待确认的 Scope

请回复以下问题以确定实施范围：

1. **大纲界面**：只修 CSS 样式让大纲界面符合现有设计系统，还是允许小幅调整交互布局（比如 phase track 的视觉权重、detail pane 的位置）？

2. **设置中心**：General / Appearance / Writing / Export / Backup / Privacy 做真实配置页，还是先占位但保证不报错？

3. **Agent 嵌套事件**：升级为树状折叠 vs 保持 badge，哪个是期望的最终状态？

4. **备份恢复**：快照/版本历史 是否在本次范围内？

---

## 实施顺序建议

```
1. P0-1: mockFileContents 残留（简单，直接修）
2. P0-2: mockClips 残留（简单，直接修）
3. 大纲界面重构（主要工作，CSS 新建 + Token 对齐）
4. Phase 3 设置中心骨架（中等，需要 UI 框架）
5. Phase 4 备份恢复（关闭守卫 + 健康检查）
6. Phase 7 Agent 嵌套事件树状（较大，UI 层级改造）
7. P1-1 IPC cleanup tasks（需要理解数据流）
8. README 截图（人工验收后补）
```
