export type ProjectRecord = {
  projectId: string;
  name: string;
  type: 'novel' | 'script';
  localFingerprint: string;
  createdAt: string;
  updatedAt: string;
};

export interface ProjectReadRepository {
  findByLocalFingerprint(localFingerprint: string): Promise<ProjectRecord | null>;
  existsById(projectId: string): Promise<boolean>;
}
