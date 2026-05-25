import { ipcMain } from 'electron';
import { creativeFieldKeySchema } from '@orison/shared-contracts';
import { onFieldEdited } from '../../../../local-bff/index';
import { assertSafePath } from './pathGuard';

export function registerFieldSyncIpc() {
  ipcMain.handle('field:sync', async (_event, projectPath: string, field: string, data: unknown) => {
    assertSafePath(projectPath);
    const parsedField = creativeFieldKeySchema.parse(field);
    onFieldEdited(projectPath, parsedField, data);
  });
}
