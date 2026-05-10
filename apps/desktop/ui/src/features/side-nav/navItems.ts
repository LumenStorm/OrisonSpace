import type { NovelObjectCategory, WorkspaceModule } from '../../shared/store/types';

export type NavItem = {
  key: WorkspaceModule;
  icon: string;
  i18nKey: string;
  novelRoute?: 'home' | 'guided' | 'production';
  objectCategory?: NovelObjectCategory;
};

export const novelNavItems: NavItem[] = [
  { key: 'novel', icon: 'home', i18nKey: 'nav.novelHome', novelRoute: 'home' },
  { key: 'guided_novel', icon: 'psychology', i18nKey: 'nav.guidedNovel', novelRoute: 'guided' },
  { key: 'outline', icon: 'menu_book', i18nKey: 'nav.chapters', objectCategory: 'chapters' },
  { key: 'novel', icon: 'public', i18nKey: 'nav.storyWorld', objectCategory: 'story_world' },
  { key: 'novel', icon: 'face', i18nKey: 'nav.characters', objectCategory: 'characters' },
  { key: 'novel', icon: 'location_on', i18nKey: 'nav.locations', objectCategory: 'locations' },
  { key: 'novel', icon: 'deployed_code', i18nKey: 'nav.props', objectCategory: 'props' },
  { key: 'image_gen', icon: 'imagesmode', i18nKey: 'nav.images', objectCategory: 'images' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard', novelRoute: 'production' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video', novelRoute: 'production' },
];

export const scriptNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];
