declare global {
  interface Window {
    orisonDesktop: {
      pickProjectDirectory(): Promise<string | null>;
      getLocale(): string;
      minimize(): void;
      maximize(): void;
      close(): void;
      isMaximized(): Promise<boolean>;
      platform: string;
    };
  }
}

export {};
