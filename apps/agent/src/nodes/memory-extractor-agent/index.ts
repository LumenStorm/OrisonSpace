import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';

/**
 * Memory Extractor Agent (TS, 规则驱动)
 *
 * 输入：
 *  - context.chapterContext  (chapterId, chapterNumber, novelTitle, ...)
 *  - chapter.candidate       (content, summary, title)
 *
 * 输出：state_key = 'memory.extracted'
 *  {
 *    runId, chapterId,
 *    entries: StoryMemoryEntry[]
 *  }
 *
 * 设计要点：
 *  - 章节正文为空 -> 返回空 entries（不报错）
 *  - 至少产出一条 chapter-summary 类型的 memory 条目，便于后续长期记忆检索
 *  - 关键词触发额外的 character / foreshadow 类型条目
 *  - 不调用 LLM；Phase 6 升级时替换实现即可保持 contract 不变
 */
export function createMemoryExtractorNode(): OrchestrationNode {
  return {
    id: 'memory-extractor-agent',
    async run(input: NodeRunInput): Promise<NodeRunResult> {
      const ctx = input.run.artifacts?.['context.chapterContext'] as Record<string, any> | undefined;
      const candidate = input.run.artifacts?.['chapter.candidate'] as Record<string, any> | undefined;
      const runId = input.run.runId;

      const chapterId = (candidate?.chapterId as string) ?? (ctx?.chapterId as string) ?? '';
      const chapterNumber = (ctx?.chapterNumber as number) ?? 0;
      const novelId =
        (ctx?.novelId as string) ?? (ctx?.novelTitle as string) ?? (ctx?.projectId as string) ?? 'novel';

      const content = ((candidate?.content as string) ?? '').trim();
      if (!content) {
        return {
          stateKey: 'memory.extracted',
          artifact: { runId, chapterId, entries: [] },
        };
      }

      const summary = ((candidate?.summary as string) ?? '').trim();
      const title = ((candidate?.title as string) ?? `第${chapterNumber || '?'}章`).trim();
      const now = new Date().toISOString();
      const entries: Array<Record<string, unknown>> = [];

      // ── 1) 默认产出 chapter-summary 条目（保证至少 1 条）
      entries.push({
        id: `mem_${chapterId || 'auto'}_summary`,
        novelId,
        chapterId,
        chapterNumber,
        memoryType: 'chapter_summary',
        title: `${title} 摘要`,
        content: summary || content.slice(0, 200),
        importanceScore: 0.7,
        relatedCharacters: [],
        tags: ['summary', 'auto'],
        isForeshadow: false,
        sourceExcerpt: content.slice(0, 280),
        createdAt: now,
        updatedAt: now,
      });

      // ── 2) 角色提及（粗粒度：检索"探长/警官/警探/...先生/...小姐"等模式）
      const charMatches = new Set<string>();
      const charPatterns = [/(\p{Script=Han}{1,3}探长)/gu, /(\p{Script=Han}{1,3}警官)/gu, /(\p{Script=Han}{1,3}警探)/gu];
      for (const pat of charPatterns) {
        for (const m of content.matchAll(pat)) {
          charMatches.add(m[1]);
        }
      }
      if (charMatches.size > 0) {
        entries.push({
          id: `mem_${chapterId || 'auto'}_chars`,
          novelId,
          chapterId,
          chapterNumber,
          memoryType: 'character_mentions',
          title: `${title} 角色出场`,
          content: `本章出场角色：${[...charMatches].join('、')}`,
          importanceScore: 0.5,
          relatedCharacters: [...charMatches],
          tags: ['characters', 'auto'],
          isForeshadow: false,
          sourceExcerpt: content.slice(0, 200),
          createdAt: now,
          updatedAt: now,
        });
      }

      // ── 3) 悬念线索（与 story-sync 相同的关键词族；这里标记为 foreshadow=true）
      const cueKeywords: Array<{ rx: RegExp; label: string }> = [
        { rx: /铜?钥匙/u, label: '钥匙' },
        { rx: /信件|纸条|遗书/u, label: '信件' },
        { rx: /照片|相片|画像/u, label: '影像' },
        { rx: /匣子|盒子|木匣/u, label: '匣子' },
        { rx: /印记|刺青|纹身/u, label: '身体印记' },
      ];
      for (const cue of cueKeywords) {
        if (!cue.rx.test(content)) continue;
        entries.push({
          id: `mem_${chapterId || 'auto'}_fs_${cue.label}`,
          novelId,
          chapterId,
          chapterNumber,
          memoryType: 'foreshadow_seed',
          title: `线索：${cue.label}`,
          content: `第${chapterNumber || '?'}章出现的"${cue.label}"线索，可作为后续回收点。`,
          importanceScore: 0.65,
          relatedCharacters: [],
          tags: ['foreshadow', 'auto'],
          isForeshadow: true,
          sourceExcerpt: content.slice(0, 200),
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        stateKey: 'memory.extracted',
        artifact: { runId, chapterId, entries },
      };
    },
  };
}
