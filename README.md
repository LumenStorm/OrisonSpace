<div align="center">

<img src="docs/assets/logo.png" alt="Orison Space — AI 小说创作 IDE" width="120" />

# Orison Space

> AI 驱动的小说创作 IDE — 从灵感到成稿的全流程工作台。

[English](README.en.md)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-37-47848F.svg)

[**⬇ 下载安装**](https://github.com/LumenStorm/OrisonSpace/releases) · [📖 文档](docs/) · [🕒 时间线指南](docs/guides/时间线指南.md) · [📋 更新日志](CHANGELOG.md)

</div>

<!-- TODO: 添加应用截图 -->
<!-- ![screenshot](docs/assets/screenshot.png) -->

---

**Orison Space** 是一款开源、本地优先的 AI 小说创作 IDE，面向网文与长篇小说作者，把大纲、章节、人物与世界观资产卡整合到一个工作区。它以「用户主导创作、AI 辅助」为原则，提供 AI 生成、续写、润色、审阅与可控修改，接入任意 OpenAI 兼容模型，所有创作数据保存在你自己的电脑上。支持 Windows、macOS 与 Linux，采用 Apache-2.0 许可证。

## 功能亮点

- **全流程创作** — 大纲、章节、资产卡，一个工作区搞定
- **AI 辅助** — 生成、续写、润色、审阅、可控修改；用户主导，AI 辅助
- **本地优先** — 项目文件存在你的电脑上，数据不离开本地
- **Agent 编排** — Skill / Workflow / 子代理嵌套调用，LLM 自动召唤工具
- **图片生成 + 编辑** — 文生图、图编辑（画笔/遮罩/裁切），结果直接入库
- **版本管理** — 基于 isomorphic-git 的提交节点、分支、diff 与时间线
- **IDE 式编辑器** — 分屏（Split View）、Minimap、多标签、命令面板
- **文档互通** — 章节/大纲支持 DOCX 预览与导入导出
- **主题 & 多语言** — 亮色/暗色/自定义主题，中英双语，YAML 驱动可扩展
- **模型自由** — 接入任何 OpenAI 兼容端点，本地管理 API Key

## 适合谁

- **网文 / 长篇小说作者** — 需要把大纲、章节、人物设定长期沉淀在一个工作区，而不是散落在多个文档里
- **想用 AI 但不想交出主导权的创作者** — Orison Space 是创作工作台，不是一次性自动生成器：每一处 AI 改动都可预览、可控、可回退
- **重视隐私与数据自主的人** — 作品全部以本地文件保存，不上传云端，不需要登录账号
- **喜欢自带模型的人** — 接入自己的 OpenAI 兼容 API Key，自由选择文本与图片模型

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron |
| 前端 | React · TypeScript · Zustand · TipTap |
| Agent | 自研 Workflow Runtime（嵌入式库） |
| 模型协议 | OpenAI 兼容统一适配（AI SDK） |
| 构建 | pnpm monorepo · Turbo · Vite · Vitest |

## 架构概览

```
┌─────────────────────────────────────────────────┐
│  Electron Shell (主进程)                         │
│  ├─ Model Gateway (文本/图片生成)                    │
│  ├─ @orison/desktop-agent (Workflow Runtime)    │
│  ├─ Local BFF (项目文件读写)                     │
│  └─ IPC 安全边界 + 路径沙箱                      │
├─────────────────────────────────────────────────┤
│  Renderer (渲染进程)                             │
│  ├─ 工作区 IDE 布局                              │
│  ├─ 创作编辑器 (章节/大纲/资产)                 │
│  └─ Agent Panel (对话/Skill/Diff)               │
└─────────────────────────────────────────────────┘
```

## 仓库结构

```
apps/
  desktop/
    agent/          — @orison/desktop-agent (编排库)
    client/
      shell/        — Electron 主进程 + preload
      ui/           — React 渲染层
    local-bff/      — 本地项目数据读写层
packages/
  model-protocols/  — 模型协议适配器 (纯 Node)
  shared-contracts/ — 跨进程类型契约 (Zod schema)
  story-sync/       — Story Sync 提取与补丁逻辑
docs/               — 架构与设计文档
```

## 下载安装

> 当前处于 Alpha 阶段，持续迭代中。

前往 [GitHub Releases](https://github.com/LumenStorm/OrisonSpace/releases) 下载安装包：

| 平台 | 格式 |
|------|------|
| Windows | `.exe` 安装包 / 免安装 `.zip` |
| macOS | `.dmg` 磁盘映像 |
| Linux | `.AppImage` 免安装可执行 |

## 使用指南

- [时间线 · 版本管理指南](docs/guides/时间线指南.md) — 保存时间节点、开支线、回到旧版本

## 项目状态

**Alpha** — 核心创作链路（小说章节生成/续写/审阅、图片生成、Agent 编排）已可用，UI 和功能持续完善中。

## 常见问题

**Orison Space 是什么？**
一款开源、本地优先的 AI 小说创作 IDE，把大纲、章节、人物与世界观资产卡整合到一个工作区，提供 AI 生成、续写、润色、审阅与可控修改。

**它和 ChatGPT 这类聊天工具有什么不同？**
它是面向长篇创作的工作台，而不是一次性生成器。项目结构、版本时间线、资产库长期沉淀；AI 的每次修改都可预览、可控、可回退，用户始终主导创作。

**我的作品数据会上传到云端吗？**
不会。Orison Space 本地优先，作品以普通文件（`project.yaml`、`chapters/*.md` 等）保存在你自己的电脑上，无需登录账号，数据不离开本地。

**支持哪些 AI 模型？**
任意 OpenAI 兼容端点。你用自己的 API Key 接入，自由选择文本与图片生成模型，密钥仅加密保存在本地。

**支持哪些操作系统？**
Windows、macOS（Intel 与 Apple Silicon）和 Linux。

**收费吗？开源吗？**
完全开源，采用 Apache-2.0 许可证，可免费使用。你只需自备模型 API 调用额度。

## License

[Apache-2.0](LICENSE)

## 友情链接

- [LinuxDO](https://linux.do/)

## Contributing

欢迎提交 Issue 和 Pull Request。开始前请阅读 [贡献指南](CONTRIBUTING.md)。

- Bug 报告请附上复现步骤和系统信息
- Feature 建议请先开 Issue 讨论
- 安全问题请走私密披露，见 [SECURITY.md](SECURITY.md)
