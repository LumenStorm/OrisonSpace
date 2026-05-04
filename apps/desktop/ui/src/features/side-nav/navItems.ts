import type { WorkspaceModule } from '../../shared/store/appStore';

export type NavItem = { key: WorkspaceModule; icon: string; i18nKey: string };

export const novelNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

export const scriptNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];
