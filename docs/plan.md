# Plan: 项目页网格布局 + 项目类型 + 动态侧栏

## 1. ProjectMeta 增加 type 字段

`appStore.ts` 中 `ProjectMeta` 增加 `type: 'novel' | 'script'`，影响：
- `openProject(project)` 接收带 type 的对象
- TopBar 的 handleCreate 也需要传 type

## 2. ProjectsPage 改为网格卡片布局

去掉当前的 header + 列表布局，改为全屏网格：
- 第一格：新建项目卡片（点击弹出对话框，含名称 + 类型选择）
- 后续格：已有项目卡片（显示项目名 + 类型标签）
- 网格使用 `auto-fill, minmax(200px, 1fr)` 响应式排列
- 去掉 projects-header（登出已在侧栏，但项目页没有侧栏，所以保留简单的用户信息）

## 3. 新建项目对话框增加类型选择

TopBar 和 ProjectsPage 的新建对话框都加上 novel/script 选择按钮（类似 auth-tabs 样式）。

## 4. SideNav 根据项目类型动态渲染

当前固定4项：outline / script / storyboard / video
改为根据 `currentProject.type` 动态生成：
- `novel` → 大纲(outline) / 小说(novel) / 分镜(storyboard) / 视频(video)
- `script` → 大纲(outline) / 剧本(script) / 分镜(storyboard) / 视频(video)

WorkspaceModule 类型增加 `'novel'`。

## 5. i18n 新增 key

```yaml
nav:
  novel: "Novel" / "小说"
projects:
  projectType: "Project Type" / "项目类型"
  typeNovel: "Novel" / "小说"
  typeScript: "Script" / "剧本"
```

## 改动文件清单

1. `appStore.ts` — ProjectMeta.type, WorkspaceModule 增加 novel
2. `ProjectsPage.tsx` — 重写为网格卡片布局
3. `TopBar.tsx` — 新建对话框加类型选择
4. `SideNav.tsx` — 根据 project.type 动态 navItems
5. `pages.css` — 项目页网格样式
6. `zh-CN.yaml` / `en-US.yaml` — 新增 key
