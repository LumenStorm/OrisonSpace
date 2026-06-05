import { describe, expect, it } from 'vitest';
import { decodeFileToUtf8 } from '../main/fs/decodeText';

describe('decodeFileToUtf8', () => {
  it('returns empty string for an empty buffer', () => {
    expect(decodeFileToUtf8(Buffer.alloc(0))).toBe('');
  });

  it('decodes plain UTF-8 (no BOM)', () => {
    const buffer = Buffer.from('第一章 你好世界', 'utf-8');
    expect(decodeFileToUtf8(buffer)).toBe('第一章 你好世界');
  });

  it('strips a UTF-8 BOM', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const buffer = Buffer.concat([bom, Buffer.from('正文', 'utf-8')]);
    expect(decodeFileToUtf8(buffer)).toBe('正文');
  });

  it('decodes UTF-16 LE with BOM', () => {
    const bom = Buffer.from([0xff, 0xfe]);
    const buffer = Buffer.concat([bom, Buffer.from('章节', 'utf-16le')]);
    expect(decodeFileToUtf8(buffer)).toBe('章节');
  });

  it('decodes UTF-16 BE with BOM', () => {
    const bom = Buffer.from([0xfe, 0xff]);
    const le = Buffer.from('章节', 'utf-16le');
    const be = Buffer.alloc(le.length);
    for (let i = 0; i < le.length; i += 2) {
      be[i] = le[i + 1];
      be[i + 1] = le[i];
    }
    const buffer = Buffer.concat([bom, be]);
    expect(decodeFileToUtf8(buffer)).toBe('章节');
  });

  it('falls back to GBK when bytes are not valid UTF-8', () => {
    // "中文" in GBK: D6 D0 CE C4 — an illegal UTF-8 sequence.
    const buffer = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);
    expect(decodeFileToUtf8(buffer)).toBe('中文');
  });

  it('normalizes CRLF and lone CR to LF', () => {
    const buffer = Buffer.from('a\r\nb\rc\nd', 'utf-8');
    expect(decodeFileToUtf8(buffer)).toBe('a\nb\nc\nd');
  });
});
