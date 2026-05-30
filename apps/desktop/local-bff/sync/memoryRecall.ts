import type { StoryMemoryEntry, TagCategory } from '@orison/shared-contracts';
import { loadMemoryIndex } from './memoryRepository';

export interface RecallQuery {
  tags: Array<{ category: TagCategory; value: string }>;
  maxTokenBudget?: number;
  currentChapter?: number;
  importanceFloor?: 'critical' | 'high' | 'medium' | 'low';
}

export interface RecallResult {
  entries: StoryMemoryEntry[];
  totalTokens: number;
  truncated: boolean;
}

const IMPORTANCE_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

const ROLE_WEIGHT: Record<string, number> = {
  subject: 3,
  object: 2,
  context: 1,
};

const IMPORTANCE_FLOOR_ORDER = ['critical', 'high', 'medium', 'low'] as const;

function meetsFloor(importance: string | undefined, floor: string): boolean {
  const idx = IMPORTANCE_FLOOR_ORDER.indexOf(importance as any);
  const floorIdx = IMPORTANCE_FLOOR_ORDER.indexOf(floor as any);
  if (idx === -1) return floor === 'low';
  return idx <= floorIdx;
}

function scoreEntry(entry: StoryMemoryEntry, query: RecallQuery): number {
  const tags = entry.structuredTags;
  if (!tags?.length) return 0;

  let tagScore = 0;
  for (const qt of query.tags) {
    for (const et of tags) {
      if (et.category === qt.category && et.value === qt.value) {
        tagScore += ROLE_WEIGHT[et.role ?? 'context'];
      }
    }
  }
  if (tagScore === 0) return 0;

  const importance = entry.importance ?? 'medium';
  const iw = IMPORTANCE_WEIGHT[importance] ?? 2;

  let decay = 1;
  if (query.currentChapter != null && entry.chapterNumber != null) {
    const distance = query.currentChapter - entry.chapterNumber;
    decay = 1 / (1 + 0.01 * Math.max(0, distance));
  }

  return tagScore * iw * decay;
}

export function recallMemories(
  projectPath: string,
  novelId: string,
  query: RecallQuery,
): RecallResult {
  const budget = query.maxTokenBudget ?? 2000;
  const floor = query.importanceFloor ?? 'low';
  const index = loadMemoryIndex(projectPath, novelId);

  const scored: Array<{ entry: StoryMemoryEntry; score: number }> = [];
  for (const entry of index.entries) {
    if (!meetsFloor(entry.importance, floor)) continue;
    const score = scoreEntry(entry, query);
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const result: StoryMemoryEntry[] = [];
  let totalTokens = 0;
  let truncated = false;

  // critical 条目始终包含，不计入预算
  for (const { entry } of scored) {
    if (entry.importance === 'critical') {
      const tokens = entry.recallBudget || estimateTokens(entry.content);
      result.push(entry);
      totalTokens += tokens;
    }
  }

  // 非 critical 条目按预算截断
  let nonCriticalTokens = 0;
  for (const { entry } of scored) {
    if (entry.importance === 'critical') continue;
    const tokens = entry.recallBudget || estimateTokens(entry.content);
    if (nonCriticalTokens + tokens > budget) {
      truncated = true;
      continue;
    }
    result.push(entry);
    nonCriticalTokens += tokens;
    totalTokens += tokens;
  }

  return { entries: result, totalTokens, truncated };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export function formatRecalledMemories(entries: StoryMemoryEntry[]): string {
  if (!entries.length) return '';
  return entries
    .map(e => `【${e.title}】(第${e.chapterNumber}章) ${e.content}`)
    .join('\n\n');
}
