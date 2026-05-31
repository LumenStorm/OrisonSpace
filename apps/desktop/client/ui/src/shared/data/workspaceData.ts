import type { ActivePage } from '../store/appStore';

export const moduleItems: Array<{ key: ActivePage; label: string; icon: string }> = [
  { key: 'outline', label: 'Outline', icon: 'auto_stories' },
  { key: 'script', label: 'Script', icon: 'description' },
  { key: 'storyboard', label: 'Storyboard', icon: 'view_quilt' },
  { key: 'image_gen', label: 'Image Gen', icon: 'image' },
  { key: 'video', label: 'Video', icon: 'movie_filter' },
];

export const projectTreeItems = [
  ...moduleItems,
  { key: 'assets', label: 'Assets', icon: 'folder_open' },
  { key: 'design', label: 'Design.md', icon: 'edit_note' }
] as const;

export const storyboardFrames = [
  {
    id: 'SEQ 01',
    title:
      'Establishing wide shot of the neon-drenched city. Rain slicks the pavement, reflecting the towering advertisements above.'
  },
  {
    id: 'SEQ 02',
    title:
      'Mid shot of Detective Kael stepping under a flickering street lamp. He looks exhausted, collar turned up against the chill.'
  },
  {
    id: 'SEQ 03',
    title:
      'Extreme close-up on Kael’s cybernetic eye as it whirs and focuses, reflecting the glow of the club sign.'
  }
];

export const inspectorFields = [
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
