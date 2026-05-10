import { useMemo } from 'react';
import { useAppStore } from '../../shared/store/appStore';

export function ContextRail() {
  const route = useAppStore((s) => s.novelWorkspace.route);
  const category = useAppStore((s) => s.novelWorkspace.objectCategory);
  const guidedStatus = useAppStore((s) => s.guidedNovelState?.session?.status ?? null);

  const sections = useMemo(() => {
    if (route === 'guided') {
      if (guidedStatus === 'planning' || guidedStatus === 'ready_to_write') {
        return ['缺口提醒', '影响范围', '当前基线版本'];
      }
      if (guidedStatus === 'chapter_review_pending') {
        return ['本章涉及角色', '设定约束', '记忆引用'];
      }
      if (guidedStatus === 'change_review_pending') {
        return ['写入位置', '影响对象', '重规划建议'];
      }
      return ['已明确要素', '待补信息', '当前创作画像'];
    }

    switch (category) {
      case 'characters':
        return ['关系网络', '成长线', '最近出场'];
      case 'story_world':
        return ['世界规则', '开放问题', '潜在冲突'];
      case 'chapters':
        return ['章节摘要', '涉及角色', '待处理线索'];
      default:
        return ['当前上下文', '相关对象', '系统提示'];
    }
  }, [category, guidedStatus, route]);

  return (
    <aside className="context-rail" aria-label="Context Rail">
      <div className="context-rail-header">
        <span className="context-rail-kicker">上下文</span>
        <h2>关联信息</h2>
      </div>
      <div className="context-rail-sections">
        {sections.map((section) => (
          <section key={section} className="context-rail-section">
            <h3>{section}</h3>
            <p>这里会根据当前创作对象显示实时关联信息。</p>
          </section>
        ))}
      </div>
    </aside>
  );
}
