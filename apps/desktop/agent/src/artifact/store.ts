import type { ArtifactRecord } from './types';

export interface ArtifactStore {
  list(): ArtifactRecord[];
  read(id: string): ArtifactRecord | undefined;
  write(record: ArtifactRecord): void;
  attachToRun(id: string, runId: string): void;
  recordReviewOutput(id: string, reviewContent: string): ArtifactRecord | undefined;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly records = new Map<string, ArtifactRecord>();

  list(): ArtifactRecord[] {
    return [...this.records.values()];
  }

  read(id: string): ArtifactRecord | undefined {
    return this.records.get(id);
  }

  write(record: ArtifactRecord): void {
    this.records.set(record.id, record);
  }

  attachToRun(id: string, runId: string): void {
    const record = this.records.get(id);
    if (!record) return;
    this.records.set(id, { ...record, runId });
  }

  recordReviewOutput(id: string, reviewContent: string): ArtifactRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    const review: ArtifactRecord = {
      id: `${id}:review`,
      type: 'review_report',
      title: `${record.title} review`,
      content: reviewContent,
      tags: [...record.tags, 'review'],
      reviewOf: id,
      runId: record.runId,
    };
    this.records.set(review.id, review);
    return review;
  }
}
