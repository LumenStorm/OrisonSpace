import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NovelWorkbench } from '../src/features/novel-workbench/NovelWorkbench';
import { MemoryPanel } from '../src/features/memory/MemoryPanel';
import { useAppStore } from '../src/shared/store/appStore';

const SAMPLE_CHAPTERS = [
  { id: 'ch_001', title: '第1章 起手式', sortOrder: 0, status: 'final' as const, summary: '故事开篇' },
  { id: 'ch_002', title: '第2章 暗夜降临', sortOrder: 1, status: 'draft' as const, summary: '夜色中的怪事' },
  { id: 'ch_003', title: '第3章 ', sortOrder: 2, status: 'generating' as const, summary: '' },
];

const SAMPLE_CANDIDATE = {
  chapterId: 'ch_002',
  runId: 'run_novel_xyz',
  title: '第2章 暗夜降临',
  content: '李探长走进雾里，看见铜钥匙静静躺在地上。',
  summary: '李探长发现铜钥匙',
  wordCount: 24,
};

const SAMPLE_MEMORY_ENTRIES = [
  {
    id: 'mem_ch_002_summary',
    novelId: '暗城',
    chapterId: 'ch_002',
    chapterNumber: 2,
    memoryType: 'chapter_summary',
    title: '第2章 暗夜降临 摘要',
    content: '李探长发现铜钥匙',
    importanceScore: 0.7,
    relatedCharacters: [],
    tags: ['summary'],
    isForeshadow: false,
  },
  {
    id: 'mem_ch_002_fs_钥匙',
    novelId: '暗城',
    chapterId: 'ch_002',
    chapterNumber: 2,
    memoryType: 'foreshadow_seed',
    title: '线索：钥匙',
    content: '第2章出现的钥匙线索，可作为后续回收点。',
    importanceScore: 0.65,
    relatedCharacters: [],
    tags: ['foreshadow'],
    isForeshadow: true,
  },
];

const generateBtnRegex = /^(生成本章|Generate Chapter|novelChapter\.actionLabel\.generate)$/;
const continueBtnRegex = /^(续写|Continue|novelChapter\.actionLabel\.continue)$/;
const polishBtnRegex = /^(润色|Polish|novelChapter\.actionLabel\.polish)$/;
const acceptBtnRegex = /^(接受候选|Accept Candidate|novelChapter\.acceptCandidate)$/;
const rejectBtnRegex = /^(丢弃候选|Discard Candidate|novelChapter\.rejectCandidate)$/;

