# 更新日志 · Changelog

本项目所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

This project's notable changes are documented here, following [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

- Agent Skill 改为 OpenCode 风格按需加载：`skill` tool 只加载 `SKILL.md` 内容和资源清单，不再将任意 `SKILL.md` 编译执行为 workflow DAG；后端开始强制执行 session mode 与 skill `allowed-tools` 权限。

## [0.3.0]

### 新增 · Added
- 总览/大纲页重构：Hero 封面区、快捷行动条、阶段进度、活动流
- Agent 渐次披露：工具元数据映射、参数摘要、工作步骤分组折叠、child 事件嵌套渲染
- 时间线初始化入口：`git:init` IPC + 空状态引导卡
- 资产作为 Agent 引用（attach 菜单）
- 设置「关于」页（项目主页/开发者/反馈/QQ群 + 免费开源声明）
- Motion token 系统、a11y 增强、主题微调
- 架构边界 CI 闸门（dependency-cruiser 升级为可执行规则）

### 变更 · Changed
- 移除 Auto Mode / Orchestration 空壳（降级为实验功能，待后续重建）
- 合并三份 `atomicWriteFileSync` 到 `@orison/shared-contracts`
- 拆分 `projectIpc.ts` 为 projectIpc + projectFileIpc + projectMetaIpc
- 删除 `features/creative/`、`EditorArea`、`InspectorPanel` 等死代码

### 修复 · Fixed
- Agent Panel 一轮影响体验的会话 UX 问题
- skill `_reference` 读取失败与会话内模型切换
- 封面保存失败不再静默 — 弹错误 toast 并回滚内存指针
- 换封面时先删旧 `cover.*`，保证只存在一个封面文件
- 总览/大纲同步 bug（projectSubscription 按 path 判断切项目）
- 标签栏滚轮横滚、字体离线渲染、保存反馈
- `chapter_write` / `memory_update` 补发 `file:changed`，编辑器自动刷新
- 损坏 `project.yaml` / memory / tag 读取自愈，不再卡死保存
- 切项目串台、外部文件同步、资产库导入等编辑器体验问题
- IDE 体验第二轮修复 — 数据安全 / Minimap / 编辑器 / Agent / 稳定性

## [0.2.0]

### 新增 · Added
- 跨平台构建与发布：Windows / macOS（Intel x64 + Apple Silicon arm64）/ Linux
- 应用内更新流程（config IPC + release pipeline）
- 基于 isomorphic-git 的「时间线」版本管理：提交节点、分支、diff
- 项目文件树导入与文件监听（watcher）
- Agent 编排：Skill / Workflow / 子代理嵌套调用，`ToolResult.terminal` 标记避免 skill 重复收尾
- 设置项：内置中文字体预设 + 字体导入实时预览
- 会话级模型选择，禁用的模型不再被调用

### 变更 · Changed
- 生成链路统一收敛到桌面主进程模型网关，`apiKey` 不再进入 agent
- 项目配置初始化统一收敛到 `project.yaml`
- skill 加载统一到 `loadSkillFromDir`

### 修复 · Fixed
- 编辑器 Ctrl+Z 撤销失效与撤销后光标位置
- 自愈创建 `project.yaml` 并保留概览元信息
- 新增 `closeDb()`，测试清理前释放 SQLite 句柄

[Unreleased]: https://github.com/LumenStorm/OrisonSpace/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/LumenStorm/OrisonSpace/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/LumenStorm/OrisonSpace/releases/tag/v0.2.0
