import { useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import type { NovelObjectCategory } from '../../shared/store/types';

const CATEGORY_TITLES: Record<NovelObjectCategory, string> = {
  chapters: '章节',
  story_world: '世界观',
  characters: '角色',
  locations: '地点',
  props: '道具',
  images: '图像',
};

const CATEGORY_ITEMS: Record<NovelObjectCategory, string[]> = {
  chapters: ['第一章', '第二章', '第三章'],
  story_world: ['世界设定', '规则与代价', '主线谜团'],
  characters: ['主角', '主要配角', '对立角色'],
  locations: ['核心城市', '关键场景', '隐藏地点'],
  props: ['关键道具', '象征物', '线索物件'],
  images: ['角色主视觉', '场景参考图', '道具细节图'],
};

export function ObjectListPane() {
  const objectCategory = useAppStore((s) => s.novelWorkspace.objectCategory);
  const activeObjectId = useAppStore((s) => s.novelWorkspace.activeObjectId);
  const selectNovelObject = useAppStore((s) => s.selectNovelObject);

  const title = objectCategory ? CATEGORY_TITLES[objectCategory] : '对象列表';
  const items = useMemo(() => (objectCategory ? CATEGORY_ITEMS[objectCategory] : []), [objectCategory]);

  return (
    <aside className="object-list-pane" aria-label="Novel Object List">
      <div className="object-list-header">
        <span className="object-list-kicker">对象导航</span>
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="object-list-empty">先从左侧选择一个创作对象类别。</p>
      ) : (
        <div className="object-list-items">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              className={`object-list-item${activeObjectId === item ? ' is-active' : ''}`}
              onClick={() => selectNovelObject(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
