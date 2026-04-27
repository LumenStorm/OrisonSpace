import { useState, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceModule } from '../../shared/store/appStore';

type TreeEntry = {
  id: string;
  label: string;
  icon: string;
  module?: WorkspaceModule;
  chapterId?: string;
  children?: TreeEntry[];
};

function buildProjectTree(
  projectName: string,
  projectType: 'novel' | 'script',
  chapters: { id: string; title: string }[],
  t: (key: string) => string,
): TreeEntry[] {
  const contentId = projectType === 'novel' ? 'novel' : 'script';
  const contentLabel = projectType === 'novel' ? t('nav.novel') : t('nav.script');
  const contentIcon = projectType === 'novel' ? 'menu_book' : 'description';

  const chapterChildren: TreeEntry[] = chapters.map((ch) => ({
    id: `chapter-${ch.id}`,
    label: ch.title,
    icon: 'article',
    module: contentId as WorkspaceModule,
    chapterId: ch.id,
  }));

  const contentEntry: TreeEntry = chapterChildren.length > 0
    ? { id: contentId, label: contentLabel, icon: contentIcon, module: contentId as WorkspaceModule, children: chapterChildren }
    : { id: contentId, label: contentLabel, icon: contentIcon, module: contentId as WorkspaceModule };

  return [
    {
      id: 'root',
      label: projectName,
      icon: 'folder',
      children: [
        { id: 'outline', label: t('nav.outline'), icon: 'auto_stories', module: 'outline' },
        contentEntry,
        { id: 'storyboard', label: t('nav.storyboard'), icon: 'view_quilt', module: 'storyboard' },
        { id: 'video', label: t('nav.video'), icon: 'movie_filter', module: 'video' },
        { id: 'assets', label: t('projectTree.assets'), icon: 'folder_open' },
        { id: 'config', label: t('projectTree.config'), icon: 'settings_suggest' },
      ],
    },
  ];
}

function TreeNode({
  entry,
  depth = 0,
  expandedIds,
  onToggle,
  activeModule,
  activeChapterId,
  onSelect,
}: {
  entry: TreeEntry;
  depth?: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  activeModule: WorkspaceModule;
  activeChapterId: string | null;
  onSelect: (module?: WorkspaceModule, chapterId?: string) => void;
}) {
  const paddingLeft = 8 + depth * 16;
  const isExpanded = expandedIds.has(entry.id);

  if (entry.children) {
    const isActive = !entry.chapterId && entry.module === activeModule;
    return (
      <div className="ptree-group">
        <div
          className={`ptree-node ptree-folder${isActive ? ' is-active' : ''}`}
          style={{ paddingLeft }}
          onClick={() => {
            onToggle(entry.id);
            if (entry.module) onSelect(entry.module);
          }}
        >
          <span className={`material-symbols-outlined ptree-chevron${isExpanded ? ' is-open' : ''}`} aria-hidden="true">
            chevron_right
          </span>
          <span className="material-symbols-outlined ptree-icon" aria-hidden="true">{entry.icon}</span>
          <span className="ptree-label">{entry.label}</span>
        </div>
        {isExpanded && entry.children.map((child) => (
          <TreeNode
            key={child.id}
            entry={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            onToggle={onToggle}
            activeModule={activeModule}
            activeChapterId={activeChapterId}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const isActive = entry.chapterId
    ? entry.chapterId === activeChapterId
    : entry.module === activeModule;

  return (
    <div
      className={`ptree-node ptree-file${isActive ? ' is-active' : ''}`}
      style={{ paddingLeft }}
      onClick={() => onSelect(entry.module, entry.chapterId)}
    >
      <span className="material-symbols-outlined ptree-icon" aria-hidden="true">{entry.icon}</span>
      <span className="ptree-label">{entry.label}</span>
    </div>
  );
}

export function ProjectTree() {
  const {
    currentProject,
    resolvedLocale,
    activeModule,
    setActiveModule,
    chapters,
    setActiveChapter,
    activeChapterId,
  } = useAppStore(
    useShallow((s) => ({
      currentProject: s.currentProject,
      resolvedLocale: s.resolvedLocale,
      activeModule: s.activeModule,
      setActiveModule: s.setActiveModule,
      chapters: s.chapters,
      setActiveChapter: s.setActiveChapter,
      activeChapterId: s.activeChapterId,
    })),
  );

  const { t } = useI18n(resolvedLocale);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root']));

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (module?: WorkspaceModule, chapterId?: string) => {
      if (module) setActiveModule(module);
      if (chapterId) setActiveChapter(chapterId);
    },
    [setActiveModule, setActiveChapter],
  );

  if (!currentProject) return null;

  const tree = buildProjectTree(
    currentProject.name,
    currentProject.type,
    chapters.map((c) => ({ id: c.id, title: c.title })),
    t,
  );

  return (
    <aside className="project-tree-panel" aria-label="Project Files">
      <div className="ptree-header">
        <span className="ptree-header-title">{t('projectTree.title')}</span>
      </div>
      <div className="ptree-list">
        {tree.map((entry) => (
          <TreeNode
            key={entry.id}
            entry={entry}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            activeModule={activeModule}
            activeChapterId={activeChapterId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </aside>
  );
}
