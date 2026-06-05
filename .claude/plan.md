# P0 修复:选段评阅渲染层接线

## 背景
选段评阅功能(选段 → AI 改写 → 回写正文)的**后端 + 状态层已 100% 完成**(agentDiffSlice 的 acceptDiff/locatePassage/resolvePassageAt/cancelPassageResolve 全实现),缺的是 UI 渲染层 4 处接线。本方案只动前端,不改后端逻辑。

确认的 UX 决策:
- 选段 diff **直接复用 SideBySideDiff** 组件渲染(originalText vs replacement)。
- 候选确认卡放在 **AgentInput 上方**(仿 AgentConfirmCard 的面板级浮现模式)。

## 改动清单(5 个文件 + 2 个 i18n + CSS)

### 1. AgentMessageItem.tsx — 修 WRITE_TOOLS 漏项 + 渲染 references
- `WRITE_TOOLS`(第10行)补 `'rewrite_passage'`,使其结果走 DiffCard 而非 AgentToolCard。
  - 此常量与 agentSessionSlice.ts:22 同名数组重复(本次 bug 根因)。抽到单一来源(agentDiffSlice 导出 `WRITE_TOOLS`)消除重复。
- user 分支(第29-35行)在 content 下方渲染 `message.references` 为引用 chip(图标:selection=format_quote / chapter=description / file=insert_drive_file,复用 attachment-chip 样式类)。

### 2. DiffCard.tsx — 支持 passage 类型
- 读 `meta.type`,`'passage'` 走 passage 分支,否则保持现有 chapter 行为。
- passage 分支:
  - 内容匹配定位 pending diff:`d.kind==='passage' && d.originalText===meta.originalText && d.replacement===meta.replacement && d.chapterId===meta.chapterId && d.filePath===meta.filePath`(passage diff 的 id 是 randomUUID,与 tool result 无共享 id)。
  - **跳过** auto/readonly 早返回(第28行):passage 恒为 pending(slice 从不自动 apply passage)。
  - 找到 → 直接渲染 `<SideBySideDiff diff={passageDiff} oldContent={passageDiff.originalText} onClose={noop} />`(体量小,默认展开;SideBySideDiff 自带 Accept/Reject All 已接 store)。
  - 找不到(已处理)→ `✓ {t('agent.resolved')}` 简卡。
- chapter 分支不变。

### 3. SideBySideDiff.tsx — 微调(passage 已基本支持)
- 已支持:第54行 newContent 三元、第55行 fileName fallback。oldContent 由 DiffCard 传 originalText。
- 可选:passage 时隐藏 close 按钮(onClose 传 noop)。

### 4. 新建 AgentPassageResolveCard.tsx — 候选确认卡
- 仿 AgentConfirmCard。读 store:pendingPassageResolve / resolvePassageAt / cancelPassageResolve / resolvedLocale。
- null → 返回 null。
- header 按 reason 显示 ambiguous / not-found 文案。
- 候选列表:candidates.map → excerpt + 「用此处」按钮 `resolvePassageAt(diffId, i)`。
- 底部 cancel 按钮(保留 pending diff 供重试)。candidates 为空时显示 noCandidates。

### 5. AgentInput.tsx — 挂载候选卡
- 第98行旁加 `{pendingPassageResolve && <AgentPassageResolveCard />}`,选择器加 pendingPassageResolve。

### 6. i18n(en-US + zh-CN agent.yaml)新增 key
- passageReview: "Passage rewrite" / "选段改写"
- relocateAmbiguous: "Matched multiple spots — choose where to apply" / "匹配到多处,请选择回写位置"
- relocateNotFound: "Original text not found — pick the closest match" / "未找到原文,请选择最接近的位置"
- useThisLocation: "Use here" / "用此处"
- cancel: "Cancel" / "取消"
- noCandidates: "No candidate locations found" / "未找到候选位置"

### 7. CSS(agent-panel.css)
- 新增 `.agent-passage-resolve-card` 系列,复用 .agent-confirm-card 的 token 变量保持一致。

## 已知限制(不在本次 P0 范围)
- **anchor 不透传**:rewrite_passage handler(chapterHandlers.ts:81-87)的 metadata 不含 anchor,故 passage diff 的 anchor 恒 undefined,locatePassage 的 prefix/suffix 上下文消歧拿不到数据。唯一命中正常;多处命中只能按 indexOf 顺序列候选。后续可在 slice 按 originalText 关联回填同会话 SelectionAttachment.anchor。

## 验证
- `pnpm --filter @orison/desktop-ui typecheck`
- `pnpm --filter @orison/desktop-ui test`
- 手动:选段 → agent 改写 → suggest 下出现 SideBySideDiff → Accept 回写;构造原文已编辑场景验证候选卡。

## 风险
低。纯前端渲染层接线,后端/状态机不动。passage diff 内容匹配键在极端重复内容下理论上可能错配,但 replacement 唯一性实际足够。
