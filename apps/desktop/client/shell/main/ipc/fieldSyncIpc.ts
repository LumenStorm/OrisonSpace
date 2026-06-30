import { ipcMain } from 'electron';
import { creativeFieldKeySchema } from '@orison/shared-contracts';
import type { ProjectFieldPatch } from '@orison/shared-contracts';
import { onFieldEdited, applyFieldPatches } from '../../../../local-bff/index';
import { assertSafePath } from './pathGuard';
import { withProjectLock } from '../fs/projectWriteLock';

export function registerFieldSyncIpc() {
  ipcMain.handle('field:sync', async (_event, projectPath: string, field: string, data: unknown) => {
    assertSafePath(projectPath);
    const parsedField = creativeFieldKeySchema.parse(field);
    await withProjectLock(projectPath, () => onFieldEdited(projectPath, parsedField, data));
  });

  ipcMain.handle('field:apply-agent-patch', async (_event, projectPath: string, fieldPatch: ProjectFieldPatch) => {
    assertSafePath(projectPath);
    return await withProjectLock(projectPath, () => applyFieldPatches(projectPath, fieldPatch));
  });
}