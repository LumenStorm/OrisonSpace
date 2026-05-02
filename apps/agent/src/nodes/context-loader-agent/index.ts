import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';

/**
 * 上下文加载器节点：从本地项目文件中加载章节生成所需的全部上下文。
 *
 * 读取内容：
 * - project.yaml（小说元信息、章节列表、世界观、角色卡等）
 * - 目标章节 markdown（如果已有草稿）
 * - 前序章节摘要和结尾
 */
export function createContextLoaderNode(chapterId: string, projectPath: string): OrchestrationNode {
  return {
    id: 'context-loader-agent',
    async run(_input: NodeRunInput): Promise<NodeRunResult> {
      const projectFilePath = path.join(projectPath, 'project.yaml');

      if (!existsSync(projectFilePath)) {
        throw new Error(`Project not found at ${projectPath}: project.yaml 缺失`);
      }

      const raw = readFileSync(projectFilePath, 'utf8');
      const project = YAML.parse(raw) as Record<string, any>;

      const chapters = project.novel?.chapters as Array<Record<string, any>> | undefined;
      if (!chapters || !Array.isArray(chapters)) {
        throw new Error(`Project at ${projectPath} has no novel.chapters`);
      }

      const targetChapter = chapters.find((ch) => ch.id === chapterId);
      if (!targetChapter) {
        throw new Error(`Chapter ${chapterId} not found in project novel.chapters`);
      }

      // 加载章节草稿（如果存在）
      let draftText: string | null = null;
      if (targetChapter.content_file) {
        const mdPath = path.join(projectPath, targetChapter.content_file);
        if (existsSync(mdPath)) {
          draftText = readFileSync(mdPath, 'utf8');
        }
      }

      // 收集前序章节摘要
      const targetIndex = chapters.findIndex((ch) => ch.id === chapterId);
      const previousChapters = chapters.slice(0, targetIndex);
      const recentSummaries = previousChapters
        .filter((ch) => ch.summary)
        .map((ch) => ({
          id: ch.id,
          title: ch.title,
          summary: ch.summary,
        }));

      // 获取前一章内容结尾（bridge 用）
      let previousChapterTail: string | null = null;
      if (targetIndex > 0) {
        const prevChapter = chapters[targetIndex - 1];
        if (prevChapter.content_file) {
          const prevMdPath = path.join(projectPath, prevChapter.content_file);
          if (existsSync(prevMdPath)) {
            const prevContent = readFileSync(prevMdPath, 'utf8');
            // 取最后 500 字符作为结尾参考
            previousChapterTail = prevContent.slice(-500);
          }
        }
      }

      const context = {
        chapterId,
        chapterNumber: targetIndex + 1,
        targetChapterTitle: targetChapter.title ?? `第${targetIndex + 1}章`,
        novelTitle: project.outline?.title ?? project.meta?.name ?? '',
        draftText,
        recentSummaries,
        previousChapterTail,
        worldSetting: project.world_setting ?? null,
        assetCards: project.asset_cards ?? [],
        relationshipGraph: project.relationship_graph ?? null,
        foreshadowRegistry: project.foreshadow_registry ?? null,
        growthCurve: project.growth_curve ?? null,
        pacingCurve: project.pacing_curve ?? null,
        emotionCurve: project.emotion_curve ?? null,
        outline: project.outline_v2 ?? project.outline ?? null,
        episodeOutlines: project.episode_outlines ?? [],
        totalChapters: chapters.length,
        bridgeNotes: targetChapter.bridge_notes ?? null,
        lastRunId: targetChapter.last_run_id ?? null,
        status: targetChapter.status ?? 'draft',
      };

      return {
        stateKey: 'context.chapterContext',
        artifact: context,
      };
    },
  };
}
