type NodeProgressProps = {
  completedNodes: string[];
  pendingNodes: string[];
  currentNodeId: string | null;
};

export function NodeProgress({ completedNodes, pendingNodes, currentNodeId }: NodeProgressProps) {
  const allNodes = [
    ...completedNodes,
    ...(currentNodeId && !completedNodes.includes(currentNodeId) ? [currentNodeId] : []),
    ...pendingNodes,
  ];

  return (
    <ul className="orchestration-nodes" aria-label="Node Progress">
      {allNodes.map((nodeId) => {
        const isDone = completedNodes.includes(nodeId);
        const isCurrent = nodeId === currentNodeId;
        const status = isDone ? 'done' : isCurrent ? 'running' : 'pending';
        return (
          <li key={nodeId} data-status={status}>
            <span className="node-indicator">{isDone ? '\u2713' : isCurrent ? '\u25B6' : '\u25CB'}</span>
            {' '}{nodeId}
          </li>
        );
      })}
    </ul>
  );
}
