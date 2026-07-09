export type ChapterManuscript = {
  title: string;
  body: string;
};

const FRONTMATTER_RE = /^---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const LEADING_HEADING_RE = /^#\s+(.+?)\s*#*\s*(?:\r?\n|$)/;

export function exportFilename(projectName: string | undefined, ext: string): string {
  const base = (projectName ?? 'export').replace(/[\\/:*?"<>|]/g, '_').trim() || 'export';
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${ext}`;
}

function normalizeChapterTitle(title: string, index: number): string {
  const clean = title.replace(/^#+\s*/, '').trim() || `第${index + 1}章`;
  return /^第.+章/.test(clean) ? clean : `第${index + 1}章 ${clean}`;
}

function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_RE, '');
}

function stripLeadingHeading(text: string, title: string): string {
  const body = stripFrontmatter(text).replace(/^\uFEFF/, '');
  const match = body.match(LEADING_HEADING_RE);
  if (!match) return body;
  const heading = match[1].trim();
  if (heading === title || title.includes(heading) || heading.includes(title)) {
    return body.slice(match[0].length);
  }
  return body;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function htmlToPlain(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(?:p|div|section|article|h[1-6]|blockquote|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
}

function stripMarkdownToText(markdown: string): string {
  return htmlToPlain(markdown)
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildMarkdownManuscript(chapters: ChapterManuscript[]): string {
  return chapters.map((chapter) => {
    const body = stripLeadingHeading(chapter.body, chapter.title).trim();
    return body ? `# ${chapter.title}\n\n${body}` : `# ${chapter.title}`;
  }).join('\n\n---\n\n');
}

export function buildPlainTextManuscript(chapters: ChapterManuscript[]): string {
  return chapters.map((chapter, index) => {
    const title = normalizeChapterTitle(chapter.title, index);
    const body = stripMarkdownToText(stripLeadingHeading(chapter.body, chapter.title));
    return body ? `${title}\n\n${body}` : title;
  }).join('\n\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphXml(text: string): string {
  if (!text) return '<w:p/>';
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function buildDocumentXml(chapters: ChapterManuscript[]): string {
  const lines = buildPlainTextManuscript(chapters).split('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    ...lines.map(paragraphXml),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
    '</w:body>',
    '</w:document>',
  ].join('');
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function pushBytes(out: number[], bytes: Uint8Array): void {
  for (const byte of bytes) out.push(byte);
}

function toArrayBufferView(bytes: number[]): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return view;
}

function createZip(files: Array<{ name: string; content: string }>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  const records: Array<{ nameBytes: Uint8Array; data: Uint8Array; crc: number; offset: number }> = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const offset = local.length;
    records.push({ nameBytes, data, crc, offset });

    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 0x0800);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint32(local, crc);
    writeUint32(local, data.length);
    writeUint32(local, data.length);
    writeUint16(local, nameBytes.length);
    writeUint16(local, 0);
    pushBytes(local, nameBytes);
    pushBytes(local, data);
  }

  for (const record of records) {
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0x0800);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, record.crc);
    writeUint32(central, record.data.length);
    writeUint32(central, record.data.length);
    writeUint16(central, record.nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, record.offset);
    pushBytes(central, record.nameBytes);
  }

  const centralOffset = local.length;
  const out = [...local, ...central];
  writeUint32(out, 0x06054b50);
  writeUint16(out, 0);
  writeUint16(out, 0);
  writeUint16(out, records.length);
  writeUint16(out, records.length);
  writeUint32(out, central.length);
  writeUint32(out, centralOffset);
  writeUint16(out, 0);
  return toArrayBufferView(out);
}

export function buildDocxPackage(chapters: ChapterManuscript[]): Uint8Array<ArrayBuffer> {
  return createZip([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: 'word/document.xml',
      content: buildDocumentXml(chapters),
    },
  ]);
}
