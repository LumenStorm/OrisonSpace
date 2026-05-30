import crypto from 'node:crypto';

interface ForeshadowItem {
  id: string;
  title: string;
  content: string;
  plant_ref?: string;
  plant_index?: number;
  target_resolve_ref?: string;
  target_resolve_index?: number;
  actual_resolve_ref?: string;
  actual_resolve_index?: number;
  status: string;
  remind_before_units?: number;
  include_in_context?: boolean;
  sourceRefs: string[];
}

interface ForeshadowRegistry {
  items: ForeshadowItem[];
  version: number;
  updatedBy: string;
}

interface EpisodeOutline {
  id: string;
  index: number;
  title: string;
  foreshadowing: string[];
  payoffs: string[];
  status: string;
}

export function syncForeshadowRegistryFromEpisodes(input: {
  registry: ForeshadowRegistry;
  episodeOutlines: EpisodeOutline[];
}): { registry: ForeshadowRegistry; created: ForeshadowItem[]; resolved: ForeshadowItem[]; unmatchedPayoffs: string[] } {
  const { registry, episodeOutlines } = input;
  const created: ForeshadowItem[] = [];
  const resolved: ForeshadowItem[] = [];
  const unmatchedPayoffs: string[] = [];

  // Create entries from foreshadowing
  for (const ep of episodeOutlines) {
    for (const hint of ep.foreshadowing) {
      const exists = registry.items.some((item) => item.content === hint);
      if (!exists) {
        const item: ForeshadowItem = {
          id: `fs_${crypto.randomUUID().slice(0, 8)}`,
          title: hint.slice(0, 20),
          content: hint,
          plant_ref: ep.id,
          plant_index: ep.index,
          status: 'pending',
          sourceRefs: [],
        };
        registry.items.push(item);
        created.push(item);
      }
    }
  }

  // Resolve from payoffs
  for (const ep of episodeOutlines) {
    for (const payoff of ep.payoffs) {
      const matched = registry.items.find(
        (item) => (item.status === 'planted' || item.status === 'pending') &&
          item.target_resolve_ref === ep.id &&
          payoff.toLowerCase().includes(item.title.toLowerCase()),
      );
      if (matched) {
        matched.status = 'resolved';
        matched.actual_resolve_ref = ep.id;
        matched.actual_resolve_index = ep.index;
        resolved.push(matched);
      } else {
        unmatchedPayoffs.push(payoff);
      }
    }
  }

  return { registry, created, resolved, unmatchedPayoffs };
}

export function markForeshadowPlanted(
  registry: ForeshadowRegistry,
  id: string,
  info: { ref: string; index: number; hintText: string },
): ForeshadowRegistry {
  const item = registry.items.find((i) => i.id === id);
  if (item) {
    item.status = 'planted';
    item.plant_ref = info.ref;
    item.plant_index = info.index;
  }
  return registry;
}

export function markForeshadowResolved(
  registry: ForeshadowRegistry,
  id: string,
  info: { ref: string; index: number; resolutionText: string },
): ForeshadowRegistry {
  const item = registry.items.find((i) => i.id === id);
  if (item && item.status !== 'resolved') {
    item.status = 'resolved';
    item.actual_resolve_ref = info.ref;
    item.actual_resolve_index = info.index;
    registry.version++;
  }
  return registry;
}

export function calculateForeshadowUrgency(item: ForeshadowItem, currentIndex: number): number {
  if (!item.target_resolve_index) return 0;
  const distance = item.target_resolve_index - currentIndex;
  if (distance <= 0) return 3; // overdue
  if (item.remind_before_units && distance <= item.remind_before_units) return 2; // due soon
  return 1; // not urgent
}

export function buildForeshadowContext(
  registry: ForeshadowRegistry,
  currentIndex: number,
): { pendingResolve: ForeshadowItem[]; overdue: ForeshadowItem[]; contextText: string } {
  const pendingResolve: ForeshadowItem[] = [];
  const overdue: ForeshadowItem[] = [];

  for (const item of registry.items) {
    if (item.status === 'resolved' || !item.include_in_context) continue;
    const urgency = calculateForeshadowUrgency(item, currentIndex);
    if (urgency === 3) overdue.push(item);
    else if (urgency >= 1) pendingResolve.push(item);
  }

  const all = [...overdue, ...pendingResolve];
  const contextText = all.map((i) => `[${i.title}] ${i.content}`).join('\n');

  return { pendingResolve, overdue, contextText };
}
