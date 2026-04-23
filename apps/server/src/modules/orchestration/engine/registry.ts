import type { PythonNodeConfig } from '../contracts/pythonExecutor';

export type PythonRegistryNode = {
  id: string;
  runtime: 'python';
  config: PythonNodeConfig;
  prompt: {
    system: string;
    user: string;
  };
};

export type RegistryNode = PythonRegistryNode;

function createPythonNode(
  id: string,
  entry: string,
  stateKey: string,
  artifactType: string,
  prompt: { system: string; user: string },
  reviewMode?: 'pass' | 'revise' | 'escalate'
): PythonRegistryNode {
  return {
    id,
    runtime: 'python',
    config: {
      agentId: id,
      runtime: 'python',
      entry,
      model: 'gpt-5.4',
      execution: {
        timeoutMs: 30000,
        maxRetries: 2
      },
      prompt: {
        file: `./project-config/prompts/${id}.yaml`,
        systemKey: 'system',
        userKey: 'user'
      },
      inputs: {
        fromState: [],
        mappings: {
          requirement: 'intake.requirement'
        }
      },
      outputs: {
        artifactType,
        stateKey
      },
      review: {
        passRules: reviewMode ? ['review_passes'] : [],
        escalateOn: reviewMode ? ['review_escalates'] : []
      }
    },
    prompt
  };
}

export function createNodeRegistry(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass'): RegistryNode[] {
  return [
    createPythonNode(
      'intake-agent',
      'python-agent/nodes/intake_agent.py',
      'intake.requirement',
      'requirement',
      {
        system: 'You normalize user requirements.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'asset-loader-agent',
      'python-agent/nodes/asset_loader_agent.py',
      'assets.projectContext',
      'project_context',
      {
        system: 'You load project assets.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'story-planner-agent',
      'python-agent/nodes/story_planner_agent.py',
      'planning.storyPlan',
      'story_plan',
      {
        system: 'You are a story planner.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'chapter-task-agent',
      'python-agent/nodes/chapter_task_agent.py',
      'planning.chapterTasks',
      'chapter_tasks',
      {
        system: 'You break plans into chapter tasks.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'draft-writer-agent',
      'python-agent/nodes/draft_writer_agent.py',
      'draft.initial',
      'draft',
      {
        system: 'You write the first draft.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'continuity-memory-agent',
      'python-agent/nodes/continuity_memory_agent.py',
      'memory.continuity',
      'continuity_memory',
      {
        system: 'You update continuity memory.',
        user: 'Requirement: {{requirement}}'
      }
    ),
    createPythonNode(
      'multi-review-agent',
      'python-agent/nodes/multi_review_agent.py',
      'review.latest',
      'review',
      {
        system: 'You review the generated content.',
        user: `Review mode: ${reviewMode}. Requirement: {{requirement}}`
      },
      reviewMode
    ),
    createPythonNode(
      'targeted-revision-agent',
      'python-agent/nodes/targeted_revision_agent.py',
      'draft.revision',
      'draft_revision',
      {
        system: 'You revise the draft based on review feedback.',
        user: 'Requirement: {{requirement}}'
      }
    )
  ];
}
