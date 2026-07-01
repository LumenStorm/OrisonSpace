import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { tagRegistrySchema } from '@orison/shared-contracts';
import type { TagRegistry, TagCategory } from '@orison/shared-contracts';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';
import { backupCorruptFile } from './corruptRecovery';

const REGISTRY_FILE = 'tag-registry.yaml';
const MEMORY_DIR = 'memory';

function getRegistryPath(projectPath: string): string {
  return path.join(projectPath, MEMORY_DIR, REGISTRY_FILE);
}

export function loadTagRegistry(projectPath: string, novelId: string): TagRegistry {
  const filePath = getRegistryPath(projectPath);
  if (!existsSync(filePath)) {
    return tagRegistrySchema.parse({ novelId, entries: [], version: 0 });
  }
  const raw = readFileSync(filePath, 'utf8');
  try {
    return tagRegistrySchema.parse(YAML.parse(raw));
  } catch {
    // Corrupt registry would throw on every tag load/save. Set the bad file
    // aside (preserved as a `.corrupt-*` backup) and return an empty registry
    // so the next save rebuilds it instead of wedging the project.
    backupCorruptFile(filePath);
    return tagRegistrySchema.parse({ novelId, entries: [], version: 0 });
  }
}

export function saveTagRegistry(projectPath: string, registry: TagRegistry): void {
  const filePath = getRegistryPath(projectPath);
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  registry.version += 1;
  atomicWriteFileSync(filePath, YAML.stringify(tagRegistrySchema.parse(registry)), 'utf8');
}

export function normalizeTag(registry: TagRegistry, category: TagCategory, rawName: string): string {
  const name = rawName.trim();
  for (const entry of registry.entries) {
    if (entry.category !== category) continue;
    if (entry.canonicalName === name) return entry.canonicalName;
    if (entry.aliases.some(a => a === name)) return entry.canonicalName;
  }
  return name;
}

export function normalizeAndRegister(
  registry: TagRegistry,
  category: TagCategory,
  rawName: string,
  chapterNumber: number,
): { registry: TagRegistry; canonicalName: string } {
  const canonical = normalizeTag(registry, category, rawName);
  const id = `${category}:${canonical}`;
  const existing = registry.entries.find(e => e.id === id);
  if (existing) {
    if (chapterNumber > existing.lastSeenChapter) existing.lastSeenChapter = chapterNumber;
    if (canonical !== rawName.trim() && !existing.aliases.includes(rawName.trim())) {
      existing.aliases.push(rawName.trim());
    }
  } else {
    registry.entries.push({ id, category, canonicalName: canonical, aliases: [], lastSeenChapter: chapterNumber });
  }
  return { registry, canonicalName: canonical };
}
