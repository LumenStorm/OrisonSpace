import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineTool } from './define';

const exec = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout, stderr } = await exec('git', args, { cwd, timeout: 15_000 });
  return (stdout + stderr).trim();
}

export const gitStatusTool = defineTool({
  id: 'git_status',
  description: 'Show git status of the project (modified, untracked, staged files).',
  parameters: z.object({}),
  async execute(_params, ctx) {
    const output = await git(['status', '--short'], ctx.projectPath);
    return {
      title: 'git_status',
      output: output || 'Working tree clean.',
    };
  },
});

export const gitCommitTool = defineTool({
  id: 'git_commit',
  description: 'Stage all changes and create a git commit with the given message.',
  parameters: z.object({
    message: z.string().describe('Commit message'),
    paths: z.array(z.string()).optional().describe('Specific files to stage (default: all)'),
  }),
  async execute(params, ctx) {
    const pathsToAdd = params.paths ?? ['.'];
    await git(['add', ...pathsToAdd], ctx.projectPath);
    const output = await git(['commit', '-m', params.message], ctx.projectPath);
    return {
      title: `git_commit: ${params.message.slice(0, 50)}`,
      output,
    };
  },
});

export const gitLogTool = defineTool({
  id: 'git_log',
  description: 'Show recent git commit history.',
  parameters: z.object({
    count: z.number().int().positive().optional().describe('Number of commits to show (default 10)'),
  }),
  async execute(params, ctx) {
    const n = params.count ?? 10;
    const output = await git(['log', `--oneline`, `-${n}`], ctx.projectPath);
    return { title: 'git_log', output: output || 'No commits yet.' };
  },
});

export const gitDiffTool = defineTool({
  id: 'git_diff',
  description: 'Show the diff of current changes (unstaged by default).',
  parameters: z.object({
    staged: z.boolean().optional().describe('Show staged changes instead'),
    file: z.string().optional().describe('Specific file to diff'),
  }),
  async execute(params, ctx) {
    const args = ['diff'];
    if (params.staged) args.push('--cached');
    if (params.file) args.push(params.file);
    const output = await git(args, ctx.projectPath);
    return { title: 'git_diff', output: output || 'No changes.' };
  },
});