describe('NovelWorkbench', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // Setting currentProject triggers the project subscription, which clears
    // novelChapters/creativeFields. So set the project FIRST, then seed the
    // chapter fixture in a second setState the subscription won't react to.
    useAppStore.setState({
      currentProject: {
        projectId: 'p_001',
        name: '暗城',
        path: 'C:/projects/暗城',
        type: 'novel',
      },
    } as any);
    useAppStore.setState({
      novelChapters: SAMPLE_CHAPTERS,
      activeChapterId: null,
      chapterCandidate: null,
      chapterCandidateStatus: 'idle',
      memoryEntries: [],
      selectChapter: vi.fn((id: string) => {
        useAppStore.setState({ activeChapterId: id });
      }),
      startChapterRun: vi.fn().mockResolvedValue(undefined),
      acceptChapterCandidate: vi.fn().mockResolvedValue(undefined),
      rejectChapterCandidate: vi.fn(() => {
        useAppStore.setState({ chapterCandidate: null, chapterCandidateStatus: 'idle' });
      }),
    } as any);
  });

  it('章节列表渲染所有章节', () => {
    render(<NovelWorkbench />);
    const list = screen.getByRole('list', { name: 'Chapter List' });
    expect(within(list).getByText(/起手式/)).toBeTruthy();
    expect(within(list).getByText(/暗夜降临/)).toBeTruthy();
    expect(within(list).getByText(/第3章/)).toBeTruthy();
  });

  it('点击章节会调用 selectChapter', async () => {
    render(<NovelWorkbench />);
    const list = screen.getByRole('list', { name: 'Chapter List' });
    const target = within(list).getByText(/暗夜降临/);
    await userEvent.click(target);
    expect(useAppStore.getState().selectChapter).toHaveBeenCalledWith('ch_002');
  });

  it('选中章节后显示功能重建提示', () => {
    useAppStore.setState({ activeChapterId: 'ch_002' } as any);
    render(<NovelWorkbench />);
    expect(screen.getByText(/(章节生成功能重建中|Chapter generation is being rebuilt|novelChapter\.actionsUnavailable)/)).toBeTruthy();
  });

  it('功能重建提示替代了原有生成按钮', () => {
    useAppStore.setState({ activeChapterId: 'ch_002' } as any);
    render(<NovelWorkbench />);
    expect(screen.queryByRole('button', { name: generateBtnRegex })).toBeNull();
  });

  it('model selector is not rendered while chapter actions are disabled', () => {
    useAppStore.setState({
      activeChapterId: 'ch_002',
      selectedNovelRef: null,
      modelConfig: {
        keys: [
          {
            id: 'key_001',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'sk-test',
            models: [{ id: 'gpt-5.4', alias: 'GPT-5.4', capability: 'text', enabled: true }],
          },
        ],
      },
    } as any);
    render(<NovelWorkbench />);
    expect(screen.queryByRole('combobox', { name: /(写作模型|Writing model|novelChapter\.model)/ })).toBeNull();
  });

  it('candidate 出现时显示 accept / reject 按钮和正文', () => {
    useAppStore.setState({
      activeChapterId: 'ch_002',
      chapterCandidate: SAMPLE_CANDIDATE,
      chapterCandidateStatus: 'pending',
    } as any);
    render(<NovelWorkbench />);

    const result = screen.getByRole('region', { name: 'Chapter Result' });
    expect(within(result).getByText(SAMPLE_CANDIDATE.content)).toBeTruthy();
    expect(within(result).getByRole('button', { name: acceptBtnRegex })).toBeTruthy();
    expect(within(result).getByRole('button', { name: rejectBtnRegex })).toBeTruthy();
  });

  it('点击接受候选触发 acceptChapterCandidate', async () => {
    useAppStore.setState({
      activeChapterId: 'ch_002',
      chapterCandidate: SAMPLE_CANDIDATE,
      chapterCandidateStatus: 'pending',
    } as any);
    render(<NovelWorkbench />);
    const result = screen.getByRole('region', { name: 'Chapter Result' });
    await userEvent.click(within(result).getByRole('button', { name: acceptBtnRegex }));
    expect(useAppStore.getState().acceptChapterCandidate).toHaveBeenCalled();
  });

  it('生成中状态显示进度提示', () => {
    useAppStore.setState({
      activeChapterId: 'ch_002',
      chapterCandidate: null,
      chapterCandidateStatus: 'running',
    } as any);
    render(<NovelWorkbench />);
    const result = screen.getByRole('region', { name: 'Chapter Result' });
    expect(within(result).getByText(/(生成中，请稍候|Generating, please wait|novelChapter\.generating)/)).toBeTruthy();
  });
});

describe('MemoryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppStore.setState({
      currentProject: {
        projectId: 'p_001',
        name: '暗城',
        path: 'C:/projects/暗城',
        type: 'novel',
      },
      memoryEntries: [],
    } as any);
  });

  it('空记忆显示占位文案', () => {
    render(<MemoryPanel />);
    expect(screen.getByText(/(暂无记忆|No memory entries|memory\.empty)/)).toBeTruthy();
  });

  it('渲染所有记忆条目，按章节号分组', () => {
    useAppStore.setState({ memoryEntries: SAMPLE_MEMORY_ENTRIES } as any);
    render(<MemoryPanel />);
    expect(screen.getByText(/暗夜降临 摘要/)).toBeTruthy();
    expect(screen.getByText(/线索：钥匙/)).toBeTruthy();
    // 章节号显示 (Tolerate "第2章" / "Chapter 2" / "memory.chapterHeader")
    expect(screen.getAllByText(/(第2章|Chapter 2|memory\.chapterHeader)/).length).toBeGreaterThanOrEqual(1);
  });

  it('foreshadow 类型条目带特殊标记', () => {
    useAppStore.setState({ memoryEntries: SAMPLE_MEMORY_ENTRIES } as any);
    render(<MemoryPanel />);
    const fsEntry = screen.getByText(/线索：钥匙/).closest('article');
    expect(fsEntry).toBeTruthy();
    expect(fsEntry?.getAttribute('data-foreshadow')).toBe('true');
  });
});
