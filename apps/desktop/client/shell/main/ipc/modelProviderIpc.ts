import { ipcMain } from 'electron';
import type { ListRemoteModelsRequest, ModelProtocol, RemoteModel } from '@orison/shared-contracts';
import { listModels } from '@orison/model-protocols';
import { readModelConfigFromDisk } from './configIpc';

function resolveListModelsRequest(request: ListRemoteModelsRequest): { protocol: ModelProtocol; baseUrl: string; apiKey: string } {
  if (request.keyId) {
    const config = readModelConfigFromDisk();
    const key = config.keys.find((entry) => entry.id === request.keyId);
    if (!key) throw new Error(`Model key '${request.keyId}' not found`);
    return { protocol: key.protocol, baseUrl: key.baseUrl, apiKey: key.apiKey };
  }
  if (!request.baseUrl || !request.apiKey) {
    throw new Error('baseUrl and apiKey are required when keyId is not provided');
  }
  return { protocol: request.protocol ?? 'openai-compatible', baseUrl: request.baseUrl, apiKey: request.apiKey };
}

export function registerModelProviderIpc() {
  ipcMain.handle(
    'model:list-remote-models',
    async (_event, request: ListRemoteModelsRequest): Promise<RemoteModel[]> => {
      return listModels(resolveListModelsRequest(request));
    },
  );
}
