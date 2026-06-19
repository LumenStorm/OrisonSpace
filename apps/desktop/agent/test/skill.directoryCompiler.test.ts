import { describe, expect, it } from 'vitest';

describe('directory skill compiler core types', () => {
  it('exports compiled directory skill and execution plan models for workflow nodes', async () => {
    const compilerTypes = await import('../src/skill/runtime/compilerTypes');
    const executionPlanModule = await import('../src/skill/runtime/executionPlan');

    const plan: ExecutionPlan = {
      entryNodeId: 'phase-1',
      nodes: [
        {
          id: 'phase-1',
          type: 'instruction',
          title: 'Phase 1',
          content: 'Collect user intent before writing.',
        },
        {
          id: 'phase-1-ref',
          type: 'load_reference',
          path: 'references/opening-design.md',
          mode: 'summary',
        },
        {
          id: 'phase-1-skill',
          type: 'delegate_skill',
          skillName: 'story-long-write',
        },
        {
          id: 'phase-1-ask',
          type: 'ask_user',
          question: '你想写长篇还是短篇？',
        },
        {
          id: 'phase-1-agent',
          type: 'spawn_agent',
          agentType: 'narrative-writer',
          prompt: 'Draft the next chapter.',
        },
        {
          id: 'done',
          type: 'finish',
        },
      ],
      edges: [
        { from: 'phase-1', to: 'phase-1-ref' },
        { from: 'phase-1-ref', to: 'phase-1-skill' },
        { from: 'phase-1-skill', to: 'phase-1-ask' },
        { from: 'phase-1-ask', to: 'phase-1-agent' },
        { from: 'phase-1-agent', to: 'done' },
      ],
    };

    const compiledSkill: CompiledSkill = {
      id: 'story',
      name: 'story',
      source: 'directory',
      entryPath: 'I:\\echo\\skill\\story\\SKILL.md',
      location: 'I:\\echo\\skill\\story',
      description: 'Story workflow router',
      rawPrompt: 'Phase 1\nPhase 2',
      references: ['I:\\echo\\skill\\story\\references\\opening-design.md'],
      scripts: ['I:\\echo\\skill\\story\\scripts\\rank-scraper.js'],
      capabilities: ['load_reference', 'delegate_skill', 'ask_user', 'spawn_agent'],
      compiledPlan: plan,
      warnings: [],
    };

    expect(compiledSkill.source).toBe('directory');
    expect(compiledSkill.compiledPlan.entryNodeId).toBe('phase-1');

    const nodeTypes = compiledSkill.compiledPlan.nodes.map((node) => node.type);
    expect(nodeTypes).toEqual([
      'instruction',
      'load_reference',
      'delegate_skill',
      'ask_user',
      'spawn_agent',
      'finish',
    ] satisfies PrimitiveNodeType[]);

    expect(compiledSkill.compiledPlan.nodes.filter((node) => node.title?.startsWith('Phase '))).toHaveLength(1);
    expect(compilerTypes.isPrimitiveNodeType('instruction')).toBe(true);
    expect(compilerTypes.isPrimitiveNodeType('not-a-node')).toBe(false);
    expect(executionPlanModule.createExecutionPlan({
      entryNodeId: 'phase-1',
      nodes: plan.nodes,
      edges: plan.edges,
    })).toMatchObject({
      entryNodeId: 'phase-1',
      nodes: plan.nodes,
      edges: plan.edges,
    });
  });

  it('compiles semi-structured directory skill primitives from markdown workflow text', async () => {
    const { compileDirectorySkill } = await import('../src/skill/runtime/compiler');

    const compiled = compileDirectorySkill({
      id: 'story-router',
      name: 'story-router',
      source: 'directory',
      entryPath: 'I:\\echo\\skill\\story\\SKILL.md',
      location: 'I:\\echo\\skill\\story',
      description: 'Route story workflow',
      rawPrompt: `# story

## Phase 1：分析用户意图

加载 [references/opening-design.md](references/opening-design.md)。
如果需要长篇写作，调用 Skill("story-long-write")。
未知方向时使用 AskUserQuestion 确认题材。

## Phase 2：执行写作

必要时调用 Agent(subagent_type: "narrative-writer", prompt: "写下一章")。
`,
      references: ['I:\\echo\\skill\\story\\references\\opening-design.md'],
      scripts: [],
      capabilities: [],
      compiledPlan: {
        entryNodeId: 'placeholder',
        nodes: [],
        edges: [],
      },
      warnings: [],
    });

    expect(compiled.capabilities).toEqual(expect.arrayContaining([
      'load_reference',
      'delegate_skill',
      'ask_user',
      'spawn_agent',
    ]));
    // References load before the phase instruction, so the entry node is the
    // first load_reference, not the instruction.
    expect(compiled.compiledPlan.entryNodeId).toBe('phase-1:reference:0');
    expect(compiled.compiledPlan.nodes.find((node) => node.id === compiled.compiledPlan.entryNodeId)?.type)
      .toBe('load_reference');
    expect(compiled.compiledPlan.nodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      'instruction',
      'load_reference',
      'delegate_skill',
      'ask_user',
      'spawn_agent',
      'finish',
    ]));
    expect(compiled.compiledPlan.nodes.filter((node) => node.title?.startsWith('Phase '))).toHaveLength(2);
  });

  it('loads references linked via _reference/ as full content and dedupes against catalogued files', async () => {
    const { compileDirectorySkill } = await import('../src/skill/runtime/compiler');

    const compiled = compileDirectorySkill({
      id: 'oh-story',
      name: 'oh-story',
      source: 'directory',
      entryPath: 'I:\\echo\\skill\\oh-story\\SKILL.md',
      location: 'I:\\echo\\skill\\oh-story',
      description: 'oh-story workflow',
      rawPrompt: `# oh-story

## Phase 1

参考 [风格](_reference/style.md)。
`,
      // style.md is both linked and catalogued — it must not be loaded twice.
      // lore.md is catalogued but unlinked — it must be auto-loaded.
      references: [
        'I:\\echo\\skill\\oh-story\\_reference\\style.md',
        'I:\\echo\\skill\\oh-story\\_reference\\lore.md',
      ],
      scripts: [],
      capabilities: [],
      compiledPlan: { entryNodeId: 'placeholder', nodes: [], edges: [] },
      warnings: [],
    });

    const refNodes = compiled.compiledPlan.nodes.filter((node) => node.type === 'load_reference');
    expect(refNodes).toHaveLength(2);
    // The explicitly linked reference is loaded in full.
    expect(refNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '_reference/style.md', mode: 'full' }),
    ]));
    // The unlinked catalogued reference is auto-loaded by absolute path.
    expect(refNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'I:\\echo\\skill\\oh-story\\_reference\\lore.md' }),
    ]));
  });

  it('extracts multi-agent review stages from structured subagent sections without skill-specific hardcoding', async () => {
    const { compileDirectorySkill } = await import('../src/skill/runtime/compiler');

    const compiled = compileDirectorySkill({
      id: 'review-coordinator',
      name: 'review-coordinator',
      source: 'directory',
      entryPath: 'I:\\echo\\skill\\review\\SKILL.md',
      location: 'I:\\echo\\skill\\review',
      description: 'Structured multi-agent review workflow',
      rawPrompt: `# review

## Phase 1：预查询

如果需要上下文，可 spawn Agent(subagent_type: "story-explorer", prompt: "查询当前设定")。

## Phase 2：并行审查

**Agent 1: story-architect**（subagent_type: story-architect）
- 审查视角：结构、节奏、反转

**Agent 2: character-designer**（subagent_type: character-designer）
- 审查视角：角色、人设、对话

**Agent 3: narrative-writer**（subagent_type: narrative-writer）
- 审查视角：文风、AI味、格式

**Agent 4: consistency-checker**（subagent_type: consistency-checker）
- 审查视角：事实矛盾、时间线、伏笔
`,
      references: [],
      scripts: [],
      capabilities: [],
      compiledPlan: {
        entryNodeId: 'placeholder',
        nodes: [],
        edges: [],
      },
      warnings: [],
    });

    const spawnNodes = compiled.compiledPlan.nodes.filter((node) => node.type === 'spawn_agent');
    expect(spawnNodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ agentType: 'story-explorer' }),
      expect.objectContaining({ agentType: 'story-architect' }),
      expect.objectContaining({ agentType: 'character-designer' }),
      expect.objectContaining({ agentType: 'narrative-writer' }),
      expect.objectContaining({ agentType: 'consistency-checker' }),
    ]));
    expect(compiled.capabilities).toContain('spawn_agent');
  });

  it('recognizes deeper markdown phase headings and Chinese ask-user prompts', async () => {
    const { compileDirectorySkill } = await import('../src/skill/runtime/compiler');

    const compiled = compileDirectorySkill({
      id: 'story-long-write',
      name: 'story-long-write',
      source: 'directory',
      entryPath: 'I:\\echo\\skill\\story-long-write\\SKILL.md',
      location: 'I:\\echo\\skill\\story-long-write',
      description: 'Long-form story writing',
      rawPrompt: `# story-long-write

### Phase 1：确认选题方向

如果用户没有方向：

问用户：**「你想写什么类型？有没有喜欢的书想对标？」**

#### Agent 调用：story-architect

确认选题方向后，可 spawn Agent(subagent_type: "story-architect", prompt: "题材定位")。

### Phase 2：核心设定

帮用户确立主角设定和世界观。

#### Agent 调用：character-designer

可 spawn Agent(subagent_type: "character-designer", prompt: "角色设定")。
`,
      references: [],
      scripts: [],
      capabilities: [],
      compiledPlan: {
        entryNodeId: 'placeholder',
        nodes: [],
        edges: [],
      },
      warnings: [],
    });

    const nodeTypes = compiled.compiledPlan.nodes.map((node) => node.type);
    expect(compiled.compiledPlan.nodes.filter((node) => node.type === 'instruction')).toHaveLength(2);
    expect(nodeTypes).toEqual(expect.arrayContaining([
      'instruction',
      'ask_user',
      'spawn_agent',
      'finish',
    ]));
    expect(compiled.compiledPlan.nodes.find((node) => node.type === 'ask_user')).toBeTruthy();
    expect(compiled.compiledPlan.nodes.filter((node) => node.type === 'spawn_agent')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agentType: 'story-architect' }),
        expect.objectContaining({ agentType: 'character-designer' }),
      ]),
    );
  });
});
