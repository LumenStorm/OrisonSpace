import {
  novelAutoModeStartRequestSchema,
  novelAutoModeActionSchema,
} from '@orison/shared-contracts';
import type { NovelAutoModeState } from '@orison/shared-contracts';
import {
  createNovelAutoModeRunner,
  type NovelAutoModeRunner,
} from './novelAutoModeRunner';

/**
 * 进程内 auto-mode 会话注册表 + 控制器。
 *
 * 行为：
 *  - start: 创建一个 runner，注册到 map，并由后台循环持续 runOnce 直到结束/暂停/取消。
 *  - pause/resume/cancel: 直接转发给对应 runner。
 *  - getState: 返回当前状态。
 *
 * 设计要点：
 *  - 后台循环不阻塞 HTTP，HTTP 响应只返回当前快照。
 *  - cancel/pause 通过 runner.getState().status 自检，循环每次推进前都看一眼，避免抢锁。
 */
export type AutoModeService = {
  start(input: unknown): Promise<NovelAutoModeState>;
  applyAction(input: unknown): Promise<NovelAutoModeState>;
  getState(autoModeId: string): NovelAutoModeState | null;
};

export function createAutoModeService(): AutoModeService {
  const runners = new Map<string, NovelAutoModeRunner>();

  async function backgroundDrive(autoModeId: string) {
    const runner = runners.get(autoModeId);
    if (!runner) return;
    while (true) {
      const before = runner.getState();
      if (before.status !== 'running') return;
      const after = await runner.runOnce();
      if (after.status === 'completed' || after.status === 'cancelled' || after.status === 'failed') {
        return;
      }
      // paused 时停止本轮循环；等待 resume 时由路由再次启动
      if (after.status === 'paused') return;
    }
  }

  return {
    async start(input: unknown): Promise<NovelAutoModeState> {
      const parsed = novelAutoModeStartRequestSchema.parse(input);
      const runner = createNovelAutoModeRunner();
      const initial = await runner.start({
        projectPath: parsed.projectPath,
        chapterIds: parsed.chapterIds,
        mode: parsed.mode,
      });
      runners.set(initial.autoModeId, runner);
      // 不 await：后台异步推进
      void backgroundDrive(initial.autoModeId);
      return initial;
    },

    async applyAction(input: unknown): Promise<NovelAutoModeState> {
      const parsed = novelAutoModeActionSchema.parse(input);
      const runner = runners.get(parsed.autoModeId);
      if (!runner) {
        throw new Error(`auto mode session not found: ${parsed.autoModeId}`);
      }
      switch (parsed.action) {
        case 'pause':
          runner.pause();
          break;
        case 'resume':
          runner.resume();
          // 重启后台循环
          void backgroundDrive(parsed.autoModeId);
          break;
        case 'cancel':
          runner.cancel();
          break;
      }
      return runner.getState();
    },

    getState(autoModeId: string): NovelAutoModeState | null {
      const runner = runners.get(autoModeId);
      if (!runner) return null;
      return runner.getState();
    },
  };
}
