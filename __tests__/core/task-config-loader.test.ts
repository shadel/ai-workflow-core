/**
 * Unit tests for Task Config Loader
 * @requirement DISABLE-AUTO-ACTIVATE
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  loadTaskCompleteConfig,
  getDefaultAutoActivateNext,
  type TaskCompleteConfig
} from '../../src/core/task-config-loader.js';

describe('loadTaskCompleteConfig', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-config-test-'));
    configPath = path.join(testDir, 'config', 'ai-workflow.config.json');
  });

  afterEach(async () => {
    // Cleanup: Remove temporary directory
    await fs.remove(testDir);
  });

  it('should return default (true) when config file does not exist', async () => {
    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: true });
    expect(result.autoActivateNext).toBe(true);
  });

  it('should return default (true) when field is missing', async () => {
    // Create config file without autoActivateNext field
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      version: '1.0.0',
      autoActions: {
        task: {
          complete: {
            autoMarkRequirementDone: false
          }
        }
      }
    });

    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: true });
  });

  it('should return false when config sets autoActivateNext = false', async () => {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      autoActions: {
        task: {
          complete: {
            autoActivateNext: false
          }
        }
      }
    });

    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: false });
  });

  it('should return true when config sets autoActivateNext = true', async () => {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      autoActions: {
        task: {
          complete: {
            autoActivateNext: true
          }
        }
      }
    });

    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: true });
  });

  it('should handle invalid JSON gracefully (default = true)', async () => {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, '{ invalid json }', 'utf-8');

    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: true });
  });

  it('should resolve path correctly with projectRoot parameter', async () => {
    const customRoot = path.join(testDir, 'custom-project');
    const customConfigPath = path.join(customRoot, 'config', 'ai-workflow.config.json');
    
    await fs.ensureDir(path.dirname(customConfigPath));
    await fs.writeJson(customConfigPath, {
      autoActions: {
        task: {
          complete: {
            autoActivateNext: false
          }
        }
      }
    });

    const result = await loadTaskCompleteConfig(customRoot);
    
    expect(result).toEqual({ autoActivateNext: false });
  });

  it('should handle deeply nested config structure', async () => {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      version: '1.0.0',
      assistant: 'cursor',
      autoActions: {
        task: {
          create: {
            autoCreateRequirement: false
          },
          complete: {
            autoMarkRequirementDone: true,
            autoGenerateTrace: false,
            autoExportReport: false,
            autoActivateNext: false
          }
        },
        preCommit: {
          autoValidate: true
        }
      }
    });

    const result = await loadTaskCompleteConfig(testDir);
    
    expect(result).toEqual({ autoActivateNext: false });
  });

  it('should use default when autoActivateNext is explicitly null', async () => {
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, {
      autoActions: {
        task: {
          complete: {
            autoActivateNext: null
          }
        }
      }
    });

    const result = await loadTaskCompleteConfig(testDir);
    
    // null is explicitly set, so should use default
    expect(result).toEqual({ autoActivateNext: true });
  });
});

describe('getDefaultAutoActivateNext', () => {
  it('should return true (default value)', () => {
    const defaultValue = getDefaultAutoActivateNext();
    
    expect(defaultValue).toBe(true);
    expect(typeof defaultValue).toBe('boolean');
  });

  it('should match DEFAULT_AUTO_ACTIVATE_NEXT constant', () => {
    const defaultValue = getDefaultAutoActivateNext();
    
    // Default must be true (backward compatible)
    expect(defaultValue).toBe(true);
  });
});

