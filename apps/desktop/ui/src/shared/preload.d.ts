declare global {
  interface Window {
    orisonDesktop: {
      pickProjectDirectory(): Promise<string | null>;
    };
  }
}

export {};
