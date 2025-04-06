import { z } from 'zod';
import { getGodotConnection } from '../utils/godot_connection.js';
import { MCPTool, CommandResult } from '../utils/types.js';

interface ReadFileParams {
  identifier: string;
}

interface WriteFileParams {
  identifier: string;
  content: string;
}

interface ListFilesParams {
  directory?: string;
  extensions?: string[];
  recursive?: boolean;
}

/**
 * Definition for file tools - operations that manipulate files in the Godot project
 */
export const fileTools: MCPTool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the Godot project',
    parameters: z.object({
      identifier: z.string()
        .describe('Path to the file (e.g. "user://logs/godot.log" or "res://scripts/player.gd")'),
    }),
    execute: async ({ identifier }: ReadFileParams): Promise<string> => {
      const godot = getGodotConnection();
      
      try {
        const result = await godot.sendCommand<CommandResult>('read_file', {
          identifier
        });
        
        return `File contents of ${result.identifier} (${result.file_size} bytes):\n\n${result.content}`;
      } catch (error) {
        throw new Error(`Failed to read file: ${(error as Error).message}`);
      }
    },
  },

  {
    name: 'write_file',
    description: 'Write content to a file in the Godot project',
    parameters: z.object({
      identifier: z.string()
        .describe('Path to the file (e.g. "user://config.json" or "res://data/settings.cfg")'),
      content: z.string()
        .describe('Content to write to the file'),
    }),
    execute: async ({ identifier, content }: WriteFileParams): Promise<string> => {
      const godot = getGodotConnection();
      
      try {
        const result = await godot.sendCommand<CommandResult>('write_file', {
          identifier,
          content
        });
        
        return `Successfully wrote to file: ${result.identifier}`;
      } catch (error) {
        throw new Error(`Failed to write file: ${(error as Error).message}`);
      }
    },
  },

  {
    name: 'list_files',
    description: 'List files in a directory with optional extension filtering',
    parameters: z.object({
      directory: z.string()
        .describe('Directory to list files from (e.g. "res://scenes" or "user://logs")')
        .default('res://'),
      extensions: z.array(z.string())
        .describe('File extensions to filter by (e.g. [".tscn", ".gd"])')
        .default([]),
      recursive: z.boolean()
        .describe('Whether to search recursively through subdirectories')
        .default(true),
    }),
    execute: async ({ directory, extensions, recursive }: ListFilesParams): Promise<string> => {
      const godot = getGodotConnection();
      
      try {
        const result = await godot.sendCommand<CommandResult>('list_project_files', {
          directory,
          extensions,
          recursive
        });
        
        if (!result.files || result.files.length === 0) {
          return `No files found in ${directory}${extensions?.length ? ` with extensions: ${extensions.join(', ')}` : ''}`;
        }

        return `Files in ${directory}:\n\n${result.files.join('\n')}`;
      } catch (error) {
        throw new Error(`Failed to list files: ${(error as Error).message}`);
      }
    },
  },
];