/**
 * Tool Notification — pushes events to the renderer when tools modify state.
 */
import { BrowserWindow } from 'electron';

export type ToolEvent =
  | { type: 'file:changed'; path: string }
  | { type: 'chapter:changed'; chapterId: string }
  | { type: 'outline:changed' }
  | { type: 'image:created'; paths: string[] }
  | { type: 'git:changed' }
  | { type: 'memory:changed' };

export function notifyUI(event: ToolEvent) {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send('tool:event', event);
  });
}
