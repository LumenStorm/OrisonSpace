import crypto from 'node:crypto';
import {
  foreshadowEntrySchema,
  foreshadowRegistrySchema,
  type ForeshadowEntry,
  type ForeshadowRegistry
} from '@orison/shared-contracts';

type EpisodeForeshadowSource = {
  id: string;
  index: number;
  title?: string;
  foreshadowing?: string[];
  payoffs?: string[];
  status?: string;
};

type EpisodeSyncInput = {
  registry: unknown;
  episodeOutlines: EpisodeForeshadowSource[];
};

type RegistrySyncResult = {
  registry: ForeshadowRegistry;
  created: ForeshadowEntry[];
  resolved: ForeshadowEntry[];
  unmatchedPayoffs: string[];
};

type ForeshadowContext = {
  currentIndex: number;
  contextText: string;
  pendingPlant: ForeshadowEntry[];
  pendingResolve: ForeshadowEntry[];
  overdue: ForeshadowEntry[];
  recentlyPlanted: ForeshadowEntry[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokens(value: string): Set<string> {
  const tokens = normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

export function generateStableForeshadowId(sourceRef: string, content: string, kind = 'plant'): string {
  const digest = crypto
    .createHash('sha1')
    .update(`${kind}:${sourceRef}:${normalizeText(content)}`)
    .digest('hex')
    .slice(0, 16);
  return `fs_${digest}`;
}

function cloneRegistry(registry: unknown): ForeshadowRegistry {
  return foreshadowRegistrySchema.parse(registry ?? { items: [] });
}

function titleFromContent(content: string): string {
  const normalized = content.trim();
  if (normalized.length <= 48) return normalized;
  return `${normalized.slice(0, 45).trim()}...`;
}

function bumpVersion(registry: ForeshadowRegistry): ForeshadowRegistry {
  return {
    ...registry,
    version: registry.version + 1,
    updatedBy: 'agent'
  };
}

function findExistingPlant(items: ForeshadowEntry[], sourceMemoryId: string, episodeId: string, content: string): ForeshadowEntry | undefined {
  const normalized = normalizeText(content);
  return items.find((item) => {
    if (item.source_memory_id === sourceMemoryId) return true;
    return item.plant_ref === episodeId && normalizeText(item.content) === normalized;
  });
}

function scoreForeshadowMatch(item: ForeshadowEntry, payoffText: string): number {
  const payoff = normalizeText(payoffText);
  const title = normalizeText(item.title);
  if (title && payoff.includes(title)) return 10;

  const payoffTokens = contentTokens(payoffText);
  if (payoffTokens.size === 0) return 0;

  let score = 0;
  for (const token of contentTokens(item.content)) {
    if (payoffTokens.has(token)) score += 1;
  }
  return score;
}

function findPayoffTarget(items: ForeshadowEntry[], payoffText: string): ForeshadowEntry | undefined {
  let best: ForeshadowEntry | undefined;
  let bestScore = 0;

  for (const item of items) {
    if (item.status !== 'planted' && item.status !== 'partially_resolved') continue;
    const score = scoreForeshadowMatch(item, payoffText);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : undefined;
}

export function markForeshadowPlanted(
  registryInput: unknown,
  foreshadowId: string,
  params: { ref: string; index: number; hintText?: string }
): ForeshadowRegistry {
  const registry = cloneRegistry(registryInput);
  const itemIndex = registry.items.findIndex((item) => item.id === foreshadowId);
  if (itemIndex < 0) return registry;

  const current = registry.items[itemIndex];
  if (current.status !== 'pending') return registry;

  const updated: ForeshadowEntry = {
    ...current,
    status: 'planted',
    plant_ref: params.ref,
    plant_index: params.index,
    hint_text: params.hintText ?? current.hint_text,
    planted_at: nowIso(),
    updated_at: nowIso()
  };

  const items = [...registry.items];
  items[itemIndex] = updated;
  return bumpVersion({ ...registry, items });
}

export function markForeshadowResolved(
  registryInput: unknown,
  foreshadowId: string,
  params: { ref: string; index: number; resolutionText?: string; partial?: boolean }
): ForeshadowRegistry {
  const registry = cloneRegistry(registryInput);
  const itemIndex = registry.items.findIndex((item) => item.id === foreshadowId);
  if (itemIndex < 0) return registry;

  const current = registry.items[itemIndex];
  if (current.status === 'resolved') return registry;
  if (current.status !== 'planted' && current.status !== 'partially_resolved') return registry;

  const updated: ForeshadowEntry = {
    ...current,
    status: params.partial ? 'partially_resolved' : 'resolved',
    actual_resolve_ref: params.ref,
    actual_resolve_index: params.index,
    resolution_text: params.resolutionText ?? current.resolution_text,
    resolved_at: params.partial ? current.resolved_at : nowIso(),
    updated_at: nowIso()
  };

  const items = [...registry.items];
  items[itemIndex] = updated;
  return bumpVersion({ ...registry, items });
}

export function syncForeshadowRegistryFromEpisodes(input: EpisodeSyncInput): RegistrySyncResult {
  let registry = cloneRegistry(input.registry);
  const created: ForeshadowEntry[] = [];
  const resolved: ForeshadowEntry[] = [];
  const unmatchedPayoffs: string[] = [];

  for (const episode of input.episodeOutlines) {
    for (const [index, content] of (episode.foreshadowing ?? []).entries()) {
      if (!content.trim()) continue;
      const sourceRef = `episode:${episode.id}:foreshadowing:${index}`;
      const sourceMemoryId = `plant:${sourceRef}:${normalizeText(content)}`;
      const existing = findExistingPlant(registry.items, sourceMemoryId, episode.id, content);
      if (existing) continue;

      const createdAt = nowIso();
      const entry = foreshadowEntrySchema.parse({
        id: generateStableForeshadowId(sourceRef, content),
        title: titleFromContent(content),
        content,
        source_type: 'agent',
        source_memory_id: sourceMemoryId,
        plant_ref: episode.id,
        plant_index: episode.index,
        status: episode.status === 'planned' ? 'pending' : 'planted',
        sourceRefs: [sourceRef],
        created_at: createdAt,
        updated_at: createdAt
      });

      registry = bumpVersion({ ...registry, items: [...registry.items, entry] });
      created.push(entry);
    }

    for (const payoff of episode.payoffs ?? []) {
      if (!payoff.trim()) continue;
      const target = findPayoffTarget(registry.items, payoff);
      if (!target) {
        unmatchedPayoffs.push(payoff);
        continue;
      }

      const beforeVersion = registry.version;
      registry = markForeshadowResolved(registry, target.id, {
        ref: episode.id,
        index: episode.index,
        resolutionText: payoff
      });
      if (registry.version !== beforeVersion) {
        const updated = registry.items.find((item) => item.id === target.id);
        if (updated) resolved.push(updated);
      }
    }
  }

  return { registry, created, resolved, unmatchedPayoffs };
}

export function calculateForeshadowUrgency(entryInput: unknown, currentIndex: number): number {
  const entry = foreshadowEntrySchema.parse(entryInput);
  if (entry.status !== 'planted' || entry.target_resolve_index == null) return 0;

  const remaining = entry.target_resolve_index - currentIndex;
  if (remaining < 0) return 3;
  if (remaining <= 2) return 2;
  if (remaining <= entry.remind_before_units) return 1;
  return 0;
}

export function buildForeshadowContext(
  registryInput: unknown,
  currentIndex: number,
  options?: { lookahead?: number; recentWindow?: number }
): ForeshadowContext {
  const registry = cloneRegistry(registryInput);
  const lookahead = options?.lookahead ?? 5;
  const recentWindow = options?.recentWindow ?? 3;
  const usable = registry.items.filter((item) => item.include_in_context);

  const pendingPlant = usable.filter(
    (item) => item.status === 'pending' && item.plant_index === currentIndex
  );
  const overdue = usable.filter((item) => calculateForeshadowUrgency(item, currentIndex) === 3);
  const pendingResolve = usable.filter((item) => {
    if (item.status !== 'planted' || item.target_resolve_index == null) return false;
    const distance = item.target_resolve_index - currentIndex;
    return distance >= 0 && distance <= lookahead;
  });
  const recentlyPlanted = usable.filter((item) => {
    if (item.status !== 'planted' || item.plant_index == null) return false;
    const distance = currentIndex - item.plant_index;
    return distance > 0 && distance <= recentWindow;
  });

  const contextLines = [
    ...pendingPlant.map((item) => `plant now: ${item.title} - ${item.content}`),
    ...pendingResolve.map((item) => `resolve soon: ${item.title} - target ${item.target_resolve_ref ?? item.target_resolve_index}`),
    ...overdue.map((item) => `overdue: ${item.title} - target ${item.target_resolve_ref ?? item.target_resolve_index}`),
    ...recentlyPlanted.map((item) => `recently planted: ${item.title} - ${item.content}`)
  ];

  return {
    currentIndex,
    contextText: contextLines.join('\n'),
    pendingPlant,
    pendingResolve,
    overdue,
    recentlyPlanted
  };
}
