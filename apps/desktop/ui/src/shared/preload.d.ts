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
      syncField?(field: string, data: unknown): Promise<void>;
      loadModelConfig?(): Promise<{ apiKey: string; baseUrl: string; model: string }>;
      saveModelConfig?(config: { apiKey: string; baseUrl: string; model: string }): Promise<void>;
    };
  }
}

export {};
