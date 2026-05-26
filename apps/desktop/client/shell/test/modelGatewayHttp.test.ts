import { describe, expect, it } from 'vitest';
import { isGatewayRequestAuthorized } from '../main/ipc/gatewayAuth';

describe('model gateway HTTP authorization', () => {
  it('rejects tool and model requests without the configured gateway token', () => {
    expect(isGatewayRequestAuthorized({
      expectedToken: 'token-1',
      url: '/tool/execute',
      headers: {},
    })).toBe(false);
    expect(isGatewayRequestAuthorized({
      expectedToken: 'token-1',
      url: '/model/generate-text',
      headers: { authorization: 'Bearer wrong' },
    })).toBe(false);
  });

  it('accepts requests with the configured bearer token', () => {
    expect(isGatewayRequestAuthorized({
      expectedToken: 'token-1',
      url: '/tool/execute',
      headers: { authorization: 'Bearer token-1' },
    })).toBe(true);
  });

  it('keeps health checks public', () => {
    expect(isGatewayRequestAuthorized({
      expectedToken: 'token-1',
      url: '/health',
      headers: {},
    })).toBe(true);
  });
});
