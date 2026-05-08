export type ProtocolCallContext = {
  signal?: AbortSignal;
};

export type ListModelsRequest = {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
};
