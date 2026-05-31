# Orison Space

> AI 驱动的影视 / 小说创作 IDE — 从灵感到成稿的全流程工作台。

[English](README.en.md)

<!-- TODO: 添加应用截图 -->
<!-- ![screenshot](docs/assets/screenshot.png) -->

---

## 功能亮点

- **全流程创作** — 大纲、章节、分镜、资产卡，一个工作区搞定
- **AI 辅助** — 生成、续写、润色、审阅、可控修改；用户主导，AI 辅助
- **本地优先** — 项目文件存在你的电脑上，数据不离开本地
- **Agent 编排** — Skill / Workflow / 子代理嵌套调用，LLM 自动召唤工具
- **图片生成 + 编辑** — 文生图、图编辑（画笔/遮罩/裁切），结果直接入库
- **主题 & 多语言** — 亮色/暗色/自定义主题，中英双语，YAML 驱动可扩展
- **模型自由** — 接入任何 OpenAI 兼容端点，本地管理 API Key

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
│  ├─ Model Gateway (文本/图片/视频生成)           │
│  ├─ @orison/desktop-agent (Workflow Runtime)    │
│  ├─ Local BFF (项目文件读写)                     │
│  └─ IPC 安全边界 + 路径沙箱                      │
├─────────────────────────────────────────────────┤
│  Renderer (渲染进程)                             │
│  ├─ 工作区 IDE 布局                              │
│  ├─ 创作编辑器 (章节/大纲/分镜/资产)             │
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

前往 [GitHub Releases](https://github.com/LumenStorm/OrisonSpace/releases) 下载对应平台安装包：

| 平台 | 格式 |
|------|------|
| Windows | `.exe` 安装包 |
| macOS | `.dmg` |
| Linux | `.AppImage` |

## 项目状态

**Alpha** — 核心创作链路（小说章节生成/续写/审阅、图片生成、Agent 编排）已可用，UI 和功能持续完善中。

## License

[Apache-2.0](LICENSE)

## Contributing

欢迎提交 Issue 和 Pull Request。

- Bug 报告请附上复现步骤和系统信息
- Feature 建议请先开 Issue 讨论
