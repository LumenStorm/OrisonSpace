import { existsSync, readFileSync } from 'node:fs';
import YAML from 'yaml';
import type { AgentContract } from '@orison/shared-contracts';

interface Mismatch {
  field: string;
  message: string;
}

export function validatePromptYamlAgainstContract(promptPath: string, contract: AgentContract): Mismatch[] {
  if (!existsSync(promptPath)) {
    return [{ field: 'file', message: `file missing: ${promptPath}` }];
  }

  const content = YAML.parse(readFileSync(promptPath, 'utf8'));
  const mismatches: Mismatch[] = [];

  if (!content.system) mismatches.push({ field: 'system', message: 'missing system prompt' });
  if (!content.user) mismatches.push({ field: 'user', message: 'missing user prompt' });

  return mismatches;
}

export function validateAllPromptYamls(
  promptsDir: string,
  contracts: AgentContract[],
): Map<string, Mismatch[]> {
  const results = new Map<string, Mismatch[]>();
  for (const contract of contracts) {
    const promptPath = `${promptsDir}/${contract.id}.yaml`;
    const mismatches = validatePromptYamlAgainstContract(promptPath, contract);
    const nonFile = mismatches.filter((m) => m.field !== 'file');
    if (nonFile.length > 0) results.set(contract.id, nonFile);
  }
  return results;
}
