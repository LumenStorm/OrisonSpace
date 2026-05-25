import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryArtifactStore } from '../src/artifact/store';
import { buildSkillContext } from '../src/context/builder';

describe('skill reference resolver', () => {
  let root = '';
  let skillDir = '';
  let referencePath = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-reference-resolver-'));
    skillDir = path.join(root, 'story');
    referencePath = path.join(skillDir, 'references', 'opening-design.md');
    mkdirSync(path.dirname(referencePath), { recursive: true });
    writeFileSync(referencePath, `# Opening Design

line one
line two
line three
line four
`, 'utf-8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves relative reference paths and loads content in full, excerpt, and summary modes', async () => {
    const resolver = await import('../src/skill/runtime/referenceResolver');

    expect(resolver.resolveReferencePath(skillDir, 'references/opening-design.md')).toBe(referencePath);

    const full = await resolver.loadReference({
      skillDir,
      referencePath: 'references/opening-design.md',
      mode: 'full',
    });
    expect(full.content).toContain('line four');

    const excerpt = await resolver.loadReference({
      skillDir,
      referencePath: 'references/opening-design.md',
      mode: 'excerpt',
      maxLines: 2,
    });
    expect(excerpt.content).toContain('line one');
    expect(excerpt.content).not.toContain('line four');

    const summary = await resolver.loadReference({
      skillDir,
      referencePath: 'references/opening-design.md',
      mode: 'summary',
    });
    expect(summary.content).toContain('# Opening Design');
    expect(summary.content.length).toBeLessThan(full.content.length);
  });

  it('reuses cached reference payloads within the same run', async () => {
    const resolver = await import('../src/skill/runtime/referenceResolver');

    const cache = new Map<string, Awaited<ReturnType<typeof resolver.loadReference>>>();

    const first = await resolver.loadReference({
      skillDir,
      referencePath: 'references/opening-design.md',
      mode: 'summary',
      cache,
    });
    const second = await resolver.loadReference({
      skillDir,
      referencePath: 'references/opening-design.md',
      mode: 'summary',
      cache,
    });

    expect(second).toBe(first);
    expect(cache.size).toBe(1);
  });

  it('adds resolvedReferences and referenceCache to the skill runtime context', async () => {
    const resolver = await import('../src/skill/runtime/referenceResolver');
    const artifactStore = new InMemoryArtifactStore();
    const referenceCache = new Map<string, Awaited<ReturnType<typeof resolver.loadReference>>>();

    const skillContext = buildSkillContext({
      sessionId: 'session-1',
      runStatus: 'running',
      recentSummary: 'working on a story',
      artifactStore,
      resolvedReferences: [
        await resolver.loadReference({
          skillDir,
          referencePath: 'references/opening-design.md',
          mode: 'summary',
          cache: referenceCache,
        }),
      ],
      referenceCache,
    });

    expect(skillContext.resolvedReferences).toHaveLength(1);
    expect(skillContext.resolvedReferences[0]?.path).toBe(referencePath);
    expect(skillContext.referenceCache).toBe(referenceCache);
  });
});
