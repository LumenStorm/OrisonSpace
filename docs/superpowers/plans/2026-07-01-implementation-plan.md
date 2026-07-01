# 实施方案：Settings Center + Agent Panel 双入口 + Lint 清理

日期：2026-07-01

---

## 工作项总览

| # | 模块 | 范围 | 预估复杂度 |
|---|------|------|-----------|
| 1 | Settings Center 扩展 | 新增 Writing / Agent / Appearance 三个页面 | 中 |
| 2 | Agent Panel 双入口 | Settings 完整管理 + Agent Panel 快捷开关联动 | 低 |
| 3 | Lint 清理 | 244 warnings → 0 | 低 |

> 资产库升级暂缓，后续单独讨论。

---

## 1. Settings Center 扩展

### 当前结构
- `SettingsDialog.tsx` 扁平列表导航：`general` | `model` | `about`
- 数据持久化：`~/.orison/user/preferences.yaml`（UserPreferencesConfig）
- 模型配置独立存储：`~/.orison/model/keys/*.yaml`

### 新增页面

#### 1.1 Writing（写作设置）

导航 ID: `writing` | 图标: `edit_note`

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 自动保存开关 | toggle | true | 当前 autoSaveSlice 无持久化，需补充 |
| 自动保存间隔 | select (1s/3s/5s/10s) | 1.5s | 当前硬编码在 useAutoSave 的 debounce 中 |
| 默认章节前缀 | input | "ch-" | 新建章节时的文件名前缀 |
| 段落缩进模式 | select (首行缩进/无缩进) | 首行缩进 | 影响编辑器渲染 |
| 写作字数统计 | toggle | true | 底栏是否显示实时字数 |

#### 1.2 Agent（Agent 设置）

导航 ID: `agent` | 图标: `smart_toy`

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 默认补丁模式 | select (suggest/auto) | suggest | 即现有 autoApplyPatches，改名更直观 |
| 会话保留数量 | number | 50 | 超出自动清理旧会话 |
| 默认会话模型 | model-selector | 跟随全局 | agent 默认使用的模型 ref |

#### 1.3 Appearance（外观设置）

导航 ID: `appearance` | 图标: `palette`

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 主题 | 3-way (system/light/dark) | system | 从 General 迁移过来 |
| UI 密度 | select (紧凑/默认/宽松) | 默认 | 控制间距 scale |
| 侧边栏宽度 | slider | 240px | 持久化侧边栏默认宽度 |
| 编辑器行高 | select (1.5/1.75/2.0) | 1.75 | 正文行高 |

> **General 页面瘦身**：主题迁移到 Appearance 后，General 保留：语言、阅读字体（family/weight/scale）、更新检查。

### 实现步骤

1. **扩展 UserPreferencesConfig**（shared-contracts/ipc.ts）— 新增字段
2. **扩展 settingsSlice** — 新增 state + setters + persist
3. **新建页面组件** — `WritingSettingsPage.tsx`、`AgentSettingsPage.tsx`、`AppearanceSettingsPage.tsx`
4. **修改 SettingsDialog** — SETTINGS_PAGES 数组加入新页面，调整 General
5. **hook 侧联动** — useAutoSave 读取 settings 中的间隔值；agent session 读取默认模型/模式

---

## 2. Agent Panel 双入口联动

### 方案 C 实现

| 入口 | 位置 | 功能 |
|------|------|------|
| 完整管理 | Settings > Agent 页面 | 默认模式、确认策略、会话保留、默认模型 |
| 快捷开关 | Agent Panel > settings 视图 | Skills 包开关、单技能开关、MCP 连接状态 |

### 联动机制

- 两个入口共享同一个 Zustand store（`agentSettingsSlice` + `settingsSlice`）
- Settings > Agent 修改 `autoApplyPatches` / 默认模型 → Agent Panel 即时反映
- Agent Panel toggle skill → Settings > Agent 页面如果打开也能看到同步状态
- 不需要额外事件总线，Zustand subscription 天然同步

### 实现步骤

1. Settings > Agent 页面新建 `AgentSettingsPage.tsx`（在 settings 目录下）
2. 把全局性 agent 配置项（模式、确认策略、会话保留、默认模型）放这里
3. Agent Panel 的 `AgentSettings.tsx` 保持现有 Skills/MCP 快捷管理
4. 两者通过 store 中同一份 state 联动，无需手动同步

---

## 3. Lint 清理

- 当前 244 warnings（基线 252，已降 8）
- 主要来源：unused imports、unused vars、any types、dep-cruiser boundary violations
- 策略：按 package 逐个清理，typecheck + lint 全绿后提交

### 执行顺序

1. `packages/shared-contracts` — 最底层，无外部依赖
2. `packages/model-protocols`
3. `packages/story-sync`
4. `apps/desktop/agent`
5. `apps/desktop/client/shell`
6. `apps/desktop/client/ui`

---

## 总体实施顺序

```
Phase A: Settings Center (1-2天)
  ├── A1: 扩展 UserPreferencesConfig + settingsSlice
  ├── A2: Appearance 页面（含 General 瘦身）
  ├── A3: Writing 页面
  └── A4: Agent 页面（含双入口联动）

Phase B: Lint 清理 (0.5天)
  └── 逐包清理 → CI 全绿
```

---

## 需确认 / 待定

（已确认，无待定项）

## 决策记录

- Appearance 第一版不做强调色自定义，沿用 default/light/dark 三主题
- Agent 设置第一版只暴露 suggest/auto 模式切换，确认策略后续迭代
- 资产库升级暂缓，后续单独讨论
