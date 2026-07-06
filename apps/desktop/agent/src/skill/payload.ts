import path from 'node:path';
import type { NormalizedSkill } from './types';

export function renderSkillPayload(skill: NormalizedSkill): string {
  const sections: string[] = [`# Skill: ${skill.name}`];

  if (skill.description) {
    sections.push(`Description: ${skill.description}`);
  }

  if (skill.allowedTools?.length) {
    sections.push([
      'Allowed tools:',
      ...skill.allowedTools.map((tool) => `- ${tool}`),
    ].join('\n'));
  }

  const resources = listSkillResourcePaths(skill);
  if (resources.length > 0) {
    sections.push([
      'Resources:',
      ...resources.map((resource) => `- ${resource}`),
    ].join('\n'));
  }

  if (skill.prompt.trim()) {
    sections.push(['## Instructions', skill.prompt.trim()].join('\n\n'));
  }

  return sections.join('\n\n');
}

export function listSkillResourcePaths(skill: NormalizedSkill): string[] {
  const resourcePaths = [
    ...skill.assets.references,
    ...skill.assets.scripts,
    ...(skill.assets.assets ?? []),
  ];
  return resourcePaths
    .map((resource) => path.relative(skill.location, resource).replace(/\\/g, '/'))
    .sort();
}
