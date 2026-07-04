import type { ModelProtocol } from '@orison/shared-contracts';

export type ProtocolCallContext = {
  signal?: AbortSignal;
};

export type ListModelsRequest = {
  protocol?: ModelProtocol;
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
};
