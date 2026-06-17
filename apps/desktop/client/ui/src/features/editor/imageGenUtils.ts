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
 * 把项目根路径与项目内相对路径拼接成可供主进程 fs 读取的完整路径。
 * 统一使用正斜杠：Windows 的 fs/path API 同时接受正反斜杠，而 *nix 只接受
 * 正斜杠，因此正斜杠是跨平台唯一安全的公共分隔符，主进程 path.resolve 会再
 * 按各自平台归一化，无需在这里按平台分支。
 */
export function joinProjectPath(projectPath: string, relativePath: string): string {
  const root = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${root}/${rel}`;
}

/** Strip directory prefix from a relative path → bare filename. */
export function fileNameOf(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}
