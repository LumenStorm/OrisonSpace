/** Slug + index + timestamp filename for a generated image. */
export function createImageName(prompt: string, index: number): string {
  const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9一-龥]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  return `${slug || 'image'}-${index + 1}-${Date.now()}`;
}

/** Convert raw base64 + mimeType to a `data:` URL when the server omitted it. */
export function toDataUrl(b64Json: string, mimeType: string): string {
  return `data:${mimeType};base64,${b64Json}`;
}

/**
 * Join a project root path with a project-relative path. Forward slashes from
 * the renderer are normalized to back-slashes on the way out so the result is
 * a Windows-style path that matches what the IPC layer returns.
 */
export function joinProjectPath(projectPath: string, relativePath: string): string {
  return `${projectPath.replace(/[\\/]+$/, '')}\\${relativePath.replace(/\//g, '\\')}`;
}

/** Strip directory prefix from a relative path → bare filename. */
export function fileNameOf(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}
