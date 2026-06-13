import type { CreativeFieldKey, WorkflowSyncEvent } from '@orison/shared-contracts';
import { createSyncEvent, markStaleFields, projectDocumentSchema } from '@orison/shared-contracts';
import { loadProject, saveProject, bootstrapProjectFromMeta } from './localProjectRepository';

const FIELD_TO_KEY: Record<string, string> = {
  creative_brief: 'creative_brief',
  world_setting: 'world_setting',
  outline: 'outline_v2',
  episode_outlines: 'episode_outlines',
  growth_curve: 'growth_curve',
  pacing_curve: 'pacing_curve',
  emotion_curve: 'emotion_curve',
  asset_cards: 'asset_cards',
  relationship_graph: 'relationship_graph',
  foreshadow_registry: 'foreshadow_registry'
};

/**
 * 用户手动编辑某个创作字段后调用。
 * 递增 fieldVersion，生成 WorkflowSyncEvent，标记下游 stale 字段。
 */
export function onFieldEdited(
  projectPath: string,
  field: CreativeFieldKey,
  newData: unknown
): { syncEvent: WorkflowSyncEvent; staleFields: CreativeFieldKey[] } {
  // project.yaml 不存在时自愈重建（首次编辑一个只存过 project.json 的项目）。
  const project = loadProject(projectPath) ?? bootstrapProjectFromMeta(projectPath);

  const next = structuredClone(project) as Record<string, any>;

  // 检查字段是否被锁定
  if (!next.field_metadata) next.field_metadata = {};
  const currentMeta = next.field_metadata[field] ?? {
    version: 0,
    source: 'user',
    locked: false,
    dependsOn: [],
    stale: false
  };

  if (currentMeta.locked) {
    throw new Error(`Field ${field} is locked and cannot be edited`);
  }

  const fromVersion = currentMeta.version;
  const toVersion = fromVersion + 1;

  // 更新字段数据
  const docKey = FIELD_TO_KEY[field];
  if (docKey) {
    next[docKey] = newData;
  }

  // 更新当前字段的 metadata
  next.field_metadata[field] = {
    ...currentMeta,
    version: toVersion,
    source: 'user',
    stale: false
  };

  // 生成同步事件
  const syncEvent = createSyncEvent({
    source: 'user',
    field,
    fromVersion,
    toVersion,
    reason: `用户编辑了 ${field}`
  });

  // 标记下游 stale
  const currentStale: CreativeFieldKey[] = [];
  const staleFields = markStaleFields(currentStale, field);

  for (const staleField of staleFields) {
    if (!next.field_metadata[staleField]) {
      next.field_metadata[staleField] = {
        version: 0,
        source: 'agent',
        locked: false,
        dependsOn: [],
        stale: true
      };
    } else {
      next.field_metadata[staleField].stale = true;
    }
  }

  // 兜底 meta：手改/历史 project.yaml 可能缺 meta，直接 `next.meta.version += 1`
  // 会抛 TypeError，导致整次保存静默失败（编辑写不进盘）。
  if (!next.meta || typeof next.meta !== 'object') {
    const now = new Date().toISOString();
    next.meta = {
      id: crypto.randomUUID(),
      name: typeof next.name === 'string' ? next.name : 'Untitled',
      type: next.type === 'script' ? 'script' : 'novel',
      version: 0,
      created_at: now,
      updated_at: now
    };
  }
  if (typeof next.meta.version !== 'number') next.meta.version = 0;
  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();

  const validated = projectDocumentSchema.parse(next);
  saveProject(projectPath, validated);

  return { syncEvent, staleFields };
}
