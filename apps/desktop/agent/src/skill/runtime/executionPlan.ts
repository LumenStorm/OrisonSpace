import type { PrimitiveNodeType } from './compilerTypes';

interface BaseExecutionNode {
  id: string;
  type: PrimitiveNodeType;
  title?: string;
}

export type ExecutionNode =
  | (BaseExecutionNode & {
    type: 'instruction';
    content: string;
  })
  | (BaseExecutionNode & {
    type: 'load_reference';
    path: string;
    mode: 'full' | 'excerpt' | 'summary';
  })
  | (BaseExecutionNode & {
    type: 'run_script';
    scriptPath: string;
    args?: string[];
  })
  | (BaseExecutionNode & {
    type: 'delegate_skill';
    skillName: string;
    input?: string;
  })
  | (BaseExecutionNode & {
    type: 'ask_user';
    question: string;
    choices?: string[];
  })
  | (BaseExecutionNode & {
    type: 'spawn_agent';
    agentType: string;
    prompt: string;
  })
  | (BaseExecutionNode & {
    type: 'read_artifact';
    artifactId: string;
  })
  | (BaseExecutionNode & {
    type: 'write_artifact';
    artifactType: string;
    targetPath?: string;
  })
  | (BaseExecutionNode & {
    type: 'checkpoint';
    label?: string;
  })
  | (BaseExecutionNode & {
    type: 'branch';
    condition: string;
  })
  | (BaseExecutionNode & {
    type: 'finish';
  });

export interface ExecutionEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface ExecutionPlan {
  entryNodeId: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
}

export interface ExecutionCursor {
  currentNodeId: string;
  completedNodeIds: string[];
}

export interface ExecutionPlanState {
  cursor: ExecutionCursor;
}

export function createExecutionPlan(input: ExecutionPlan): ExecutionPlan {
  return {
    entryNodeId: input.entryNodeId,
    nodes: input.nodes,
    edges: input.edges,
  };
}
