import type { CompiledSkill } from './compilerTypes';
import { createExecutionPlan, type ExecutionEdge, type ExecutionNode } from './executionPlan';
import {
  extractAgentCalls,
  extractAskUserMarkers,
  extractPhaseSections,
  extractReferenceLinks,
  extractSkillCalls,
} from './compilerRules';

export function compileDirectorySkill(skill: CompiledSkill): CompiledSkill {
  const phaseSections = extractPhaseSections(skill.rawPrompt);
  const nodes: ExecutionNode[] = [];
  const edges: ExecutionEdge[] = [];
  const capabilities = new Set(skill.capabilities);

  const appendEdge = (from: string, to: string) => {
    edges.push({ from, to });
  };

  let previousNodeId: string | undefined;
  const spawnedAgentTypes = new Set<string>();
  for (const phase of phaseSections) {
    nodes.push({
      id: phase.id,
      type: 'instruction',
      title: phase.title,
      content: phase.content,
    });
    if (previousNodeId) {
      appendEdge(previousNodeId, phase.id);
    }
    previousNodeId = phase.id;

    let lastPhaseNodeId = phase.id;

    for (const reference of extractReferenceLinks(phase.content)) {
      const nodeId = `${phase.id}:reference:${nodes.length}`;
      nodes.push({
        id: nodeId,
        type: 'load_reference',
        path: reference.path,
        mode: 'summary',
      });
      appendEdge(lastPhaseNodeId, nodeId);
      lastPhaseNodeId = nodeId;
      capabilities.add('load_reference');
    }

    for (const skillCall of extractSkillCalls(phase.content)) {
      const nodeId = `${phase.id}:skill:${nodes.length}`;
      nodes.push({
        id: nodeId,
        type: 'delegate_skill',
        skillName: skillCall.skillName,
      });
      appendEdge(lastPhaseNodeId, nodeId);
      lastPhaseNodeId = nodeId;
      capabilities.add('delegate_skill');
    }

    for (const marker of extractAskUserMarkers(phase.content)) {
      const nodeId = `${phase.id}:ask:${nodes.length}`;
      nodes.push({
        id: nodeId,
        type: 'ask_user',
        question: marker.question,
        choices: marker.choices,
      });
      appendEdge(lastPhaseNodeId, nodeId);
      lastPhaseNodeId = nodeId;
      capabilities.add('ask_user');
    }

    for (const agentCall of extractAgentCalls(phase.content)) {
      if (spawnedAgentTypes.has(agentCall.agentType)) continue;
      spawnedAgentTypes.add(agentCall.agentType);
      const nodeId = `${phase.id}:agent:${nodes.length}`;
      nodes.push({
        id: nodeId,
        type: 'spawn_agent',
        agentType: agentCall.agentType,
        prompt: agentCall.prompt ?? '',
      });
      appendEdge(lastPhaseNodeId, nodeId);
      lastPhaseNodeId = nodeId;
      capabilities.add('spawn_agent');
    }

    previousNodeId = lastPhaseNodeId;
  }

  const finishNodeId = 'finish';
  nodes.push({
    id: finishNodeId,
    type: 'finish',
  });
  if (previousNodeId) {
    appendEdge(previousNodeId, finishNodeId);
  }

  return {
    ...skill,
    capabilities: [...capabilities],
    compiledPlan: createExecutionPlan({
      entryNodeId: phaseSections[0]?.id ?? finishNodeId,
      nodes,
      edges,
    }),
  };
}
