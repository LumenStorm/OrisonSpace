import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/shared/store/appStore';

describe('agent passage diff acceptance', () => {
  beforeEach(() => {
    (window as any).orisonDesktop = {
      writeFile: vi.fn().mockResolvedValue(true),
    };
    useAppStore.setState({
      currentProject: { projectId: 'p1', name: 'P1', path: 'I:/proj', type: 'novel' },
      openFiles: [],
      pendingDiffs: [],
      pendingPassageResolve: null,
      novelChapters: [],
    } as any);
  });

  it('accepts a passage rewrite by recovered selection anchor when model original text drifted', () => {
    const filePath = 'I:/proj/chapters/ch01.md';
    const current = 'Alpha\nBeta exact line\nOmega';
    const from = current.indexOf('Beta exact line');
    const to = from + 'Beta exact line'.length;

    useAppStore.setState({
      openFiles: [{
        id: 'tab-1',
        path: filePath,
        name: 'ch01.md',
        content: current,
        savedContent: current,
        kind: 'text',
      }],
      agentMessages: [{
        id: 'msg-1',
        role: 'user',
        content: '改写选段',
        createdAt: 1,
        references: [{
          type: 'selection',
          id: 'sel-1',
          label: 'selection',
          text: 'Beta exact line',
          sourceType: 'file',
          filePath,
          anchor: {
            quote: 'Beta exact line',
            prefix: 'Alpha\n',
            suffix: '\nOmega',
            rangeHint: { from, to },
          },
        }],
      }],
      pendingDiffs: [{
        kind: 'passage',
        id: 'diff-1',
        toolId: 'rewrite_passage',
        sourceType: 'file',
        filePath,
        originalText: 'Beta exact line ',
        replacement: 'Beta rewritten',
      }],
    } as any);

    useAppStore.getState().acceptDiff('diff-1');

    expect(useAppStore.getState().pendingPassageResolve).toBeNull();
    expect(useAppStore.getState().pendingDiffs).toEqual([]);
    expect(useAppStore.getState().openFiles[0].content).toBe('Alpha\nBeta rewritten\nOmega');
  });

  it('accepts a passage rewrite when only line endings differ', () => {
    const filePath = 'I:/proj/chapters/ch01.md';
    const current = 'Alpha\r\nBeta exact line\r\nOmega';

    useAppStore.setState({
      openFiles: [{
        id: 'tab-1',
        path: filePath,
        name: 'ch01.md',
        content: current,
        savedContent: current,
        kind: 'text',
      }],
      pendingDiffs: [{
        kind: 'passage',
        id: 'diff-1',
        toolId: 'rewrite_passage',
        sourceType: 'file',
        filePath,
        originalText: 'Alpha\nBeta exact line',
        replacement: 'Alpha\nBeta rewritten',
      }],
    } as any);

    useAppStore.getState().acceptDiff('diff-1');

    expect(useAppStore.getState().pendingPassageResolve).toBeNull();
    expect(useAppStore.getState().pendingDiffs).toEqual([]);
    expect(useAppStore.getState().openFiles[0].content).toBe('Alpha\nBeta rewritten\r\nOmega');
  });

  it('accepts a file passage when tool metadata uses a project-relative path', () => {
    const absPath = 'I:/proj/chapters/ch01.md';
    const current = 'Hello world\nSecond line';

    useAppStore.setState({
      openFiles: [{
        id: 'tab-1',
        path: absPath,
        name: 'ch01.md',
        content: current,
        savedContent: current,
        kind: 'text',
      }],
      pendingDiffs: [{
        kind: 'passage',
        id: 'diff-rel',
        toolId: 'rewrite_passage',
        sourceType: 'file',
        filePath: 'chapters/ch01.md',
        originalText: 'Hello world',
        replacement: 'Hi world',
      }],
    } as any);

    useAppStore.getState().acceptDiff('diff-rel');

    expect(useAppStore.getState().pendingPassageResolve).toBeNull();
    expect(useAppStore.getState().pendingDiffs).toEqual([]);
    expect(useAppStore.getState().openFiles[0].content).toBe('Hi world\nSecond line');
  });

  it('accepts a multi-paragraph passage when quote uses single newlines but source has blank lines', () => {
    const filePath = 'I:/proj/chapters/ch01.md';
    const current = 'Para one.\n\nPara two.\n\nPara three.';
    // TipTap historically produced single-\n between blocks; markdown stores \n\n.
    const quote = 'Para one.\nPara two.';

    useAppStore.setState({
      openFiles: [{
        id: 'tab-1',
        path: filePath,
        name: 'ch01.md',
        content: current,
        savedContent: current,
        kind: 'text',
      }],
      pendingDiffs: [{
        kind: 'passage',
        id: 'diff-para',
        toolId: 'rewrite_passage',
        sourceType: 'file',
        filePath,
        originalText: quote,
        replacement: 'Para one rewritten.\n\nPara two rewritten.',
      }],
    } as any);

    useAppStore.getState().acceptDiff('diff-para');

    expect(useAppStore.getState().pendingPassageResolve).toBeNull();
    expect(useAppStore.getState().pendingDiffs).toEqual([]);
    expect(useAppStore.getState().openFiles[0].content).toBe(
      'Para one rewritten.\n\nPara two rewritten.\n\nPara three.',
    );
  });

  it('accepts a chapter-length passage rewrite when model original text drifted', () => {
    const filePath = 'I:/proj/chapters/ch01.md';
    const current = [
      '# 第一章 夜空中的信号',
      '林心觉得自己的运气真是绝了。',
      '上一秒他还在实验室里调试接收器，下一秒爆炸吞没了一切。',
      '醒来第一件事，是摸到了两团不该存在的东西。',
      '他沉默了很久。',
      '然后发出一声惨叫。',
      '凌晨三点四十七分，凤凰山天文台的观测室里，一切都变了。',
      '他很快冷静下来，把原主的记忆翻了个底朝天。',
      '窗外，深蓝色的天穹缀满星光。',
      '凌晨四点零二分，频谱分析仪跳出异常数据。',
      '那是一个编码过的信号。',
      '星图中心，有一个坐标。',
      '他盯着那个坐标，决定今晚自己去看看。',
    ].join('\n');
    const driftedOriginal = current
      .replace('夜空中的信号', '我，物理学博士，穿成了妹子')
      .replace('他沉默了很久。\n', '');
    const replacement = [
      '# 第一章 我，物理学博士，穿成了妹子',
      '林心觉得自己这辈子，不对，上辈子的运气真是绝了。',
      '这一章已经扩写到完整网文章节节奏。',
    ].join('\n');

    useAppStore.setState({
      openFiles: [{
        id: 'tab-1',
        path: filePath,
        name: 'ch01.md',
        content: current,
        savedContent: current,
        kind: 'text',
      }],
      pendingDiffs: [{
        kind: 'passage',
        id: 'diff-1',
        toolId: 'rewrite_passage',
        sourceType: 'chapter',
        chapterId: 'ch01',
        originalText: driftedOriginal,
        replacement,
      }],
    } as any);

    useAppStore.getState().acceptDiff('diff-1');

    expect(useAppStore.getState().pendingPassageResolve).toBeNull();
    expect(useAppStore.getState().pendingDiffs).toEqual([]);
    expect(useAppStore.getState().openFiles[0].content).toBe(replacement);
  });
});
