import path from 'node:path';

const MANAGED_PROJECT_DOCUMENT = 'project.yaml';

export function isManagedProjectDocumentPath(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === MANAGED_PROJECT_DOCUMENT;
}

export function assertNotManagedProjectDocument(filePath: string): void {
  if (isManagedProjectDocumentPath(filePath)) {
    throw new Error('Managed project document must be changed through structured project APIs');
  }
}
