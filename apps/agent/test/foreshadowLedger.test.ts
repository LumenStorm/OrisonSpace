import { describe, expect, it } from 'vitest';
import {
  calculateForeshadowUrgency,
  buildForeshadowContext,
  markForeshadowPlanted,
  markForeshadowResolved,
  syncForeshadowRegistryFromEpisodes
} from '../src/engine/foreshadowLedger';

describe('foreshadowLedger', () => {
  it('creates stable registry entries from episode foreshadowing without duplicates', () => {
    const first = syncForeshadowRegistryFromEpisodes({
      registry: { items: [], version: 0, updatedBy: 'agent' },
      episodeOutlines: [
        {
          id: 'ep_1',
          index: 1,
          title: 'The Red Key',
          foreshadowing: ['A red key is shown under the ash tree'],
          payoffs: [],
          status: 'planned'
        }
      ]
    });

    const second = syncForeshadowRegistryFromEpisodes({
      registry: first.registry,
      episodeOutlines: [
        {
          id: 'ep_1',
          index: 1,
          title: 'The Red Key',
          foreshadowing: ['A red key is shown under the ash tree'],
          payoffs: [],
          status: 'planned'
        }
      ]
    });

    expect(first.registry.items).toHaveLength(1);
    expect(second.registry.items).toHaveLength(1);
    expect(second.registry.items[0].id).toBe(first.registry.items[0].id);
    expect(second.created).toEqual([]);
  });

  it('resolves only an existing planted foreshadow and reports unmatched payoffs', () => {
    const planted = markForeshadowPlanted(
      {
        items: [
          {
            id: 'fs_red_key',
            title: 'red key',
            content: 'A red key is shown under the ash tree',
            plant_ref: 'ep_1',
            plant_index: 1,
            target_resolve_ref: 'ep_4',
            target_resolve_index: 4,
            status: 'pending',
            sourceRefs: []
          }
        ],
        version: 0,
        updatedBy: 'agent'
      },
      'fs_red_key',
      { ref: 'ep_1', index: 1, hintText: 'red key under the ash tree' }
    );

    const synced = syncForeshadowRegistryFromEpisodes({
      registry: planted,
      episodeOutlines: [
        {
          id: 'ep_4',
          index: 4,
          title: 'The Locked Tower',
          foreshadowing: [],
          payoffs: ['red key opens the locked tower', 'unknown prophecy is fulfilled'],
          status: 'planned'
        }
      ]
    });

    expect(synced.registry.items).toHaveLength(1);
    expect(synced.resolved.map((item) => item.id)).toEqual(['fs_red_key']);
    expect(synced.registry.items[0].status).toBe('resolved');
    expect(synced.registry.items[0].actual_resolve_ref).toBe('ep_4');
    expect(synced.unmatchedPayoffs).toEqual(['unknown prophecy is fulfilled']);
  });

  it('keeps duplicate resolve requests idempotent', () => {
    const registry = {
      items: [
        {
          id: 'fs_red_key',
          title: 'red key',
          content: 'A red key is shown under the ash tree',
          status: 'resolved',
          actual_resolve_ref: 'ep_4',
          actual_resolve_index: 4,
          sourceRefs: []
        }
      ],
      version: 3,
      updatedBy: 'agent' as const
    };

    const resolved = markForeshadowResolved(registry, 'fs_red_key', {
      ref: 'ep_4',
      index: 4,
      resolutionText: 'red key opens the locked tower'
    });

    expect(resolved.items[0].status).toBe('resolved');
    expect(resolved.items[0].actual_resolve_ref).toBe('ep_4');
    expect(resolved.version).toBe(3);
  });

  it('builds chapter context buckets and urgency levels', () => {
    const registry = {
      items: [
        {
          id: 'fs_due',
          title: 'red key',
          content: 'A red key is shown under the ash tree',
          status: 'planted',
          plant_ref: 'ep_1',
          plant_index: 1,
          target_resolve_ref: 'ep_5',
          target_resolve_index: 5,
          remind_before_units: 2,
          include_in_context: true,
          sourceRefs: []
        },
        {
          id: 'fs_overdue',
          title: 'broken moon',
          content: 'The moon cracks whenever the gate opens',
          status: 'planted',
          plant_ref: 'ep_2',
          plant_index: 2,
          target_resolve_ref: 'ep_3',
          target_resolve_index: 3,
          include_in_context: true,
          sourceRefs: []
        }
      ],
      version: 1,
      updatedBy: 'agent' as const
    };

    const context = buildForeshadowContext(registry, 4);

    expect(calculateForeshadowUrgency(registry.items[0], 4)).toBe(2);
    expect(calculateForeshadowUrgency(registry.items[1], 4)).toBe(3);
    expect(context.pendingResolve.map((item) => item.id)).toContain('fs_due');
    expect(context.overdue.map((item) => item.id)).toContain('fs_overdue');
    expect(context.contextText).toContain('red key');
    expect(context.contextText).toContain('broken moon');
  });
});
