export interface RunSnapshot {
  runId: string;
  status: string;
  currentNodeId: string | null;
  projectPath: string;
  completedNodes: string[];
  pendingNodes: string[];
  artifacts: Record<string, unknown>;
  review: { verdict?: string; summary?: string; reasons?: string[] } | null;
  archive: { versionId: string; archivedAt?: string; promptFiles?: string[] } | null;
  delivery: { deliveryId: string } | null;
  feedback: { feedbackId: string } | null;
}

export interface NodeRunInput {
  run: RunSnapshot;
  requirement: string;
}
