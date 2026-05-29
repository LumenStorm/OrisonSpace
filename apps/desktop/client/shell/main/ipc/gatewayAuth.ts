import { randomUUID } from 'node:crypto';

const PUBLIC_ENDPOINTS = new Set(['/health']);

const gatewayToken = process.env.ORISON_GATEWAY_TOKEN || randomUUID();

export function getGatewayToken(): string {
  return gatewayToken;
}

export function isGatewayRequestAuthorized(input: {
  expectedToken?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  if (PUBLIC_ENDPOINTS.has(input.url)) return true;
  const token = input.expectedToken ?? gatewayToken;
  const raw = input.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === `Bearer ${token}`;
}
