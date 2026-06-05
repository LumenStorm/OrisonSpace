import { z } from 'zod';
import { registry } from './registry';
import { remoteToolProxy } from './remote';
import { skillTool } from './skill';
import { spawnAgentTool } from './spawn_agent';

export function registerBuiltinTools() {
  // File operations
  registry.register(remoteToolProxy({
    id: 'read_file',
    description: 'Read the contents of a file within the project directory.',
    parameters: z.object({
      filePath: z.string().describe('Relative path from project root'),
      offset: z.number().int().nonnegative().optional().describe('Line offset (0-indexed)'),
      limit: z.number().int().positive().optional().describe('Max lines to read'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'write_file',
    description: 'Write content to a file within the project directory. Creates directories as needed.',
    parameters: z.object({
      filePath: z.string().describe('Relative path from project root'),
      content: z.string().describe('File content to write'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'list_files',
    description: 'List files and directories in the project.',
    parameters: z.object({
      dirPath: z.string().optional().describe('Relative directory path (default: project root)'),
      recursive: z.boolean().optional().describe('Whether to list recursively'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'search',
    description: 'Search for text content across project files.',
    parameters: z.object({
      query: z.string().describe('Search query (regex supported)'),
      glob: z.string().optional().describe('File pattern filter (e.g. "*.md")'),
      maxResults: z.number().int().positive().optional().describe('Max results (default 50)'),
    }),
  }));

  // Story memory (local read/write via Shell)
  registry.register(remoteToolProxy({
    id: 'memory_query',
    description: 'Query the story memory (story-memory.yaml). Optionally filter by keyword.',
    parameters: z.object({
      query: z.string().optional().describe('Keyword to filter memory entries'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'memory_update',
    description: 'Update the story memory file with new content.',
    parameters: z.object({
      content: z.string().describe('Full YAML content for story-memory.yaml'),
    }),
  }));

  // Skills — local tool that drives the workflow runtime directly
  registry.register(skillTool);

  // Subagents — spawn focused child sessions for specialized tasks
  registry.register(spawnAgentTool);

  // Image generation
  registry.register(remoteToolProxy({
    id: 'generate_image',
    description: 'Generate an image from a text prompt. Saves the result to the project assets directory.',
    parameters: z.object({
      prompt: z.string().describe('Image generation prompt'),
      size: z.string().optional().describe('Image size (e.g. "1024x1024", "1792x1024")'),
      quality: z.string().optional().describe('Quality level: "auto", "low", "medium", "high"'),
      n: z.number().int().positive().optional().describe('Number of images to generate (default 1)'),
      outputDir: z.string().optional().describe('Subdirectory under assets/images/ to save to'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'edit_image',
    description: 'Edit an existing image using a text prompt.',
    parameters: z.object({
      prompt: z.string().describe('Edit instruction'),
      imagePath: z.string().describe('Relative path to the source image'),
      size: z.string().optional().describe('Output size'),
      n: z.number().int().positive().optional().describe('Number of variations'),
      outputDir: z.string().optional().describe('Subdirectory under assets/images/ to save to'),
    }),
  }));

  // Novel structure
  registry.register(remoteToolProxy({
    id: 'chapter_list',
    description: 'List all chapters in the project.',
    parameters: z.object({}),
  }));

  registry.register(remoteToolProxy({
    id: 'chapter_read',
    description: 'Read the content of a specific chapter.',
    parameters: z.object({
      chapterId: z.string().describe('Chapter identifier (filename without .md)'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'chapter_write',
    description: 'Write or update a chapter.',
    parameters: z.object({
      chapterId: z.string().describe('Chapter identifier (filename without .md)'),
      content: z.string().describe('Full chapter content in Markdown'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'rewrite_passage',
    description: 'Rewrite a selected passage of text. Does NOT apply the change directly — produces a diff for user review.',
    parameters: z.object({
      chapterId: z.string().optional().describe('Chapter identifier if the passage is from a chapter'),
      filePath: z.string().optional().describe('File path if the passage is from a file'),
      originalText: z.string().describe('The exact original text to be replaced'),
      replacement: z.string().describe('The new text to replace the original'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'outline_read',
    description: 'Read the project outline.',
    parameters: z.object({}),
  }));

  registry.register(remoteToolProxy({
    id: 'outline_update',
    description: 'Update the project outline.',
    parameters: z.object({
      content: z.string().describe('Full outline content in Markdown'),
    }),
  }));

  // Project
  registry.register(remoteToolProxy({
    id: 'project_meta',
    description: 'Read the project metadata (project.json).',
    parameters: z.object({}),
  }));

  // Git
  registry.register(remoteToolProxy({
    id: 'git_status',
    description: 'Show the working tree status of the project git repository.',
    parameters: z.object({}),
  }));

  registry.register(remoteToolProxy({
    id: 'git_log',
    description: 'Show recent git commit history.',
    parameters: z.object({
      depth: z.number().int().positive().optional().describe('Number of commits to show (default 20)'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'git_commit',
    description: 'Stage all changes and create a git commit.',
    parameters: z.object({
      message: z.string().describe('Commit message'),
      author: z.object({
        name: z.string(),
        email: z.string(),
      }).optional().describe('Commit author (defaults to Orison Agent)'),
    }),
  }));

  registry.register(remoteToolProxy({
    id: 'git_diff',
    description: 'Show changed files in the working tree.',
    parameters: z.object({
      filepath: z.string().optional().describe('Specific file to check (default: all files)'),
    }),
  }));
}
