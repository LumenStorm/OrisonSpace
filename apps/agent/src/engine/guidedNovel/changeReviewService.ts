import { guidedChangeChecklistSchema } from '@orison/shared-contracts';
import type { AssetCard, GuidedChangeChecklist, WorldSetting } from '@orison/shared-contracts';

export type GuidedChangeReviewInput = {
  chapterId: string;
  chapterText: string;
  currentAssets: Array<Pick<AssetCard, 'id' | 'type' | 'name'>>;
  currentWorldSetting?: Partial<WorldSetting> | null;
};

export function deriveGuidedChangeChecklist(input: GuidedChangeReviewInput): GuidedChangeChecklist {
  const items: GuidedChangeChecklist['items'] = [];
  const knownAssetNames = new Set(input.currentAssets.map((asset) => asset.name.toLowerCase()));
  const knownLocationNames = new Set(
    (input.currentWorldSetting?.locations ?? []).map((location: { name: string }) => location.name.toLowerCase()),
  );

  const characterName = captureName(input.chapterText, /\bmet\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (characterName && !knownAssetNames.has(characterName.toLowerCase())) {
    items.push({
      id: `change_${slugify(characterName)}`,
      type: 'new_character',
      sourceChapterId: input.chapterId,
      sourceExcerpt: input.chapterText,
      targetIds: [],
      suggestedOperation: 'create',
      confidence: 'high',
      payload: {
        id: `char_${slugify(characterName)}`,
        type: 'character',
        name: characterName,
        summary: `Introduced in ${input.chapterId}`,
      },
      decision: 'pending',
    });
  }

  const locationName =
    captureName(input.chapterText, /\bin\s+the\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i) ??
    captureName(input.chapterText, /\bat\s+the\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i);
  if (locationName && !knownLocationNames.has(locationName.toLowerCase())) {
    items.push({
      id: `change_${slugify(locationName)}`,
      type: 'new_location',
      sourceChapterId: input.chapterId,
      sourceExcerpt: input.chapterText,
      targetIds: [],
      suggestedOperation: 'create',
      confidence: 'medium',
      payload: {
        id: `loc_${slugify(locationName)}`,
        type: 'location',
        name: locationName,
        summary: `Introduced in ${input.chapterId}`,
      },
      decision: 'pending',
    });
  }

  return guidedChangeChecklistSchema.parse({
    chapterId: input.chapterId,
    items,
  });
}

function captureName(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
