import { describe, expect, it } from 'vitest';
import { creativeRunContextSchema, creativeFieldKeys } from '@orison/shared-contracts';
import { buildCreativeRunContext } from '../src/engine/contextBuilder';

describe('contextBuilder', () => {
  it('从最小 request 构建完整 context', () => {
    const ctx = buildCreativeRunContext({
      projectPath: 'I:/workspace/demo',
      requirement: '写一个悬疑故事'
    });

    expect(ctx.runId).toMatch(/^run_/);
    expect(ctx.projectPath).toBe('I:/workspace/demo');
    expect(ctx.requirement).toBe('写一个悬疑故事');
    expect(ctx.runIntent).toBe('create');
    expect(ctx.projectDocument).toBeNull();
    expect(ctx.projectDocumentStatus).toBe('missing');
    expect(ctx.staleFields).toEqual([]);
    expect(ctx.syncEvents).toEqual([]);
  });

  it('fieldVersions 初始化为全 0', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    for (const key of creativeFieldKeys) {
      expect(ctx.fieldVersions[key]).toBe(0);
    }
  });

  it('dependencyGraph 包含依赖边', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    expect(ctx.dependencyGraph.edges.length).toBeGreaterThan(0);
  });

  it('有 projectDocument 时 status 为 loaded', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test',
      projectDocument: {
        meta: { id: 'p1' },
        outline_v2: { title: 'Test', synopsis: '测试故事' }
      }
    });

    expect(ctx.projectDocumentStatus).toBe('loaded');
    expect(ctx.projectDocument).not.toBeNull();
    // outline 存在，版本应为 1
    expect(ctx.fieldVersions.outline).toBe(1);
  });

  it('projectDocument 不完整时 status 为 partial', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test',
      projectDocument: { outline_v2: { title: 'Test' } }
    });

    expect(ctx.projectDocumentStatus).toBe('partial');
  });

  it('targetFields 默认为全部字段', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    expect(ctx.targetFields).toEqual([...creativeFieldKeys]);
  });

  it('targetFields 可指定', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test',
      targetFields: ['outline', 'episode_outlines']
    });

    expect(ctx.targetFields).toEqual(['outline', 'episode_outlines']);
  });

  it('constraints 使用请求中的值', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test',
      constraints: { language: 'en-US', episodeCount: 12 }
    });

    expect(ctx.constraints.language).toBe('en-US');
    expect(ctx.constraints.episodeCount).toBe(12);
  });

  it('agentPolicy 默认值正确', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    expect(ctx.agentPolicy.outputJsonOnly).toBe(true);
    expect(ctx.agentPolicy.defaultLanguage).toBe('zh-CN');
    expect(ctx.agentPolicy.fieldNameCase).toBe('snake_case');
  });

  it('构建结果能通过 creativeRunContextSchema 校验', () => {
    const ctx = buildCreativeRunContext({
      projectPath: '/p',
      requirement: 'test'
    });

    expect(() => creativeRunContextSchema.parse(ctx)).not.toThrow();
  });
});
