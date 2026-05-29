# 主题配色参数说明

本文档面向设计师，说明 `apps/desktop/client/ui/src/shared/themes/` 下 YAML 文件中各参数的用途与调色建议。

修改 YAML 后运行 `buildThemes.ts` 即可生成 CSS 变量文件。

---

## 背景与表面层级

界面采用多层表面系统，从深到浅依次为：

| 参数 | 用途 |
|------|------|
| `background` | 整个窗口的最底层背景色 |
| `surface` | 主内容区域背景（编辑器、面板主体） |
| `surface-container-lowest` | 最浅容器（输入框内部、卡片高亮区） |
| `surface-container-low` | 次浅容器（侧边栏、标签栏背景） |
| `surface-container` | 中间层容器（工具栏、状态栏） |
| `surface-container-high` | 较深容器（悬浮面板、下拉菜单） |
| `surface-container-highest` | 最深容器（弹窗头部、选中高亮） |
| `surface-variant` | 变体表面（禁用区域、分组背景） |

> 调色建议：亮色主题中这些值从白到灰递增；暗色主题中从深黑到灰递增。相邻层级之间保持 3-5% 的亮度差即可。

---

## 文字颜色

| 参数 | 用途 |
|------|------|
| `on-surface` | 主要文字（标题、正文） |
| `on-surface-variant` | 次要文字（标签、占位符、辅助说明） |
| `on-accent` | 强调色按钮上的文字（通常为白色） |
| `primary` | 最高对比度文字/图标（Logo、重要标题） |

---

## 强调色与语义色

| 参数 | 用途 |
|------|------|
| `accent` | 主强调色（选中状态、主按钮背景、链接） |
| `accent-strong` | 加深强调色（按钮 hover、重要标记） |
| `accent-soft` | 淡化强调色（选中行背景、标签底色） |
| `error` | 错误/危险色（删除按钮、错误提示文字） |
| `error-bg` | 错误背景色（错误提示条底色） |
| `success` | 成功色（完成状态、通过标记） |
| `notice-bg` | 通知/提示背景色（信息提示条底色） |

---

## 边框与分隔线

| 参数 | 用途 |
|------|------|
| `border-default` | 结构性分隔线（面板之间、标签栏底部、分割线） |
| `border-subtle` | 弱分隔线（卡片内部分区、次要分隔） |
| `outline-variant` | 装饰性边框（输入框、卡片外框、圆角容器） |
| `outline` | 高对比度边框（聚焦环、重要边界） |

> 调色建议：`border-default` 与 `outline-variant` 可以是同一基色不同透明度。`border-subtle` 比 `border-default` 再降低 30-40% 透明度。

---

## 交互状态

| 参数 | 用途 |
|------|------|
| `hover-overlay` | 通用 hover 叠加色（按钮、图标悬停） |
| `menu-item-hover` | 菜单项 hover 背景 |
| `file-item-hover` | 文件列表项 hover 背景 |
| `active-indicator` | 当前激活项的背景指示器（侧边栏选中项） |

> 调色建议：亮色主题用深色半透明叠加，暗色主题用白色半透明叠加。透明度控制在 5-15% 之间。

---

## 阴影

| 参数 | 用途 |
|------|------|
| `shadow-soft` | 轻阴影（卡片、面板静态状态） |
| `shadow-elevated` | 强阴影（弹窗、悬浮面板、hover 提升） |

格式为完整的 CSS `box-shadow` 值，例如 `0 12px 40px rgba(0, 0, 0, 0.06)`。

---

## 遮罩

| 参数 | 用途 |
|------|------|
| `overlay-backdrop` | 模态弹窗背后的半透明遮罩 |

---

## 供应商标识色

| 参数 | 用途 |
|------|------|
| `provider-dot-gcp` | GCP 供应商标识圆点颜色 |
| `provider-dot-anthropic` | Anthropic 供应商标识圆点颜色 |

---

## 亮色 vs 暗色主题对照

| 参数 | 亮色 | 暗色 | 说明 |
|------|------|------|------|
| `background` | `#faf9f7` 暖白 | `#1a1c1b` 深灰绿 | 基底色调 |
| `accent` | `#6b7a6a` 灰绿 | `#8fa88e` 亮灰绿 | 暗色主题需提亮以保证对比度 |
| `on-surface` | `#1a1c1b` 近黑 | `#e3e2e0` 近白 | 与背景形成足够对比 |
| `error` | `#c44444` 深红 | `#e57373` 浅红 | 暗色主题中红色需提亮 |
| `shadow-soft` | 低透明度 (0.06) | 高透明度 (0.3) | 暗色背景上阴影需更重才可见 |

---

## 修改流程

1. 编辑 `light.yaml` 或 `dark.yaml`
2. 运行 `buildThemes.ts` 生成 `tokens.css`
3. 启动开发服务器预览效果
4. 切换主题（亮/暗/跟随系统）确认两套配色均正常
