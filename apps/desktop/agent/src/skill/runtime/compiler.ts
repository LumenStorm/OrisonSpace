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

  // Pre-pass: which reference files are explicitly linked in the prompt (by
  // basename). Anything catalogued but not linked is auto-loaded up front so the
  // material is in context before the first instruction runs.
  const linkedReferenceBasenames = new Set(
    phaseSections.flatMap((phase) =>
      extractReferenceLinks(phase.content).map((ref) => basename(ref.path)),
    ),
  );
  const autoLoadReferences = skill.references.filter(
    (ref) => !linkedReferenceBasenames.has(basename(ref)),
  );

  let previousNodeId: string | undefined;
  let entryNodeId: string | undefined;
  for (const reference of autoLoadReferences) {
    const nodeId = `auto:reference:${nodes.length}`;
    nodes.push({
      id: nodeId,
      type: 'load_reference',
      path: reference,
      // Excerpt mode keeps large reference packs from blowing up the context
      // window; explicitly linked references stay 'full'.
      mode: autoLoadReferences.length > 5 ? 'excerpt' : 'full',
    });
    if (previousNodeId) {
      appendEdge(previousNodeId, nodeId);
    }
    entryNodeId ??= nodeId;
    previousNodeId = nodeId;
    capabilities.add('load_reference');
  }

  const spawnedAgentTypes = new Set<string>();
  for (const phase of phaseSections) {
    // Load this phase's linked references BEFORE its instruction node, so the
    // instruction prompt can actually see the reference material. (Previously
    // the instruction ran first and the references arrived a node too late.)
    for (const reference of extractReferenceLinks(phase.content)) {
      const nodeId = `${phase.id}:reference:${nodes.length}`;
      nodes.push({
        id: nodeId,
        type: 'load_reference',
        path: reference.path,
        // Load the full reference content; 'summary' truncated to ~3 lines and
        // made the injected material useless.
        mode: 'full',
      });
      if (previousNodeId) {
        appendEdge(previousNodeId, nodeId);
      }
      entryNodeId ??= nodeId;
      previousNodeId = nodeId;
      capabilities.add('load_reference');
    }

    nodes.push({
      id: phase.id,
      type: 'instruction',
      title: phase.title,
      content: phase.content,
    });
    if (previousNodeId) {
      appendEdge(previousNodeId, phase.id);
    }
    entryNodeId ??= phase.id;
    previousNodeId = phase.id;

    let lastPhaseNodeId = phase.id;

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
      entryNodeId: entryNodeId ?? phaseSections[0]?.id ?? finishNodeId,
      nodes,
      edges,
    }),
  };
}

// Cross-platform basename for both link paths (references/foo.md) and absolute
// catalogued paths (I:\skills\x\_reference\foo.md). Avoids node:path so this
// stays usable in any runtime the compiler runs under.
function basename(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] ?? filePath;
}
