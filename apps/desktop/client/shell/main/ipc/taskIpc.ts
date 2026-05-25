import { ipcMain } from 'electron';
import { listTasks, upsertTask, updateTaskStatus, deleteTask } from '../db/taskRepository';

export function registerTaskIpc() {
  ipcMain.handle('task:list', async (_, projectId: string, limit?: number) => {
    return listTasks(projectId, limit);
  });

  ipcMain.handle('task:upsert', async (_, input: {
    taskId: string;
    projectId: string;
    taskType: string;
    name: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    errorMessage?: string;
    outputPayload?: string;
  }) => {
    upsertTask(input);
  });

  ipcMain.handle('task:update-status', async (_, taskId: string, status: string, errorMessage?: string) => {
    updateTaskStatus(taskId, status, errorMessage);
  });

  ipcMain.handle('task:delete', async (_, taskId: string) => {
    deleteTask(taskId);
  });
}
