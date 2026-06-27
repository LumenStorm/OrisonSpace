/**
 * Human-facing presentation for agent tool calls. Maps the raw tool id (what the
 * runtime emits) to a Material Symbols icon + an i18n key, and derives a short
 * one-line summary of *what* the call did from the tool-result metadata so a
 * collapsed card is legible without expanding it.
 *
 * Pure presentation — no store access, no side effects. Unknown tool ids fall
 * back to the raw id + a generic icon, so a new backend tool never renders blank.
 */

export type ToolPresentation = { icon: string; i18nKey: string };

const TOOL_META: Record<string, ToolPresentation> = {
  read_file: { icon: 'description', i18nKey: 'agent.tool.read_file' },
  write_file: { icon: 'edit_document', i18nKey: 'agent.tool.write_file' },
  list_files: { icon: 'folder_open', i18nKey: 'agent.tool.list_files' },
  search: { icon: 'search', i18nKey: 'agent.tool.search' },
  chapter_list: { icon: 'menu_book', i18nKey: 'agent.tool.chapter_list' },
  chapter_read: { icon: 'auto_stories', i18nKey: 'agent.tool.chapter_read' },
  chapter_write: { icon: 'edit_note', i18nKey: 'agent.tool.chapter_write' },
  rewrite_passage: { icon: 'format_quote', i18nKey: 'agent.tool.rewrite_passage' },
  outline_read: { icon: 'account_tree', i18nKey: 'agent.tool.outline_read' },
  outline_update: { icon: 'account_tree', i18nKey: 'agent.tool.outline_update' },
  overview_update: { icon: 'dashboard', i18nKey: 'agent.tool.overview_update' },
  memory_query: { icon: 'psychology', i18nKey: 'agent.tool.memory_query' },
  memory_update: { icon: 'psychology', i18nKey: 'agent.tool.memory_update' },
  generate_image: { icon: 'image', i18nKey: 'agent.tool.generate_image' },
  edit_image: { icon: 'auto_fix_high', i18nKey: 'agent.tool.edit_image' },
  project_meta: { icon: 'info', i18nKey: 'agent.tool.project_meta' },
  git_status: { icon: 'commit', i18nKey: 'agent.tool.git_status' },
  git_commit: { icon: 'commit', i18nKey: 'agent.tool.git_commit' },
  git_log: { icon: 'history', i18nKey: 'agent.tool.git_log' },
  git_diff: { icon: 'difference', i18nKey: 'agent.tool.git_diff' },
  skill: { icon: 'extension', i18nKey: 'agent.tool.skill' },
  spawn_agent: { icon: 'smart_toy', i18nKey: 'agent.tool.spawn_agent' },
};

const FALLBACK: ToolPresentation = { icon: 'build', i18nKey: '' };

/** Resolve the icon + i18n key for a tool id (falls back gracefully). */
export function toolPresentation(toolId: string): ToolPresentation {
  return TOOL_META[toolId] ?? FALLBACK;
}

/** Friendly tool name: translated label, or the raw id when unmapped. */
export function toolLabel(toolId: string, t: (key: string) => string): string {
  const meta = TOOL_META[toolId];
  if (!meta) return toolId;
  const label = t(meta.i18nKey);
  // `t` returns the key itself when a translation is missing; guard against that.
  return label === meta.i18nKey ? toolId : label;
}

type ToolResultMeta = {
  fileName?: string;
  filePath?: string;
  chapterId?: string;
  field?: string;
  query?: string;
  paths?: string[];
  count?: number;
} & Record<string, unknown>;

/**
 * A short, human-readable summary of the argument/target of a tool call, drawn
 * from the result metadata the runtime emits. Prefers a concrete target
 * (filename / chapter / field / query) when present, else falls back to a count
 * ("12") which most read/search/list tools provide. Returns undefined when no
 * meaningful detail is available (the card then shows just the tool name).
 */
export function toolSummary(result: { toolId?: string; toolName?: string; metadata?: unknown }): string | undefined {
  const meta = (result.metadata && typeof result.metadata === 'object' ? result.metadata : {}) as ToolResultMeta;
  const basename = (p?: string) => (p ? p.split(/[\\/]/).pop() : undefined);

  const target =
    basename(meta.fileName) ??
    basename(meta.filePath) ??
    meta.chapterId ??
    meta.field ??
    (typeof meta.query === 'string' ? `"${meta.query}"` : undefined);

  if (target) return target;
  if (Array.isArray(meta.paths) && meta.paths.length > 0) return basename(meta.paths[0]);
  if (typeof meta.count === 'number') return String(meta.count);
  return undefined;
}

/**
 * Parse a child-execution tag the runtime prepends to nested assistant/tool
 * content, e.g. `[skill:story:d2] ...` or `[subagent:writer] ...`. Returns the
 * stripped content plus the badge parts so the UI can render an indented,
 * labelled child step instead of leaking the raw tag into prose. Returns null
 * when the content carries no such tag.
 */
export function parseChildTag(content: string): {
  source: 'skill' | 'subagent';
  role: string;
  depth: number;
  rest: string;
} | null {
  const m = /^\[(skill|subagent):([^\]:]+)(?::d(\d+))?\]\s*/.exec(content);
  if (!m) return null;
  return {
    source: m[1] as 'skill' | 'subagent',
    role: m[2],
    depth: m[3] ? Number(m[3]) : 1,
    rest: content.slice(m[0].length),
  };
}
