import type { NodeRunInput, NodeRunResult } from '../../contracts/run';
import type { OrchestrationNode } from '../base';

export function createMultiReviewNode(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass'): OrchestrationNode {
  return {
    id: 'multi-review-agent',
    async run(_input: NodeRunInput): Promise<NodeRunResult> {
      return {
        stateKey: 'review.latest',
        artifact: { mode: reviewMode },
        review: {
          verdict: reviewMode,
          summary: `Review result: ${reviewMode}`,
          reasons: reviewMode === 'pass' ? [] : ['quality gate triggered']
        }
      };
    }
  };
}
