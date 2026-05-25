import { marked } from 'marked';
import TurndownService from 'turndown';

marked.setOptions({
  gfm: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndown.addRule('strikethrough', {
  filter: ['s', 'del'] as Array<keyof HTMLElementTagNameMap>,
  replacement: (content) => `~~${content}~~`,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return marked.parse(markdown, { async: false }) as string;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return turndown
    .turndown(html)
    .replace(/^([*+-]) {2,}/gm, '$1 ')
    .replace(/^(\d+\.) {2,}/gm, '$1 ')
    .trim();
}
