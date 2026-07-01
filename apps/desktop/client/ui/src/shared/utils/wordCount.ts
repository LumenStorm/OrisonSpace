/**
 * 统一字数统计工具。
 *
 * Orison Space 以中文小说为主，单纯按空白切词（content.split(/\s+/)）会把
 * 整段无空格的中文算成 1 个词，严重失真。这里提供与 shell 端
 * `project:word-count`（text.replace(/\s/g,'').length）对齐的"字数"口径，
 * 让单文件与项目总览口径一致；同时提供 CJK 友好的词数，供需要"词"的场景使用。
 *
 * 输入约定为纯文本。若来源是 HTML/markdown，请先用 `stripMarkup` 剥标签，
 * 或直接使用 `countMarkup`。
 */

/** CJK 统一表意文字及常用扩展、假名、谚文等逐字计的字符范围。 */
const CJK_PATTERN =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ가-힯]/g;

/** 连续西文"词"：字母/数字串，允许内部连接符（如 don't、state-of-the-art）。 */
const WESTERN_WORD_PATTERN = /[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9À-ɏ]+)*/g;

export interface TextStats {
  /** 去掉所有空白后的字符数。"字数"主口径，与项目总字数对齐。 */
  chars: number;
  /** 含空白在内的原始字符总数。 */
  totalChars: number;
  /** CJK 字符数（逐字计）。 */
  cjkChars: number;
  /** CJK 友好的词数：CJK 字符逐字计 + 连续西文按词计。 */
  words: number;
  /** 行数（按 \n 切分）。 */
  lines: number;
  /** 段落数（按空行切分，忽略空段）。 */
  paragraphs: number;
}

const EMPTY_STATS: TextStats = {
  chars: 0,
  totalChars: 0,
  cjkChars: 0,
  words: 0,
  lines: 0,
  paragraphs: 0,
};

/**
 * 从 HTML/markdown 文本里剥掉标签，转成可统计的纯文本。
 * 标签替换为空格，避免相邻文本被粘连成一个词。
 */
function stripMarkup(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ');
}

/**
 * 统计纯文本的各项指标。输入应为纯文本（非 HTML）。
 */
function countText(text: string): TextStats {
  if (!text) return { ...EMPTY_STATS };

  const totalChars = text.length;
  const chars = text.replace(/\s/g, '').length;

  if (chars === 0) {
    return { ...EMPTY_STATS, totalChars, lines: text.split('\n').length };
  }

  const cjkChars = (text.match(CJK_PATTERN) ?? []).length;
  const westernWords = (text.match(WESTERN_WORD_PATTERN) ?? []).length;
  const words = cjkChars + westernWords;

  const lines = text.split('\n').length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;

  return { chars, totalChars, cjkChars, words, lines, paragraphs };
}

/**
 * 先剥标签再统计，用于来源是 HTML/markdown 文本的场景。
 */
export function countMarkup(html: string): TextStats {
  return countText(stripMarkup(html));
}
