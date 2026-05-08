# Plan: 统一走 OpenAI 兼容层列模型 + 生图页面上传图片

## 需求 1：列模型统一走 OpenAI 兼容层

**`packages/model-protocols/src/listModels.ts`**
- 删除 switch(provider) 分支，统一走 `GET {baseUrl}/v1/models` + `Authorization: Bearer {key}`
- 保留函数签名不变（不破坏调用方）

## 需求 2：生图页面上传图片

在 prompt 区域的 footer 中加一个上传按钮，上传后显示缩略图预览。
- 无图片 → 按钮文案"生成"，走 `/images/generations`
- 有图片 → 按钮文案"编辑"，走 `/images/edits`

### UI 风格（遵循 design.md + image-gen.css 现有 token）

- 上传按钮放在 `.image-gen-prompt-footer` 左侧，与生成按钮对齐
- 使用 material-symbols-outlined icon `add_photo_alternate`
- 缩略图预览用 `.image-gen-card` 同风格的圆角 + border
- 删除按钮用 `close` icon，hover 高亮

### API 限制（edit 模式自动强制）

- n 强制为 1
- 图片格式：PNG/JPEG/WebP，≤25MB
- 分辨率不超 4096x4096

## 验证

- typecheck 全绿
- 现有测试不受影响
