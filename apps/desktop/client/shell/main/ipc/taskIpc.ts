import { ipcMain } from 'electron';
import { taskUpsertSchema } from '@orison/shared-contracts';
import { listTasks, upsertTask, updateTaskStatus, deleteTask } from '../db/taskRepository';

export function registerTaskIpc() {
  ipcMain.handle('task:list', async (_, projectId: string, limit?: number) => {
    return listTasks(projectId, limit);
  });

  ipcMain.handle('task:upsert', async (_, input: unknown) => {
    upsertTask(taskUpsertSchema.parse(input));
  });

  ipcMain.handle('task:update-status', async (_, taskId: string, status: string, errorMessage?: string) => {
    updateTaskStatus(taskId, status, errorMessage);
  });

  ipcMain.handle('task:delete', async (_, taskId: string) => {
    deleteTask(taskId);
  });
}
