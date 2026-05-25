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
    expect(compiled.compiledPlan.entryNodeId).toBe('phase-1');
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
});
