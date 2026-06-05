/**
 * Encoding detection for reading user text files (.md / .txt).
 *
 * Orison Space is a Chinese novel editor: imported .txt files are commonly
 * saved as GBK on Windows, not UTF-8. Reading those bytes blindly as UTF-8
 * produces mojibake. This module sniffs the encoding and decodes to a clean
 * UTF-8 JS string.
 *
 * No third-party dependency is needed: Node's built-in WHATWG `TextDecoder`
 * (backed by ICU) supports 'utf-8', 'utf-16le', 'utf-16be' and 'gbk' labels,
 * so detection is done purely with built-ins.
 *
 * Newlines are normalized to LF on read — the editor works in LF internally,
 * and writes are LF + UTF-8 — so a read/write round-trip is stable.
 */

/** Normalize CRLF and lone CR to LF (editor uses LF everywhere). */
function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Decode a raw file buffer into a UTF-8 JS string, detecting the source
 * encoding by BOM sniffing first, then by attempting a strict UTF-8 decode
 * and falling back to GBK.
 *
 * Detection order:
 *   1. UTF-8 BOM (EF BB BF)      → strip BOM, decode as UTF-8.
 *   2. UTF-16 LE BOM (FF FE)     → strip BOM, decode as UTF-16 LE.
 *   3. UTF-16 BE BOM (FE FF)     → strip BOM, decode as UTF-16 BE.
 *   4. No BOM, strict UTF-8 OK   → decode as UTF-8.
 *   5. No BOM, strict UTF-8 fails (illegal byte sequence) → decode as GBK.
 */
export function decodeFileToUtf8(buffer: Buffer): string {
  if (buffer.length === 0) return '';

  // 1. UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return normalizeNewlines(new TextDecoder('utf-8').decode(buffer.subarray(3)));
  }

  // 2. UTF-16 LE BOM
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return normalizeNewlines(new TextDecoder('utf-16le').decode(buffer.subarray(2)));
  }

  // 3. UTF-16 BE BOM
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return normalizeNewlines(new TextDecoder('utf-16be').decode(buffer.subarray(2)));
  }

  // 4. No BOM: try strict UTF-8. Pure ASCII and valid UTF-8 stay UTF-8.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return normalizeNewlines(text);
  } catch {
    // 5. Illegal UTF-8 byte sequence → almost certainly a legacy GBK file.
    return normalizeNewlines(new TextDecoder('gbk').decode(buffer));
  }
}
