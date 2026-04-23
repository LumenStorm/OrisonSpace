export function routeReview(verdict: 'pass' | 'revise' | 'escalate') {
  if (verdict === 'pass') return { status: 'approved' as const, currentNodeId: null };
  if (verdict === 'revise') return { status: 'revision_pending' as const, currentNodeId: 'targeted-revision-agent' };
  return { status: 'human_in_loop' as const, currentNodeId: null };
}
