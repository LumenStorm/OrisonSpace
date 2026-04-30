# 目录树中文映射 + 顶部经典菜单栏改造计划

## 一、目录树：文件夹名中文映射

### 改动范围
- `apps/desktop/ui/src/features/project-tree/ProjectTree.tsx`
- `apps/desktop/ui/src/shared/i18n/zh-CN.yaml`
- `apps/desktop/ui/src/shared/i18n/en-US.yaml`

### 实现方式

在 ProjectTree 中新增一个 `displayNameMap`，将已知的文件夹/文件名映射为用户友好的显示名。映射通过 i18n 获取，英文环境下也有对应的友好名。

```typescript
// 映射表示例（实际值从 i18n 取）
const displayNameMap: Record<string, string> = {
  'chapters':      t('projectTree.chapters'),     // 章节
  'scenes':        t('projectTree.scenes'),        // 场景
  'assets':        t('projectTree.assetsDir'),     // 素材
  'project.yaml':  t('projectTree.projectConfig'), // 项目配置
};
```

修改 `FileTreeNode` 渲染逻辑：如果 `entry.name` 在映射表中有对应值，显示映射名；否则显示原始文件名。原始文件名通过 tooltip 展示，方便高级用户确认。

### i18n 新增 key

zh-CN:
```yaml
projectTree:
  chapters: "章节"
  scenes: "场景"
  assetsDir: "素材"
  projectConfig: "项目配置"
```

en-US:
```yaml
projectTree:
  chapters: "Chapters"
  scenes: "Scenes"
  assetsDir: "Assets"
  projectConfig: "Project Config"
```

---

## 二、顶部栏：经典下拉菜单栏

### 改动范围
- `apps/desktop/ui/src/features/top-bar/TopBar.tsx` — 重构为菜单栏
- `apps/desktop/ui/src/shared/styles/topbar.css` — 新增菜单样式
- `apps/desktop/ui/src/shared/i18n/zh-CN.yaml` — 新增菜单文案
- `apps/desktop/ui/src/shared/i18n/en-US.yaml` — 新增菜单文案

### 菜单结构

```
文件(F)          编辑(E)          视图(V)          帮助(H)
├─ 新建项目      ├─ 撤销 Ctrl+Z   ├─ 项目文件树     ├─ 关于
├─ 打开项目      ├─ 重做 Ctrl+⇧Z  ├─ 底部面板       └─ 快捷键
├─ 保存 Ctrl+S   └─ (未来扩展)    ├─ ─────────
├─ 导出                           ├─ 设置
├─ ─────────                      └─ 账户
└─ 返回项目列表
```

### 实现方式

1. TopBar 中把当前的图标按钮组替换为 4 个文字菜单按钮
2. 每个菜单按钮点击后展开一个绝对定位的下拉面板
3. 下拉面板中每个菜单项包含：文字标签 + 可选快捷键提示
4. 点击菜单项执行对应操作后自动关闭菜单
5. 点击菜单外区域关闭菜单
6. 保留 WindowControls（最小化/最大化/关闭）在最右侧
7. 保留品牌名 "Orison Space" 在最左侧
8. 设置和账户从 SideNav 底部移到「视图」菜单中（SideNav 底部的设置/账户按钮保留，两个入口并存）

### 菜单项与现有功能的对应

| 菜单项 | 对应现有操作 |
|--------|-------------|
| 新建项目 | `setShowNewDialog(true)` |
| 打开项目 | `handleOpen()` |
| 保存 | `handleSave()` |
| 导出 | 当前 disabled |
| 返回项目列表 | `closeProject()` |
| 撤销 | `undo()` |
| 重做 | `redo()` |
| 项目文件树 | `toggleProjectTree()` |
| 底部面板 | `toggleBottomPanel()` |
| 设置 | 打开 SettingsDialog |
| 账户 | 打开 AccountDialog |

### CSS 新增

- `.topbar-menu` — 菜单栏容器（flex 布局）
- `.topbar-menu-trigger` — 菜单按钮（文字，hover 高亮）
- `.topbar-menu-dropdown` — 下拉面板（绝对定位，阴影边框）
- `.topbar-menu-item` — 菜单项（文字 + 快捷键右对齐）
- `.topbar-menu-separator` — 分隔线

### i18n 新增 key

zh-CN:
```yaml
topbar:
  menuFile: "文件"
  menuEdit: "编辑"
  menuView: "视图"
  menuHelp: "帮助"
  newProject: "新建项目"
  openProject: "打开项目"
  backToProjects: "返回项目列表"
  toggleProjectTree: "项目文件树"
  toggleBottomPanel: "底部面板"
  about: "关于"
  shortcuts: "快捷键"
```

en-US:
```yaml
topbar:
  menuFile: "File"
  menuEdit: "Edit"
  menuView: "View"
  menuHelp: "Help"
  newProject: "New Project"
  openProject: "Open Project"
  backToProjects: "Back to Projects"
  toggleProjectTree: "Project Files"
  toggleBottomPanel: "Bottom Panel"
  about: "About"
  shortcuts: "Shortcuts"
```

---

## 三、文档同步

改造完成后更新 `docs/ui-design.md` 和 `design.md` 中对应的 TopBar 和 ProjectTree 描述。
