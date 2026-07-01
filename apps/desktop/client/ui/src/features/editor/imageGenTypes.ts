export type GeneratedImageItem = {
  id: string;
  prompt: string;
  b64Json: string;
  mimeType: string;
  dataUrl: string;
  tempRelativePath: string;
  tempFullPath: string;
  savedRelativePath?: string;
  assetAdded: boolean;
  source: 'generated' | 'loaded' | 'edited';
  loading?: boolean;
};
