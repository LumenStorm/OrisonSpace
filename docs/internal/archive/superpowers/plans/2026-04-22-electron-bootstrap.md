# Electron Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前目录中建立最小可运行的 Electron 开发环境，并接入 GitHub 远程仓库。

**Architecture:** 使用 Electron 主进程、预加载脚本和静态渲染页的最小三层结构。通过 `npm run dev` 直接启动桌面窗口，不接入额外前端框架和打包工具。

**Tech Stack:** Node.js, npm, Electron

---

### Task 1: Repository Bootstrap

**Files:**
- Create: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: 初始化 Git 仓库并添加远程**

Run: `git init` and `git remote add origin https://github.com/LumenStorm/OrisonSpace`
Expected: local repository initialized and `origin` configured

- [ ] **Step 2: 创建基础 npm 项目**

```json
{
  "name": "orison-space",
  "version": "0.1.0",
  "private": true,
  "main": "src/main/main.js",
  "scripts": {
    "dev": "electron ."
  }
}
```

- [ ] **Step 3: 补充忽略规则**

```gitignore
node_modules/
dist/
out/
```

- [ ] **Step 4: 安装 Electron 依赖**

Run: `npm install --save-dev electron`
Expected: `package.json` and lockfile updated with Electron

### Task 2: Electron App Skeleton

**Files:**
- Create: `src/main/main.js`
- Create: `src/preload/preload.js`
- Create: `src/renderer/index.html`
- Create: `src/renderer/renderer.js`

- [ ] **Step 1: 创建主进程入口**

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 2: 创建预加载脚本**

```js
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload ready');
});
```

- [ ] **Step 3: 创建渲染页**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Orison Space</title>
  </head>
  <body>
    <h1>Orison Space</h1>
    <p>Electron development environment is ready.</p>
    <script src="./renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建渲染脚本**

```js
document.body.dataset.ready = 'true';
```

### Task 3: Verification

**Files:**
- Verify: `package.json`
- Verify: `src/main/main.js`

- [ ] **Step 1: 检查远程仓库配置**

Run: `git remote -v`
Expected: `origin` points to `https://github.com/LumenStorm/OrisonSpace`

- [ ] **Step 2: 检查 Electron 依赖安装**

Run: `npm ls electron`
Expected: Electron listed once under current project

- [ ] **Step 3: 验证开发脚本可用**

Run: `npm run dev`
Expected: Electron starts and loads local window
