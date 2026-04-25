import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { AgentContract } from '@orison/shared-contracts';

type PromptYamlContent = {
  agent_id?: string;
  role?: string;
  goal?: string;
  inputs?: { from_state?: string[] };
  outputs?: { state_key?: string; schema?: string };
  must?: string[];
  must_not?: string[];
  quality_gates?: string[];
  system?: string;
  user?: string;
};

export type PromptContractMismatch = {
  field: string;
  expected: unknown;
  actual: unknown;
};

/**
 * 加载 Prompt YAML 并校验其与 AgentContract 的一致性。
 * 返回不一致项列表，空数组表示完全一致。
 */
export function validatePromptYamlAgainstContract(
  promptPath: string,
  contract: AgentContract
): PromptContractMismatch[] {
  if (!existsSync(promptPath)) {
    return [{ field: 'file', expected: promptPath, actual: 'missing' }];
  }

  const raw = readFileSync(promptPath, 'utf8');
  const yaml = YAML.parse(raw) as PromptYamlContent;
  const mismatches: PromptContractMismatch[] = [];

  // agent_id 一致性（如果 YAML 中声明了 agent_id）
  if (yaml.agent_id && yaml.agent_id !== contract.id) {
    mismatches.push({ field: 'agent_id', expected: contract.id, actual: yaml.agent_id });
  }

  // must 一致性（如果 YAML 中声明了 must）
  if (yaml.must) {
    const yamlMust = new Set(yaml.must);
    for (const m of contract.must) {
      if (!yamlMust.has(m)) {
        mismatches.push({ field: 'must', expected: m, actual: 'missing in YAML' });
      }
    }
  }

  // must_not 一致性（如果 YAML 中声明了 must_not）
  if (yaml.must_not) {
    const yamlMustNot = new Set(yaml.must_not);
    for (const m of contract.mustNot) {
      if (!yamlMustNot.has(m)) {
        mismatches.push({ field: 'must_not', expected: m, actual: 'missing in YAML' });
      }
    }
  }

  // quality_gates 一致性（如果 YAML 中声明了 quality_gates）
  if (yaml.quality_gates) {
    const yamlGates = new Set(yaml.quality_gates);
    for (const g of contract.qualityGates) {
      if (!yamlGates.has(g)) {
        mismatches.push({ field: 'quality_gates', expected: g, actual: 'missing in YAML' });
      }
    }
  }

  // inputs.from_state 与 contract.reads 一致性
  if (yaml.inputs?.from_state) {
    const yamlReads = new Set(yaml.inputs.from_state);
    for (const r of contract.reads) {
      if (!yamlReads.has(r)) {
        mismatches.push({ field: 'inputs.from_state', expected: r, actual: 'missing in YAML' });
      }
    }
  }

  // outputs.state_key 与 contract.owns 一致性
  if (yaml.outputs?.state_key && contract.owns.length > 0) {
    if (!contract.owns.includes(yaml.outputs.state_key as never)) {
      mismatches.push({ field: 'outputs.state_key', expected: contract.owns, actual: yaml.outputs.state_key });
    }
  }

  // 必须有 system 和 user prompt
  if (!yaml.system) {
    mismatches.push({ field: 'system', expected: 'non-empty string', actual: 'missing' });
  }
  if (!yaml.user) {
    mismatches.push({ field: 'user', expected: 'non-empty string', actual: 'missing' });
  }

  return mismatches;
}

/**
 * 批量校验所有 prompt YAML 与 contract 的一致性
 */
export function validateAllPromptYamls(
  promptDir: string,
  contracts: AgentContract[]
): Map<string, PromptContractMismatch[]> {
  const results = new Map<string, PromptContractMismatch[]>();

  for (const contract of contracts) {
    const promptPath = path.join(promptDir, `${contract.id}.yaml`);
    const mismatches = validatePromptYamlAgainstContract(promptPath, contract);
    if (mismatches.length > 0) {
      results.set(contract.id, mismatches);
    }
  }

  return results;
}
