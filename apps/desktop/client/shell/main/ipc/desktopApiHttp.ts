/**
 * Desktop API HTTP — extends the model gateway HTTP server with project/file/git
 * endpoints so the agent process can interact with the local workspace.
 *
 * All paths are validated through pathGuard.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import git from 'isomorphic-git';
import fs from 'node:fs';
import { assertSafePath, assertWithinProject } from './pathGuard';
import { getLogger } from '../logger';

const logger = getLogger();

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

type RouteHandler = (body: unknown, res: ServerResponse) => Promise<void>;

const routes: Record<string, RouteHandler> = {
  'POST /project/read-file': async (body, res) => {
    const { projectDir, relativePath } = body as { projectDir: string; relativePath: string };
    assertSafePath(projectDir);
    const fullPath = path.resolve(projectDir, relativePath);
    assertWithinProject(projectDir, fullPath);
    if (!existsSync(fullPath)) return json(res, 404, { error: 'File not found' });
    const content = readFileSync(fullPath, 'utf-8');
    json(res, 200, { content });
  },

  'POST /project/write-file': async (body, res) => {
    const { projectDir, relativePath, content } = body as { projectDir: string; relativePath: string; content: string };
    assertSafePath(projectDir);
    const fullPath = path.resolve(projectDir, relativePath);
    assertWithinProject(projectDir, fullPath);
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    json(res, 200, { ok: true });
  },

  'POST /project/list-dir': async (body, res) => {
    const { projectDir, relativePath = '' } = body as { projectDir: string; relativePath?: string };
    assertSafePath(projectDir);
    const fullPath = path.resolve(projectDir, relativePath);
    assertWithinProject(projectDir, fullPath);
    if (!existsSync(fullPath)) return json(res, 404, { error: 'Directory not found' });
    const entries = readdirSync(fullPath).map((name) => {
      const stat = statSync(path.join(fullPath, name));
      return { name, isDirectory: stat.isDirectory() };
    });
    json(res, 200, { entries });
  },

  'POST /git/status': async (body, res) => {
    const { projectDir } = body as { projectDir: string };
    assertSafePath(projectDir);
    const root = await git.findRoot({ fs, filepath: projectDir });
    const matrix = await git.statusMatrix({ fs, dir: root });
    const files = matrix
      .filter(([, head, workdir, stage]) => head !== 1 || workdir !== 1 || stage !== 1)
      .map(([filepath, head, workdir, stage]) => ({ filepath, head, workdir, stage }));
    json(res, 200, { files });
  },

  'POST /git/log': async (body, res) => {
    const { projectDir, depth = 20 } = body as { projectDir: string; depth?: number };
    assertSafePath(projectDir);
    const root = await git.findRoot({ fs, filepath: projectDir });
    const commits = await git.log({ fs, dir: root, depth });
    json(res, 200, {
      commits: commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message.trim(),
        author: c.commit.author.name,
        timestamp: c.commit.author.timestamp,
      })),
    });
  },

  'POST /git/commit': async (body, res) => {
    const { projectDir, message, author } = body as { projectDir: string; message: string; author?: { name: string; email: string } };
    assertSafePath(projectDir);
    const root = await git.findRoot({ fs, filepath: projectDir });
    // Stage all changes
    const matrix = await git.statusMatrix({ fs, dir: root });
    for (const [filepath, , workdir] of matrix) {
      if (workdir !== 1) {
        await git.add({ fs, dir: root, filepath });
      }
    }
    const oid = await git.commit({
      fs,
      dir: root,
      message,
      author: author ?? { name: 'Orison Agent', email: 'agent@orison.local' },
    });
    json(res, 200, { oid });
  },
};

/**
 * Try to handle a request as a desktop API route.
 * Returns true if handled, false if not matched (caller should try other routes).
 */
export async function handleDesktopApiRoute(
  method: string,
  url: string,
  body: unknown,
  res: ServerResponse,
): Promise<boolean> {
  const key = `${method} ${url}`;
  const handler = routes[key];
  if (!handler) return false;

  try {
    await handler(body, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, url }, 'desktop-api request failed');
    json(res, 500, { error: message });
  }
  return true;
}
