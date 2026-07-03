import type { ActivePage } from '../store/appStore';

const moduleItems: Array<{ key: ActivePage; label: string; icon: string }> = [
  { key: 'outline', label: 'Outline', icon: 'auto_stories' },
  { key: 'image_gen', label: 'Image Gen', icon: 'image' },
];

const _projectTreeItems = [
  ...moduleItems,
  { key: 'assets', label: 'Assets', icon: 'folder_open' },
] as const;

const _inspectorFields = [
  {
    label: 'Camera Lens',
    options: ['Macro (100mm)', 'Portrait (50mm)', 'Wide (35mm)', 'Ultra-Wide (14mm)'],
    selected: 'Portrait (50mm)'
  },
  {
    label: 'Lighting Mood',
    options: ['Natural Daylight', 'Golden Hour', 'Noir / High Contrast', 'Cinematic Blue'],
    selected: 'Noir / High Contrast'
  }
];
