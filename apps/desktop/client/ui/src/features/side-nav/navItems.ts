import type { ActivePage } from '../../shared/store/appStore';

export type PageNavItem = { id: ActivePage; icon: string; i18nKey: string };

/** Group 1: Overview + Outline + Assets + Novel/Script */
export const overviewItem: PageNavItem = { id: 'overview', icon: 'dashboard', i18nKey: 'nav.overview' };
export const outlineItem: PageNavItem = { id: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' };
export const assetsItem: PageNavItem = { id: 'assets', icon: 'perm_media', i18nKey: 'nav.assets' };
export const novelItem: PageNavItem = { id: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' };
export const scriptItem: PageNavItem = { id: 'script', icon: 'description', i18nKey: 'nav.script' };

/** Group 2: Production tools */
export const productionItems: PageNavItem[] = [
  { id: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { id: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

