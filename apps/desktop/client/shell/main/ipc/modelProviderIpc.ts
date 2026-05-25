import { ipcMain } from 'electron';
import type { ListRemoteModelsRequest, RemoteModel } from '@orison/shared-contracts';
import { listModels } from '@orison/model-protocols';

export function registerModelProviderIpc() {
  ipcMain.handle(
    'model:list-remote-models',
    async (_event, request: ListRemoteModelsRequest): Promise<RemoteModel[]> => {
      return listModels({ baseUrl: request.baseUrl, apiKey: request.apiKey });
    },
  );
}
