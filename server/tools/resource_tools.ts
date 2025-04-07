import { z } from 'zod';
import { MCPTool, CommandResult } from '../utils/types.js';

// Array to store the names of registered resources
export const registeredResourceNames: string[] = [];

// Function to add a resource name to the list
export function registerResourceName(name: string) {
  registeredResourceNames.push(name);
}

const listMCPResourcesTool: MCPTool = {
  name: 'list_mcp_resources',
  description: 'Lists all MCP resources available on the server.',
  parameters: z.object({}),
  async execute(): Promise<string> {
    let result: CommandResult;
    try {
      if (registeredResourceNames.length === 0) {
        result = {
          success: true,
          message: 'No MCP resources are currently registered.',
          data: [],
        };
      } else {
        result = {
          success: true,
          message: `Found ${registeredResourceNames.length} registered MCP resources.`,
          data: registeredResourceNames,
        };
      }
    } catch (error) {
      const err = error as Error;
      result = {
        success: false,
        message: `Failed to list MCP resources: ${err.message}`,
      };
    }
    return JSON.stringify(result);
  },
};

// Export the tool so it can be registered in main.ts
export const resourceTools = [listMCPResourcesTool];

