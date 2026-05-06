import { ipcMain } from 'electron';
import type { ProviderModel, ProviderModelListRequest } from '@orison/shared-contracts';
import { listModels } from '@orison/model-protocols';

/**
 * `model:list-provider-models` — desktop main process performs the model
 * listing HTTP request and returns a normalised `ProviderModel[]`. The body
 * is delegated to `@orison/model-protocols.listModels(provider, ...)` so that
 * the `provider` → listing-protocol mapping (OpenAI / Anthropic / Gemini /
 * NewAPI relay piggybacking on OpenAI) lives in one place.
 */
export function registerModelProviderIpc() {
  ipcMain.handle(
    'model:list-provider-models',
    async (_event, request: ProviderModelListRequest): Promise<ProviderModel[]> => {
      return listModels(request.provider, {
        baseUrl: request.baseUrl,
        apiKey: request.apiKey,
      });
    },
  );
}
