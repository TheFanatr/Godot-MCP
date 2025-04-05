import { Resource } from 'fastmcp';
import { getGodotConnection } from '../utils/godot_connection.js';

export const projectLogResource: Resource = {
  uri: 'godot/project/logs',
  name: 'Godot Project Logs',
  mimeType: 'text/plain',
  async load() {
      const godot = getGodotConnection();
      
      try {
          const result = await godot.sendCommand('read_file', {
              identifier: 'user://logs/godot.log'
          });
          
          return {
              text: result.content,
              metadata: {
                  identifier: result.identifier,
                  size: result.file_size
              }
          };
      } catch (error) {
          console.error('Error fetching log file:', error);
          throw error;
      }
  }
};

/**
 * Resource that provides information about the Godot project structure
 */
export const projectStructureResource: Resource = {
  uri: 'godot/project/structure',
  name: 'Godot Project Structure',
  mimeType: 'application/json',
  async load() {
    const godot = getGodotConnection();
    
    try {
      // Call a command on the Godot side to get project structure
      const result = await godot.sendCommand('get_project_structure');
      
      return {
        text: JSON.stringify(result)
      };
    } catch (error) {
      console.error('Error fetching project structure:', error);
      throw error;
    }
  }
};

/**
 * Resource that provides project settings
 */
export const projectSettingsResource: Resource = {
  uri: 'godot/project/settings',
  name: 'Godot Project Settings',
  mimeType: 'application/json',
  async load() {
    const godot = getGodotConnection();
    
    try {
      // Call a command on the Godot side to get project settings
      const result = await godot.sendCommand('get_project_settings');
      
      return {
        text: JSON.stringify(result)
      };
    } catch (error) {
      console.error('Error fetching project settings:', error);
      throw error;
    }
  }
};

/**
 * Resource that provides a list of all project resources
 */
export const projectResourcesResource: Resource = {
  uri: 'godot/project/resources',
  name: 'Godot Project Resources',
  mimeType: 'application/json',
  async load() {
    const godot = getGodotConnection();
    
    try {
      // Call a command on the Godot side to get a list of all resources
      const result = await godot.sendCommand('list_project_resources');
      
      return {
        text: JSON.stringify(result)
      };
    } catch (error) {
      console.error('Error fetching project resources:', error);
      throw error;
    }
  }
};