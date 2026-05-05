import type { StoryMemoryEntry } from '@orison/shared-contracts';

export type EmbeddingProvider = {
  id: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
};

export const noopEmbeddingProvider: EmbeddingProvider = {
  id: 'noop',
  dim: 0,
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  },
};

export type EmbeddableMemoryEntry = StoryMemoryEntry & {
  embedding?: number[];
  embeddingDim?: number;
};
