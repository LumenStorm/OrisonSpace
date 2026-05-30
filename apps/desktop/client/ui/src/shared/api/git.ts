import type { GitCommitEntry, GitFileDiff } from '@orison/shared-contracts';

const api = window.orisonDesktop;

export async function gitIsRepo(projectDir: string): Promise<boolean> {
  return !!(await api?.gitIsRepo(projectDir));
}

export async function gitLog(projectDir: string, limit = 50): Promise<GitCommitEntry[]> {
  return (await api?.gitLog(projectDir, limit)) ?? [];
}

export async function gitListBranches(projectDir: string): Promise<string[]> {
  return (await api?.gitListBranches(projectDir)) ?? [];
}

export async function gitCurrentBranch(projectDir: string): Promise<string> {
  return (await api?.gitCurrentBranch(projectDir)) ?? 'HEAD';
}

export async function gitCommitDiff(projectDir: string, oid: string): Promise<GitFileDiff[]> {
  return (await api?.gitCommitDiff(projectDir, oid)) ?? [];
}

export async function gitCreateNode(projectDir: string, message: string, tag?: string): Promise<void> {
  await api?.gitCreateNode(projectDir, message, tag);
}

export async function gitCheckoutBranch(projectDir: string, branch: string): Promise<void> {
  await api?.gitCheckoutBranch(projectDir, branch);
}

export async function gitCreateBranch(projectDir: string, name: string, startOid: string): Promise<void> {
  await api?.gitCreateBranch(projectDir, name, startOid);
}
