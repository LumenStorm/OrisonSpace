const PUBLIC_ENDPOINTS = new Set(['/health']);

export function isGatewayRequestAuthorized(input: {
  expectedToken?: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  if (PUBLIC_ENDPOINTS.has(input.url)) return true;
  if (!input.expectedToken) return false;
  const raw = input.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === `Bearer ${input.expectedToken}`;
}
