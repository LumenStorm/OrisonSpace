import { describe, expect, it } from 'vitest';
import { parseFlatYaml, stringifyFlatYaml } from '../src';

describe('parseFlatYaml scalar coercion', () => {
  it('coerces strict decimal literals to numbers', () => {
    const cfg = parseFlatYaml('temperature: 0.7\nmaxTokens: 4096\nnegative: -3');
    expect(cfg.temperature).toBe(0.7);
    expect(cfg.maxTokens).toBe(4096);
    expect(cfg.negative).toBe(-3);
  });

  it('keeps numeric-looking identifiers as strings (no precision loss / no normalization)', () => {
    const cfg = parseFlatYaml([
      'orgId: 1234567890123456789', // 19-digit ID would lose precision as a number
      'pin: 007',                    // leading zeros must survive
      'hex: 0x1f',                   // hex must not become 31
      'version: 1.0',                // must not normalize to 1
    ].join('\n'));
    expect(cfg.orgId).toBe('1234567890123456789');
    expect(cfg.pin).toBe('007');
    expect(cfg.hex).toBe('0x1f');
    expect(cfg.version).toBe('1.0');
  });

  it('parses booleans, null, and quoted strings', () => {
    const cfg = parseFlatYaml('a: true\nb: false\nc: null\nd:\ne: "quoted: value"');
    expect(cfg.a).toBe(true);
    expect(cfg.b).toBe(false);
    expect(cfg.c).toBeNull();
    expect(cfg.d).toBeNull();
    expect(cfg.e).toBe('quoted: value');
  });

  it('round-trips through stringifyFlatYaml without coercing keys', () => {
    const original = { apiKey: 'sk-007', model: 'gpt-4o', temperature: 0.5 };
    const reparsed = parseFlatYaml(stringifyFlatYaml(original));
    expect(reparsed.apiKey).toBe('sk-007');
    expect(reparsed.model).toBe('gpt-4o');
    expect(reparsed.temperature).toBe(0.5);
  });
});
