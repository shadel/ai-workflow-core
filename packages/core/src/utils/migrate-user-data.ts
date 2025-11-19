/**
 * User Data Migration Utility
 * Migrates user's .ai-context files from v2.x to v3.0 state names
 * @requirement REFACTOR-STATE-NAMES - User data migration
 */

import fs from 'fs-extra';
import path from 'path';
import { normalizeState } from './state-mapper.js';

export interface MigrationResult {
  success: boolean;
  filesUpdated: string[];
  errors: string[];
}

/**
 * Migrate user's .ai-context files to new state names
 * 
 * @param contextDir - Path to .ai-context directory
 * @returns Migration result with updated files and errors
 */
export async function migrateUserData(contextDir = '.ai-context'): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    filesUpdated: [],
    errors: []
  };

  try {
    // Migrate current-task.json
    const taskResult = await migrateTaskFile(contextDir);
    if (taskResult.updated) {
      result.filesUpdated.push('current-task.json');
    }
    if (taskResult.error) {
      result.errors.push(taskResult.error);
      result.success = false;
    }

    // Migrate STATUS.txt (contains state references)
    const statusResult = await migrateStatusFile(contextDir);
    if (statusResult.updated) {
      result.filesUpdated.push('STATUS.txt');
    }
    if (statusResult.error) {
      result.errors.push(statusResult.error);
      result.success = false;
    }

    // Migrate NEXT_STEPS.md (contains state references)
    const nextStepsResult = await migrateNextStepsFile(contextDir);
    if (nextStepsResult.updated) {
      result.filesUpdated.push('NEXT_STEPS.md');
    }
    if (nextStepsResult.error) {
      result.errors.push(nextStepsResult.error);
      result.success = false;
    }

  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
  }

  return result;
}

interface FileResult {
  updated: boolean;
  error?: string;
}

/**
 * Migrate current-task.json file
 */
async function migrateTaskFile(contextDir: string): Promise<FileResult> {
  const taskFile = path.join(contextDir, 'current-task.json');
  
  if (!await fs.pathExists(taskFile)) {
    return { updated: false }; // File doesn't exist, skip
  }

  try {
    const data = await fs.readJson(taskFile);
    let modified = false;

    // Migrate currentState
    if (data.workflow?.currentState) {
      const oldState = data.workflow.currentState;
      const newState = normalizeState(oldState);
      
      if (oldState !== newState) {
        data.workflow.currentState = newState;
        modified = true;
      }
    }

    // Migrate stateHistory array
    if (data.workflow?.stateHistory && Array.isArray(data.workflow.stateHistory)) {
      data.workflow.stateHistory = data.workflow.stateHistory.map((entry: any) => {
        if (entry.state) {
          return {
            ...entry,
            state: normalizeState(entry.state)
          };
        }
        return entry;
      });
      modified = true;
    }

    if (modified) {
      await fs.writeJson(taskFile, data, { spaces: 2 });
      return { updated: true };
    }

    return { updated: false };
    
  } catch (error) {
    return {
      updated: false,
      error: `current-task.json: ${(error as Error).message}`
    };
  }
}

/**
 * Migrate STATUS.txt file (simple text replacement)
 */
async function migrateStatusFile(contextDir: string): Promise<FileResult> {
  const statusFile = path.join(contextDir, 'STATUS.txt');
  
  if (!await fs.pathExists(statusFile)) {
    return { updated: false };
  }

  try {
    let content = await fs.readFile(statusFile, 'utf-8');
    let modified = false;

    // Replace old state names
    const RENAME_MAP: Record<string, string> = {
      'DESIGNING': 'DESIGNING',
      'IMPLEMENTING': 'IMPLEMENTING',
      'TESTING': 'TESTING',
      'REVIEWING': 'REVIEWING',
      'READY_TO_COMMIT': 'READY_TO_COMMIT'
    };

    for (const [oldState, newState] of Object.entries(RENAME_MAP)) {
      if (content.includes(oldState)) {
        content = content.replace(new RegExp(`\\b${oldState}\\b`, 'g'), newState);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(statusFile, content, 'utf-8');
      return { updated: true };
    }

    return { updated: false };
    
  } catch (error) {
    return {
      updated: false,
      error: `STATUS.txt: ${(error as Error).message}`
    };
  }
}

/**
 * Migrate NEXT_STEPS.md file
 */
async function migrateNextStepsFile(contextDir: string): Promise<FileResult> {
  const nextStepsFile = path.join(contextDir, 'NEXT_STEPS.md');
  
  if (!await fs.pathExists(nextStepsFile)) {
    return { updated: false };
  }

  try {
    let content = await fs.readFile(nextStepsFile, 'utf-8');
    let modified = false;

    const RENAME_MAP: Record<string, string> = {
      'DESIGNING': 'DESIGNING',
      'IMPLEMENTING': 'IMPLEMENTING',
      'TESTING': 'TESTING',
      'REVIEWING': 'REVIEWING',
      'READY_TO_COMMIT': 'READY_TO_COMMIT'
    };

    for (const [oldState, newState] of Object.entries(RENAME_MAP)) {
      if (content.includes(oldState)) {
        content = content.replace(new RegExp(`\\b${oldState}\\b`, 'g'), newState);
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(nextStepsFile, content, 'utf-8');
      return { updated: true };
    }

    return { updated: false };
    
  } catch (error) {
    return {
      updated: false,
      error: `NEXT_STEPS.md: ${(error as Error).message}`
    };
  }
}

