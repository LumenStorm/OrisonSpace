import type { WorkspaceModule } from '../store/types';

export type FieldDef = {
  kind?: 'select';
  labelKey: string;
  optionsKey: string;
  defaultIndex: number;
};

const scriptFields: FieldDef[] = [
  { labelKey: 'inspector.script.sceneType', optionsKey: 'inspector.script.options.sceneType', defaultIndex: 0 },
  { labelKey: 'inspector.script.timeOfDay', optionsKey: 'inspector.script.options.timeOfDay', defaultIndex: 0 },
  { labelKey: 'inspector.script.dialogueStyle', optionsKey: 'inspector.script.options.dialogueStyle', defaultIndex: 0 },
  { labelKey: 'inspector.script.format', optionsKey: 'inspector.script.options.format', defaultIndex: 0 },
];

export const moduleFields: Record<WorkspaceModule, FieldDef[]> = {
  overview: [],
  outline: [
    { labelKey: 'inspector.outline.visualStyle', optionsKey: 'inspector.outline.options.visualStyle', defaultIndex: 0 },
    { labelKey: 'inspector.outline.narrativeStyle', optionsKey: 'inspector.outline.options.narrativeStyle', defaultIndex: 0 },
    { labelKey: 'inspector.outline.pacing', optionsKey: 'inspector.outline.options.pacing', defaultIndex: 0 },
    { labelKey: 'inspector.outline.tone', optionsKey: 'inspector.outline.options.tone', defaultIndex: 4 },
  ],
  novel: scriptFields,
  script: scriptFields,
  storyboard: [
    { labelKey: 'inspector.storyboard.cameraLens', optionsKey: 'inspector.storyboard.options.cameraLens', defaultIndex: 1 },
    { labelKey: 'inspector.storyboard.lightingMood', optionsKey: 'inspector.storyboard.options.lightingMood', defaultIndex: 0 },
    { labelKey: 'inspector.storyboard.shotType', optionsKey: 'inspector.storyboard.options.shotType', defaultIndex: 1 },
  ],
  video: [
    { labelKey: 'inspector.video.resolution', optionsKey: 'inspector.video.options.resolution', defaultIndex: 0 },
    { labelKey: 'inspector.video.frameRate', optionsKey: 'inspector.video.options.frameRate', defaultIndex: 0 },
    { labelKey: 'inspector.video.outputFormat', optionsKey: 'inspector.video.options.outputFormat', defaultIndex: 0 },
  ],
  // image_gen renders the dedicated <ImageGenInspector />; no static fields here.
  image_gen: [],
};

export const aspectRatios: Record<WorkspaceModule, string[]> = {
  overview: [],
  outline: [],
  novel: [],
  script: [],
  storyboard: ['16:9', '2.35:1', '4:3', '9:16'],
  video: ['16:9', '2.35:1', '4:3', '9:16'],
  image_gen: [],
};

export const promptKeys: Record<WorkspaceModule, string> = {
  overview: '',
  outline: 'inspector.outline.prompt',
  novel: 'inspector.script.prompt',
  script: 'inspector.script.prompt',
  storyboard: 'inspector.storyboard.prompt',
  video: 'inspector.video.prompt',
  image_gen: 'inspector.imageGen.prompt',
};

export const actionKeys: Record<WorkspaceModule, string> = {
  overview: '',
  outline: 'inspector.outline.rewrite',
  novel: 'inspector.script.rewrite',
  script: 'inspector.script.rewrite',
  storyboard: 'inspector.storyboard.rewrite',
  video: 'inspector.video.rewrite',
  image_gen: 'inspector.imageGen.generate',
};
