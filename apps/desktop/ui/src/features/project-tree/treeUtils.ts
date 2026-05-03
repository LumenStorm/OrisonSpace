import type { FileEntry } from './types';

export function getFileIcon(name: string, isDir: boolean, isOpen: boolean): string {
  if (isDir) return isOpen ? 'folder_open' : 'folder';
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'data_object';
  if (name.endsWith('.md')) return 'article';
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) return 'image';
  if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm')) return 'movie';
  return 'draft';
}

export function getDisplayName(name: string): string {
  return name.endsWith('/') ? name.slice(0, -1) : name;
}

export function buildInitialTree(projectName: string): FileEntry[] {
  return [
    {
      name: projectName,
      path: '/',
      isDir: true,
      children: [
        { name: 'project.yaml', path: '/project.yaml', isDir: false },
        {
          name: 'chapters',
          path: '/chapters',
          isDir: true,
          children: [
            { name: 'ch-001.md', path: '/chapters/ch-001.md', isDir: false },
            { name: 'ch-002.md', path: '/chapters/ch-002.md', isDir: false },
          ],
        },
        {
          name: 'scenes',
          path: '/scenes',
          isDir: true,
          children: [
            { name: 'sc-001.md', path: '/scenes/sc-001.md', isDir: false },
            { name: 'sc-002.md', path: '/scenes/sc-002.md', isDir: false },
          ],
        },
        {
          name: 'assets',
          path: '/assets',
          isDir: true,
          children: [],
        },
      ],
    },
  ];
}

export function findNode(tree: FileEntry[] | null, targetPath: string): FileEntry | null {
  if (!tree) return null;
  for (const node of tree) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

export function updateChildren(tree: FileEntry[], parentPath: string, children: FileEntry[]): FileEntry[] {
  return tree.map((node) => {
    if (node.path === parentPath && node.isDir) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateChildren(node.children, parentPath, children) };
    }
    return node;
  });
}

export function insertChild(tree: FileEntry[], parentPath: string, child: FileEntry): FileEntry[] {
  return tree.map((node) => {
    if (node.path === parentPath && node.isDir) {
      const children = [...(node.children ?? []), child];
      children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: insertChild(node.children, parentPath, child) };
    }
    return node;
  });
}

export function removeNode(tree: FileEntry[], targetPath: string): FileEntry[] {
  return tree
    .filter((n) => n.path !== targetPath)
    .map((n) => (n.children ? { ...n, children: removeNode(n.children, targetPath) } : n));
}

export function renameNode(tree: FileEntry[], targetPath: string, newName: string): FileEntry[] {
  return tree.map((node) => {
    if (node.path === targetPath) {
      const parentDir = targetPath.substring(0, targetPath.lastIndexOf('/')) || '/';
      const newPath = parentDir === '/' ? `/${newName}` : `${parentDir}/${newName}`;
      const updated: FileEntry = { ...node, name: newName, path: newPath };
      if (node.isDir && node.children) {
        updated.children = rebasePaths(node.children, node.path, newPath);
      }
      return updated;
    }
    if (node.children) {
      return { ...node, children: renameNode(node.children, targetPath, newName) };
    }
    return node;
  });
}

function rebasePaths(tree: FileEntry[], oldPrefix: string, newPrefix: string): FileEntry[] {
  return tree.map((node) => {
    const newPath = newPrefix + node.path.slice(oldPrefix.length);
    const updated: FileEntry = { ...node, path: newPath };
    if (node.children) {
      updated.children = rebasePaths(node.children, oldPrefix, newPrefix);
    }
    return updated;
  });
}
