# Orison Space Electron Bootstrap Design

**Date:** 2026-04-22

## Goal

在保留当前目录现有文件的前提下，为项目补齐最小可运行的 Electron 开发环境，并将 GitHub 仓库 `https://github.com/LumenStorm/OrisonSpace` 配置为 `origin`。

## Scope

- 初始化本地 Git 仓库
- 配置远程仓库 `origin`
- 创建最小 Electron 项目结构
- 安装并配置基础依赖与 `npm` 脚本
- 提供一个可直接启动的桌面窗口

## Out Of Scope

- 不接入 React、Vue 等前端框架
- 不配置安装包发布流程
- 不引入自动化测试框架

## Architecture

项目使用 Electron 的标准三层结构：

- `src/main/main.js` 负责应用生命周期与窗口创建
- `src/preload/preload.js` 作为渲染进程与主进程之间的安全桥接层
- `src/renderer/index.html` 与 `src/renderer/renderer.js` 提供最小界面

开发期通过 `npm run dev` 直接启动 Electron。当前阶段以“能初始化、能打开窗口、结构清晰”为主要验收标准。

## Risks And Decisions

- 当前目录尚未初始化为 Git 仓库，因此远程连接需要本地先 `git init`
- 这是项目引导阶段，配置类工作多于业务逻辑，因此本轮不强行引入测试框架
- 现有 `developAsset` 与文档文件保持原样，不参与 Electron 运行流程
