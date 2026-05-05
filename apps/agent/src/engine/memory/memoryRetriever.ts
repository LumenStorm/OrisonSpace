import type { StoryMemoryEntry } from '@orison/shared-contracts';

export type MemoryRetrievalFilter = {
  isForeshadow?: boolean;
  chapterRange?: [number, number];
};

export type MemoryRetrievalOptions = {
  topK: number;
  filter?: MemoryRetrievalFilter;
};

export type MemoryRetriever = {
  retrieve(query: string, options: MemoryRetrievalOptions): Promise<StoryMemoryEntry[]>;
};

function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
}

function matchesFilter(entry: StoryMemoryEntry, filter?: MemoryRetrievalFilter): boolean {
  if (!filter) return true;
  if (filter.isForeshadow !== undefined && entry.isForeshadow !== filter.isForeshadow) return false;
  if (filter.chapterRange) {
    const [start, end] = filter.chapterRange;
    if (entry.chapterNumber < start || entry.chapterNumber > end) return false;
  }
  return true;
}

function scoreEntry(entry: StoryMemoryEntry, tokens: string[]): number {
  if (tokens.length === 0) return entry.importanceScore;
  const haystack = `${entry.title} ${entry.content} ${entry.tags.join(' ')} ${entry.relatedCharacters.join(' ')}`.toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits + entry.importanceScore;
}

export function createKeywordMemoryRetriever(entries: StoryMemoryEntry[]): MemoryRetriever {
  return {
    async retrieve(query: string, options: MemoryRetrievalOptions): Promise<StoryMemoryEntry[]> {
      const topK = Math.max(0, options.topK);
      if (topK === 0) return [];
      const tokens = tokenize(query);
      return entries
        .filter((entry) => matchesFilter(entry, options.filter))
        .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || b.entry.importanceScore - a.entry.importanceScore)
        .slice(0, topK)
        .map(({ entry }) => entry);
    },
  };
}

export const emptyMemoryRetriever: MemoryRetriever = createKeywordMemoryRetriever([]);
