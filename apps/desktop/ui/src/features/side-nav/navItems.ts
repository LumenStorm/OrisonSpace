import type { WorkspaceModule } from '../../shared/store/appStore';

export type NavItem = { key: WorkspaceModule; icon: string; i18nKey: string };

/** Items that switch the active module (editor view) */
export const novelNavItems: NavItem[] = [
  { key: 'overview', icon: 'dashboard', i18nKey: 'nav.overview' },
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' },
];

export const scriptNavItems: NavItem[] = [
  { key: 'overview', icon: 'dashboard', i18nKey: 'nav.overview' },
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
];

/** Items that open a module tab in the editor area */
export type ModuleTabItem = { id: string; icon: string; i18nKey: string; label: string };

export const moduleTabItems: ModuleTabItem[] = [
  { id: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard', label: '分镜' },
  { id: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen', label: '图片生成' },
  { id: 'video', icon: 'movie_filter', i18nKey: 'nav.video', label: '视频' },
];
