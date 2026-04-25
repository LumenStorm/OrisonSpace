import crypto from 'node:crypto';
import type { CreativeRunRequest, CreativeRunContext, CreativeFieldKey } from '@orison/shared-contracts';
import { creativeFieldKeys } from '@orison/shared-contracts';
import { getDefaultDependencyGraph, initFieldVersions } from './workflowSync';

/**
 * 将 CreativeRunRequest 归一化为 CreativeRunContext
 */
export function buildCreativeRunContext(
  request: CreativeRunRequest,
  projectDocument?: Record<string, unknown> | null
): CreativeRunContext {
  const doc = request.projectDocument ?? projectDocument ?? null;

  // 确定 projectDocumentStatus
  let projectDocumentStatus: 'loaded' | 'missing' | 'partial' = 'missing';
  if (doc) {
    const hasOutline = 'outline' in doc;
    const hasMeta = 'meta' in doc;
    projectDocumentStatus = hasOutline && hasMeta ? 'loaded' : 'partial';
  }

  // 初始化字段版本
  const fieldVersions = initFieldVersions();

  // 如果有 projectDocument，尝试从中提取已有字段版本
  if (doc) {
    for (const key of creativeFieldKeys) {
      if (key in doc && doc[key] != null) {
        fieldVersions[key] = 1;
      }
    }
  }

  // 默认 targetFields：create 时全部，其他按请求
  const targetFields: CreativeFieldKey[] = request.targetFields ?? [...creativeFieldKeys];

  return {
    runId: `run_${crypto.randomUUID()}`,
    projectPath: request.projectPath,
    requirement: request.requirement,
    runIntent: request.runIntent ?? 'create',
    targetFields,
    projectDocument: doc,
    projectDocumentStatus,
    fieldVersions,
    dependencyGraph: getDefaultDependencyGraph(),
    staleFields: [],
    syncEvents: [],
    constraints: request.constraints ?? { language: 'zh-CN' },
    agentPolicy: {
      outputJsonOnly: true,
      noOverwriteOtherFields: true,
      noDiscardUpstreamFacts: true,
      explicitDegradeOnMissing: true,
      traceableSourceRefs: true,
      defaultLanguage: request.constraints?.language ?? 'zh-CN',
      fieldNameCase: 'snake_case'
    }
  };
}
