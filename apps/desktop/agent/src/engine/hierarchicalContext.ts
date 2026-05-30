import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface HierarchicalContext {
  l0PreviousChapterText: string;
  l1RecentSummaries: string;
  l2BlockSummaries: string;
  l3GlobalNarrative: string;
  characterStates: Array<{ name: string; currentState: string; lastSeenChapter: string }>;
}

const BLOCK_SIZE = 5;
const SUMMARIES_DIR = 'runs/summaries';

export function buildHierarchicalContext(project: any, chapterId: string): HierarchicalContext {
  const projectPath = project._projectPath!;
  const chapters = [...(project.novel?.chapters ?? [])].sort(
    (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const chapterIdx = chapters.findIndex((ch: any) => ch.id === chapterId);

  const ctx: HierarchicalContext = {
    l0PreviousChapterText: '',
    l1RecentSummaries: '',
    l2BlockSummaries: '',
    l3GlobalNarrative: '',
    characterStates: [],
  };

  if (chapterIdx <= 0) return ctx;

  // L0: previous chapter full text
  const prev = chapters[chapterIdx - 1];
  if (prev.content_file) {
    const prevPath = path.join(projectPath, prev.content_file);
    if (existsSync(prevPath)) {
      ctx.l0PreviousChapterText = readFileSync(prevPath, 'utf8');
    }
  }

  // L1: recent 2-5 chapters summaries
  const l1Lines: string[] = [];
  for (let i = Math.max(0, chapterIdx - 5); i < chapterIdx - 1; i++) {
    const ch = chapters[i];
    if (ch.summary) {
      l1Lines.push(`[${ch.title}] ${ch.summary}`);
    }
  }
  ctx.l1RecentSummaries = l1Lines.join('\n\n');

  // L2: block summaries (every BLOCK_SIZE chapters)
  const l2Dir = path.join(projectPath, SUMMARIES_DIR);
  if (existsSync(l2Dir)) {
    const currentBlock = Math.floor(chapterIdx / BLOCK_SIZE);
    const l2Lines: string[] = [];
    for (let b = 0; b < currentBlock - 1; b++) {
      const blockFile = path.join(l2Dir, `l2_block_${b}.txt`);
      if (existsSync(blockFile)) {
        l2Lines.push(readFileSync(blockFile, 'utf8'));
      }
    }
    ctx.l2BlockSummaries = l2Lines.join('\n\n---\n\n');
  }

  // L3: global narrative
  const globalFile = path.join(projectPath, SUMMARIES_DIR, 'global_narrative.txt');
  if (existsSync(globalFile)) {
    ctx.l3GlobalNarrative = readFileSync(globalFile, 'utf8');
  }

  // Character states
  const statesFile = path.join(projectPath, SUMMARIES_DIR, 'character_states.json');
  if (existsSync(statesFile)) {
    try {
      ctx.characterStates = JSON.parse(readFileSync(statesFile, 'utf8'));
    } catch { /* ignore parse errors */ }
  }

  return ctx;
}

export function shouldTriggerCompression(chapterIdx: number): boolean {
  return chapterIdx > 0 && chapterIdx % BLOCK_SIZE === 0;
}

export function getBlockIndex(chapterIdx: number): number {
  return Math.floor(chapterIdx / BLOCK_SIZE) - 1;
}
