const FORESHADOW_CUES = ['钥匙', '预言', '信物', '暗号', '密码', '线索', '伏笔'];

export function deriveStorySyncByRules(input: {
  chapterId: string;
  content: string;
  chapterNumber: number;
  existingForeshadow: any;
  foreshadowVersion: number;
}): { patches: Array<{ field: string; action: string; data: unknown; fieldVersion: number; generatedBy: string }> } {
  const patches: Array<{ field: string; action: string; data: unknown; fieldVersion: number; generatedBy: string }> = [];

  // Normalize: accept array or { items: [] }
  const items: Array<{ title?: string; tags?: string[]; [k: string]: unknown }> = Array.isArray(input.existingForeshadow)
    ? input.existingForeshadow
    : (input.existingForeshadow?.items ?? []);

  for (const cue of FORESHADOW_CUES) {
    if (!input.content.includes(cue)) continue;
    const alreadyExists = items.some((i) =>
      (i.title && i.title.includes(cue)) || (i.tags && i.tags.includes(cue)),
    );
    if (alreadyExists) continue;
    patches.push({
      field: 'foreshadow_registry',
      action: 'merge',
      data: { title: cue, content: `${cue} detected in chapter ${input.chapterId}`, status: 'pending' },
      fieldVersion: input.foreshadowVersion,
      generatedBy: 'story-sync-agent',
    });
  }

  return { patches };
}
