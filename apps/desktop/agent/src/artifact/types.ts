export type ArtifactType =
  | 'document'
  | 'outline'
  | 'entity'
  | 'relationship'
  | 'timeline'
  | 'beat'
  | 'reference'
  | 'review_report'
  | 'task_brief';

export interface ArtifactRecord {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  tags: string[];
  runId?: string;
  reviewOf?: string;
}
