import {
  createAssetLoaderNode,
  createChapterTaskNode,
  createContinuityNode,
  createDraftWriterNode,
  createIntakeNode,
  createStoryPlannerNode,
  createTargetedRevisionNode
} from '../nodes/base';
import { createMultiReviewNode } from '../nodes/multi-review-agent';

export function createNodeRegistry(reviewMode: 'pass' | 'revise' | 'escalate' = 'pass') {
  return [
    createIntakeNode(),
    createAssetLoaderNode(),
    createStoryPlannerNode(),
    createChapterTaskNode(),
    createDraftWriterNode(),
    createContinuityNode(),
    createMultiReviewNode(reviewMode),
    createTargetedRevisionNode()
  ];
}
