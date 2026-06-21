# 更新日志 · Changelog

本项目所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

This project's notable changes are documented here, following [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### 修复 · Fixed
- Agent Panel 一轮影响体验的会话 UX 问题
- skill `_reference` 读取失败与会话内模型切换

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

[Unreleased]: https://github.com/LumenStorm/OrisonSpace/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/LumenStorm/OrisonSpace/releases/tag/v0.2.0
