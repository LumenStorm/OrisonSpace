import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { storyMemoryIndexSchema } from '@orison/shared-contracts';
import type { StoryMemoryIndex, StoryMemoryEntry } from '@orison/shared-contracts';
import YAML from 'yaml';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';
import { backupCorruptFile } from './corruptRecovery';
import { loadTagRegistry, saveTagRegistry, normalizeAndRegister } from './tagRegistry';

const MEMORY_FILE = 'story-memory.yaml';
const MEMORY_DIR = 'memory';

function getMemoryIndexPath(projectPath: string): string {
  return path.join(projectPath, MEMORY_DIR, MEMORY_FILE);
}

/**
 * 加载小说的记忆索引。
 * 文件不存在时返回空默认值。
 */
export function loadMemoryIndex(projectPath: string, novelId: string): StoryMemoryIndex {
  const indexPath = getMemoryIndexPath(projectPath);
  if (!existsSync(indexPath)) {
    return storyMemoryIndexSchema.parse({
      novelId,
      entries: [],
      version: 0,
    });
  }

  const raw = readFileSync(indexPath, 'utf8');
  try {
    return storyMemoryIndexSchema.parse(YAML.parse(raw));
  } catch {
    // Corrupt index would otherwise throw on every recall/save. Set the bad
    // file aside (preserved as a `.corrupt-*` backup) and return an empty index
    // so the next save rebuilds it instead of wedging the project.
    backupCorruptFile(indexPath);
    return storyMemoryIndexSchema.parse({ novelId, entries: [], version: 0 });
  }
}

/**
 * 保存小说的记忆索引。
 */
export function saveMemoryIndex(projectPath: string, index: StoryMemoryIndex): void {
  const indexPath = getMemoryIndexPath(projectPath);
  const dir = path.dirname(indexPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // 更新 updatedAt
  index.updatedAt = new Date().toISOString();

  const validated = storyMemoryIndexSchema.parse(index);
  atomicWriteFileSync(indexPath, YAML.stringify(validated), 'utf8');
}

/**
 * 添加或更新一条记忆条目。
 * 如果条目 ID 已存在则覆盖，否则追加。
 * 自动归一化 structuredTags 中的标签。
 * 返回更新后的索引。
 */
export function addMemoryEntry(projectPath: string, entry: StoryMemoryEntry): StoryMemoryIndex {
  const novelId = entry.novelId;
  const index = loadMemoryIndex(projectPath, novelId);

  // 归一化 structuredTags
  if (entry.structuredTags?.length) {
    const registry = loadTagRegistry(projectPath, novelId);
    let changed = false;
    for (const tag of entry.structuredTags) {
      const { registry: updated, canonicalName } = normalizeAndRegister(
        registry, tag.category, tag.value, entry.chapterNumber
      );
      if (canonicalName !== tag.value) {
        tag.value = canonicalName;
        changed = true;
      }
      if (updated !== registry) changed = true;
    }
    if (changed) saveTagRegistry(projectPath, registry);
  }

  const existingIdx = index.entries.findIndex((e) => e.id === entry.id);
  if (existingIdx !== -1) {
    index.entries[existingIdx] = entry;
  } else {
    index.entries.push(entry);
  }

  index.version += 1;
  saveMemoryIndex(projectPath, index);
  return index;
}
