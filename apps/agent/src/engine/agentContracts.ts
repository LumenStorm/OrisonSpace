import type { AgentContract } from '@orison/shared-contracts';

const contracts: AgentContract[] = [
  {
    id: 'intake-agent',
    role: '需求解析',
    goal: '把自由需求变成结构化创作 brief',
    owns: ['creative_brief'],
    reads: [],
    must: ['提取题材、语气、受众、篇幅、禁忌、用户明确约束'],
    mustNot: ['生成完整剧情'],
    outputSchemaName: 'creativeBriefSchema',
    qualityGates: ['has_genre_or_theme', 'has_raw_requirement']
  },
  {
    id: 'asset-loader-agent',
    role: '资产装载',
    goal: '建立初始资产卡、世设素材和人物关系网',
    owns: ['asset_cards', 'relationship_graph', 'world_setting'],
    reads: ['creative_brief'],
    must: ['区分事实设定和建议设定', '新资产必须有 sourceRefs'],
    mustNot: ['覆盖 locked 资产', '生成剧情'],
    outputSchemaName: 'assetLoaderOutputSchema',
    qualityGates: ['has_at_least_one_character', 'world_setting_has_premise']
  },
  {
    id: 'story-planner-agent',
    role: '故事规划',
    goal: '生成或修订总大纲',
    owns: ['outline'],
    reads: ['creative_brief', 'world_setting', 'asset_cards', 'relationship_graph'],
    must: ['明确主题和核心冲突', '包含主要转折点'],
    mustNot: ['直接写章节正文', '修改世设'],
    outputSchemaName: 'outlineV2Schema',
    qualityGates: ['has_central_conflict', 'has_major_turning_points', 'has_ending_direction']
  },
  {
    id: 'curve-planner-agent',
    role: '曲线规划',
    goal: '产出成长曲线、节奏曲线和情感曲线',
    owns: ['growth_curve', 'pacing_curve', 'emotion_curve'],
    reads: ['outline', 'asset_cards', 'relationship_graph', 'world_setting'],
    must: ['每个曲线点引用 act、episode 或 chapter'],
    mustNot: ['产生无法映射到结构单元的抽象建议', '修改大纲'],
    outputSchemaName: 'curvePlannerOutputSchema',
    qualityGates: ['curves_reference_structure_units', 'growth_curve_has_turning_points']
  },
  {
    id: 'episode-planner-agent',
    role: '集纲规划',
    goal: '生成分集/分章节集纲',
    owns: ['episode_outlines'],
    reads: ['outline', 'growth_curve', 'pacing_curve', 'emotion_curve', 'asset_cards', 'relationship_graph', 'world_setting'],
    must: ['每集包含目的、核心事件、情绪点、节奏点、伏笔、回收和钩子'],
    mustNot: ['让集纲与总大纲转折冲突', '写正文'],
    outputSchemaName: 'episodeOutlinesSchema',
    qualityGates: ['each_episode_has_core_event', 'no_conflict_with_outline']
  },
  {
    id: 'draft-writer-agent',
    role: '初稿生成',
    goal: '根据指定集纲写初稿',
    owns: [],
    reads: ['episode_outlines', 'world_setting', 'asset_cards', 'growth_curve', 'pacing_curve', 'emotion_curve'],
    must: ['只写目标 episode/chapter'],
    mustNot: ['重写全局设定', '修改集纲'],
    outputSchemaName: 'draftOutputSchema',
    qualityGates: ['draft_matches_target_episode']
  },
  {
    id: 'continuity-memory-agent',
    role: '连续性记忆',
    goal: '抽取连续性记忆，生成候选资产和关系补丁',
    owns: [],
    reads: ['asset_cards', 'relationship_graph', 'world_setting'],
    must: ['区分事实更新和建议更新'],
    mustNot: ['自动把候选补丁写入 locked 字段'],
    outputSchemaName: 'continuityMemoryOutputSchema',
    qualityGates: ['patches_have_source_refs']
  },
  {
    id: 'multi-review-agent',
    role: '多维审核',
    goal: '审查结构、设定、曲线、集纲和正文一致性',
    owns: [],
    reads: ['creative_brief', 'world_setting', 'outline', 'episode_outlines', 'growth_curve', 'pacing_curve', 'emotion_curve', 'asset_cards', 'relationship_graph'],
    must: ['输出 pass/revise/escalate 和维度评分', '记录审核使用的字段版本'],
    mustNot: ['直接修文', '覆盖任何创作字段'],
    outputSchemaName: 'reviewOutputSchema',
    qualityGates: ['has_verdict', 'has_dimension_scores']
  },
  {
    id: 'targeted-revision-agent',
    role: '定向修订',
    goal: '按审稿意见做定向修订',
    owns: [],
    reads: ['creative_brief', 'world_setting', 'outline', 'episode_outlines', 'asset_cards', 'relationship_graph'],
    must: ['只改 review 指定范围'],
    mustNot: ['无理由扩大改动范围'],
    outputSchemaName: 'revisionOutputSchema',
    qualityGates: ['changes_within_review_scope']
  }
];

const contractMap = new Map(contracts.map((c) => [c.id, c]));

export function getAgentContract(id: string): AgentContract | undefined {
  return contractMap.get(id);
}

export function getAllAgentContracts(): AgentContract[] {
  return [...contracts];
}
