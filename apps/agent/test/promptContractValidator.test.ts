import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { validatePromptYamlAgainstContract, validateAllPromptYamls } from '../src/engine/promptContractValidator';
import { getAllAgentContracts, getAgentContract } from '../src/engine/agentContracts';

const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

describe('promptContractValidator', () => {
  it('story-planner-agent YAML 与 contract 一致', () => {
    const contract = getAgentContract('story-planner-agent')!;
    const mismatches = validatePromptYamlAgainstContract(
      path.join(PROMPTS_DIR, 'story-planner-agent.yaml'),
      contract
    );
    expect(mismatches).toEqual([]);
  });

  it('curve-planner-agent YAML 与 contract 一致', () => {
    const contract = getAgentContract('curve-planner-agent')!;
    const mismatches = validatePromptYamlAgainstContract(
      path.join(PROMPTS_DIR, 'curve-planner-agent.yaml'),
      contract
    );
    expect(mismatches).toEqual([]);
  });

  it('episode-planner-agent YAML 与 contract 一致', () => {
    const contract = getAgentContract('episode-planner-agent')!;
    const mismatches = validatePromptYamlAgainstContract(
      path.join(PROMPTS_DIR, 'episode-planner-agent.yaml'),
      contract
    );
    expect(mismatches).toEqual([]);
  });

  it('缺失文件返回 file missing', () => {
    const contract = getAgentContract('intake-agent')!;
    const mismatches = validatePromptYamlAgainstContract('/nonexistent/path.yaml', contract);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].field).toBe('file');
  });

  it('所有有 prompt YAML 的 agent 至少有 system 和 user', () => {
    const contracts = getAllAgentContracts();
    for (const contract of contracts) {
      const promptPath = path.join(PROMPTS_DIR, `${contract.id}.yaml`);
      const mismatches = validatePromptYamlAgainstContract(promptPath, contract);
      // 过滤掉 file missing（有些旧 agent 可能没有新格式 YAML）
      const nonFileMismatches = mismatches.filter((m) => m.field !== 'file');
      const systemMissing = nonFileMismatches.find((m) => m.field === 'system');
      const userMissing = nonFileMismatches.find((m) => m.field === 'user');
      expect(systemMissing, `${contract.id} 缺少 system prompt`).toBeUndefined();
      expect(userMissing, `${contract.id} 缺少 user prompt`).toBeUndefined();
    }
  });

  it('批量校验返回不一致的 agent 列表', () => {
    const contracts = getAllAgentContracts();
    const results = validateAllPromptYamls(PROMPTS_DIR, contracts);
    // 新格式的 3 个 YAML 应该完全一致
    expect(results.has('story-planner-agent')).toBe(false);
    expect(results.has('curve-planner-agent')).toBe(false);
    expect(results.has('episode-planner-agent')).toBe(false);
  });
});
