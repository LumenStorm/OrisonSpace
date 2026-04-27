interface ImportMeta {
  readonly url: string;
  glob<T = string>(
    pattern: string,
    options?: {
      eager?: boolean;
      import?: string;
      query?: string;
    }
  ): Record<string, () => Promise<T>>;
}
