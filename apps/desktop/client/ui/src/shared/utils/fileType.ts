const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']);

export function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return name.slice(dotIndex + 1).toLowerCase();
}

export function isImageFileName(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

export function isDocxFileName(name: string): boolean {
  return getFileExtension(name) === 'docx';
}
