import { desktopIpcSchema } from '@orison/shared-contracts';

type DesktopApi = {
  pickProjectDirectory: () => Promise<string | null>;
};

function getDesktopApi(): DesktopApi {
  const api = (globalThis as any).orisonDesktop as DesktopApi | undefined;
  if (!api) throw new Error('Desktop API not available — not running inside Electron shell');
  return api;
}

function assertChannel(channel: string) {
  desktopIpcSchema.parse({ channel });
}

export async function pickProjectDirectory(): Promise<string | null> {
  assertChannel('project:pick-directory');
  return getDesktopApi().pickProjectDirectory();
}
