# 重构计划（2026-05-09）

## 现状总结

1. **模型网关**：已经是统一 OpenAI 兼容层，key-based 路由（`ModelRef = { keyId, modelId }`），不按模型名称走不同接口。✅ 无需改动。

2. **数据库**：server 端 PostgreSQL 存 users 表，桌面端 SQLite 存项目数据。✅ 已完成迁移。

3. **认证**：已改为客户端 SHA-256 散列。✅ 已完成。

4. **模型设置 UI**：左右两栏布局，CSS 已对齐 design.md 规范。✅ 已完成。

---

## 任务 4：通用后台任务系统 + 生图页面状态持久化

### 目标

1. 抽象出通用的后台任务队列（BackgroundTask），所有生成类操作（生图、生视频、文本生成）统一走这套机制
2. 切换页面时正在执行的任务不中断，回来能看到结果
3. 生图页面的 prompt、结果列表持久化到 store，切换页面不丢失

---

### 一、通用后台任务 Slice (`backgroundTasksSlice.ts`)

新建 `apps/desktop/ui/src/shared/store/backgroundTasksSlice.ts`

#### 核心类型

```ts
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type TaskType = 'image_gen' | 'video_gen' | 'text_gen' | 'rewrite';

interface BackgroundTask<TResult = unknown> {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;                 // 用户可见描述，如 "生成图片: a cat..."
  createdAt: string;
  updatedAt: string;
  progress?: number;             // 0-100
  error?: string;
  result?: TResult;
  meta?: Record<string, unknown>; // prompt, params 等任务特定数据
}
```

#### Slice 接口

```ts
type BackgroundTasksSlice = {
  bgTasks: BackgroundTask[];
  
  // 提交任务：传入执行函数，slice 管理生命周期
  submitBgTask: <T>(opts: {
    type: TaskType;
    label: string;
    meta?: Record<string, unknown>;
    execute: (signal: AbortSignal) => Promise<T>;
  }) => string; // 返回 taskId
  
  cancelBgTask: (taskId: string) => void;
  dismissBgTask: (taskId: string) => void;
  clearFinishedBgTasks: () => void;
};
```

#### 关键设计

- **execute 函数由调用方传入**：slice 不关心 API 细节，只管状态 + AbortController
- **并发**：同类型可并发，`Map<taskId, AbortController>` 管理取消
- **持久化**：已完成任务持久化到 localStorage（`orison_bgTasks`），running 的在重启后标记 failed
- **上限**：保留最近 50 条已完成任务

---

### 二、生图页面状态提升到 Store

在 `imageGenSlice.ts` 中增加：

```ts
imageGenPrompt: string;
imageGenResults: ImageGenResultMeta[];  // 轻量版，不含 b64Json
setImageGenPrompt: (prompt: string) => void;
prependImageGenResults: (items: ImageGenResultMeta[]) => void;
markImageGenResultAsset: (id: string) => void;
```

`ImageGenResultMeta` 只存：
```ts
{ id, prompt, tempRelativePath, assetAdded, source, mimeType }
```

持久化：prompt debounce 写 localStorage，results 存 metadata 列表（不含二进制）。

---

### 三、ImageGenEditor 改造

1. `prompt` / `results` 从 store 读取，不再用 `useState`
2. 生成操作改为：
   ```ts
   submitBgTask({
     type: 'image_gen',
     label: `生成: ${prompt.slice(0, 30)}...`,
     meta: { prompt, params },
     execute: async (signal) => {
       const response = await generateImage({ ref, prompt, params, image });
       const saved = await saveToProject(response, projectPath, prompt);
       return saved; // ImageGenResultMeta[]
     },
   });
   ```
3. 任务完成后通过 effect 监听 `bgTasks` 变化，自动 merge 到 `imageGenResults`

---

### 四、任务面板

底部面板 "tasks" tab 展示所有后台任务状态（spinner/✓/✗），支持取消和清除。

---

### 文件变更清单

| 文件 | 操作 |
|------|------|
| `store/backgroundTasksSlice.ts` | 新建 |
| `store/appStore.ts` | 注册新 slice |
| `store/imageGenSlice.ts` | 增加 prompt/results 持久化 |
| `store/types.ts` | 增加 BackgroundTask 类型 |
| `features/editor/ImageGenEditor.tsx` | 从 store 读状态，生成走 submitBgTask |
| `store/tasksSlice.ts` | 迁移 submitRewrite 使用 backgroundTasksSlice |

---

### 迁移策略

- 现有 `tasksSlice.submitRewrite` 改为内部调用 `submitBgTask`
- `acceptedPatches` 等 rewrite 特有逻辑保留在 `tasksSlice`
- 不破坏现有 rewrite 功能
