/**
 * HTTP Model Gateway — exposes the same model generation capabilities as the
 * IPC layer, but over a local HTTP server so the agent process can call it.
 *
 * Listens on port 18421 (configurable via ORISON_GATEWAY_PORT env var).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleGenerateText, handleGenerateImage, handleGenerateVideo } from './modelGatewayIpc';
import { handleDesktopApiRoute } from './desktopApiHttp';
import { handleToolExecute, listRegisteredTools } from './toolExecution';
import { getLogger } from '../logger';
import { isGatewayRequestAuthorized, getGatewayToken } from './gatewayAuth';

const PORT = Number(process.env.ORISON_GATEWAY_PORT) || 18421;
const logger = getLogger();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' });
    return res.end();
  }

  const url = req.url ?? '';
  if (!isGatewayRequestAuthorized({
    url,
    headers: req.headers,
  })) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, { status: 'ok' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(await readBody(req));

    // Try desktop API routes first (project/git endpoints)
    const handled = await handleDesktopApiRoute(req.method!, url, body, res);
    if (handled) return;

    // Unified tool execution endpoint
    if (url === '/tool/execute') {
      const result = await handleToolExecute(body as any);
      return json(res, 200, result);
    }

    if (url === '/tool/list') {
      return json(res, 200, { tools: listRegisteredTools() });
    }

    if (url === '/model/generate-text' || url === '/chat/completions') {
      const result = await handleGenerateText(body);
      return json(res, 200, result);
    }

    if (url === '/model/generate-image' || url === '/images/generations') {
      const result = await handleGenerateImage(body);
      return json(res, 200, result);
    }

    if (url === '/images/edits') {
      const result = await handleGenerateImage(body);
      return json(res, 200, result);
    }

    if (url === '/model/generate-video') {
      const result = await handleGenerateVideo(body);
      return json(res, 200, result);
    }

    json(res, 404, { error: `Unknown endpoint: ${url}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const cause = err instanceof Error && (err as any).cause ? String((err as any).cause) : undefined;
    logger.error({ err: message, stack, cause, url }, 'gateway request failed');
    json(res, 500, { error: message });
  }
}

export function startModelGatewayHttp() {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error({ err }, 'unhandled gateway error');
      if (!res.headersSent) json(res, 500, { error: 'Internal error' });
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    logger.info({ port: PORT }, 'Model gateway HTTP server started');
  });

  return server;
}
