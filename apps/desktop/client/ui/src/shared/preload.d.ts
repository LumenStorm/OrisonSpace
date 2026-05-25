import type { OrisonDesktopApi } from '@orison/shared-contracts';

declare global {
  interface Window {
    orisonDesktop: OrisonDesktopApi;
  }
}

export {};
