import { registry } from './registry';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { listFilesTool } from './list-files';
import { searchTool } from './search';
import { memoryQueryTool } from './memory-query';
import { memoryUpdateTool } from './memory-update';
import { skillTool } from './skill';
import { generateImageTool } from './generate-image';
import { editImageTool } from './edit-image';
import { chapterListTool, chapterReadTool, chapterWriteTool } from './chapter';
import { outlineReadTool, outlineUpdateTool } from './outline';
import { projectMetaTool } from './project-meta';
import { gitStatusTool, gitCommitTool, gitLogTool, gitDiffTool } from './git';

export function registerBuiltinTools() {
  // File operations
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(listFilesTool);
  registry.register(searchTool);

  // Story memory
  registry.register(memoryQueryTool);
  registry.register(memoryUpdateTool);

  // Skills
  registry.register(skillTool);

  // Image generation
  registry.register(generateImageTool);
  registry.register(editImageTool);

  // Novel structure
  registry.register(chapterListTool);
  registry.register(chapterReadTool);
  registry.register(chapterWriteTool);
  registry.register(outlineReadTool);
  registry.register(outlineUpdateTool);

  // Project
  registry.register(projectMetaTool);

  // Git
  registry.register(gitStatusTool);
  registry.register(gitCommitTool);
  registry.register(gitLogTool);
  registry.register(gitDiffTool);
}
