import { ipcMain } from 'electron';
import { creativeFieldKeySchema } from '@orison/shared-contracts';
import { onFieldEdited } from '../../../../local-bff/index';
import { assertSafePath } from './pathGuard';
import { withProjectLock } from '../fs/projectWriteLock';

export function registerFieldSyncIpc() {
  ipcMain.handle('field:sync', async (_event, projectPath: string, field: string, data: unknown) => {
    assertSafePath(projectPath);
    const parsedField = creativeFieldKeySchema.parse(field);
    // Field sync does its own load→mutate→save on project.yaml — serialize it with
    // the meta/chapter writers so concurrent edits can't clobber each other. Errors
    // propagate to the renderer (syncField(...).catch surfaces them as a toast)
    // rather than being silently swallowed; success resolves undefined as before.
    await withProjectLock(projectPath, () => onFieldEdited(projectPath, parsedField, data));
  });
}


