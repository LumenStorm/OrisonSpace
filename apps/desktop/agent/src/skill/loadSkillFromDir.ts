import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { NormalizedSkill } from './types';
import { parseSkillFile } from './loader';
import { classifyOhStorySkill } from './runtime/ohStoryAdapter';
import { loadDirectorySkill } from './runtime/directoryAdapter';
import { loadManifestSkill } from './runtime/manifestAdapter';

type SkillSource = NonNullable<NormalizedSkill['source']>;

/**
 * Outcome of attempting to load a single skill directory.
 * - `loaded`: a usable skill — should be listed in the prompt AND registered for execution.
 * - `blocked`: explicitly blocked by the oh-story adapter — skipped everywhere so it
 *   neither appears in the prompt nor gets registered.
 * - `skipped`: the directory contains no recognizable skill entry.
 */
export type LoadSkillOutcome =
  | { kind: 'loaded'; skill: NormalizedSkill }
  | { kind: 'blocked' }
  | { kind: 'skipped' };

/**
 * Single source of truth for loading a skill from a directory.
 *
 * Both the prompt-listing path (`discoverSkills`) and the execution-registration
 * path (`loadProjectSkills`) call this, so "what is listed" always equals "what is
 * registered / invokable". The loader chain mirrors what execution needs:
 *   1. oh-story adapter (routable rename / router / blocked)
 *   2. standard directory skill (SKILL.md + references/scripts)
 *   3. manifest skill (skill.json)
 *   4. bare SKILL.md fallback (prompt-only skill)
 */
export async function loadSkillFromDir(entryDir: string, source?: SkillSource): Promise<LoadSkillOutcome> {
  const tag = (skill: NormalizedSkill): NormalizedSkill =>
    source ? { ...skill, source } : skill;

  // 1. oh-story adapter — handles routable rename, router, and blocked skills.
  try {
    const classified = await classifyOhStorySkill(entryDir);
    if (classified.kind === 'blocked') return { kind: 'blocked' };
    if (classified.kind === 'loaded') return { kind: 'loaded', skill: tag(classified.skill) };
    // not-applicable → fall through
  } catch {
    // Fall through to standard loading.
  }

  // 2. standard directory skill
  try {
    const skill = await loadDirectorySkill(entryDir);
    return { kind: 'loaded', skill: tag(skill) };
  } catch {
    // Fall through.
  }

  // 3. manifest skill
  try {
    const skill = await loadManifestSkill(path.join(entryDir, 'skill.json'));
    return { kind: 'loaded', skill: tag(skill) };
  } catch {
    // Fall through.
  }

  // 4. bare SKILL.md fallback — prompt-only skill (no compiled workflow).
  const skillMd = path.join(entryDir, 'SKILL.md');
  if (existsSync(skillMd)) {
    try {
      const raw = await readFile(skillMd, 'utf-8');
      const parsed = parseSkillFile(raw, skillMd);
      if (parsed) {
        const normalized: NormalizedSkill = {
          format: 'directory',
          name: parsed.name,
          description: parsed.description,
          location: entryDir,
          entryPath: skillMd,
          prompt: parsed.content,
          workflowMode: 'prompt',
          assets: { references: [], scripts: [] },
          priority: parsed.priority,
        };
        return { kind: 'loaded', skill: tag(normalized) };
      }
    } catch {
      // Fall through to skipped.
    }
  }

  return { kind: 'skipped' };
}
