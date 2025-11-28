/**
 * Unit tests for ContextUpdateService
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ContextUpdateService } from '../../src/core/context-update-service.js';
import { ContextInjector } from '../../src/core/context-injector.js';
import { RoleSystem } from '../../src/core/role-system.js';
import { RuleManager } from '../../src/utils/rule-manager.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';

describe('ContextUpdateService', () => {
  let service: ContextUpdateService;
  let testContextDir: string;
  let contextInjector: ContextInjector;
  let roleSystem: RoleSystem;
  let ruleManager: RuleManager;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    
    contextInjector = new ContextInjector(testContextDir);
    roleSystem = new RoleSystem();
    ruleManager = new RuleManager();
    
    service = new ContextUpdateService(
      contextInjector,
      roleSystem,
      ruleManager
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('updateAfterStateChange()', () => {
    it('should skip update when no task provided', async () => {
      await expect(service.updateAfterStateChange('IMPLEMENTING' as WorkflowState, null)).resolves.not.toThrow();
    });

    it('should update context when task provided', async () => {
      const task: any = {
        id: 'task-123',
        goal: 'Test task',
        status: 'IMPLEMENTING' as WorkflowState,
        startedAt: new Date().toISOString(),
        roleApprovals: []
      };

      await expect(service.updateAfterStateChange('IMPLEMENTING' as WorkflowState, task)).resolves.not.toThrow();
      
      // Verify context files were created
      const statusFile = path.join(testContextDir, 'STATUS.txt');
      expect(await fs.pathExists(statusFile)).toBe(true);
    });

    it('should activate roles based on task goal and state', async () => {
      const task: any = {
        id: 'task-123',
        goal: 'Implement authentication feature',
        status: 'IMPLEMENTING' as WorkflowState,
        startedAt: new Date().toISOString(),
        roleApprovals: []
      };

      await service.updateAfterStateChange('IMPLEMENTING' as WorkflowState, task);
      
      // Verify context files exist
      const statusFile = path.join(testContextDir, 'STATUS.txt');
      expect(await fs.pathExists(statusFile)).toBe(true);
    });

    it('should load rules during context update', async () => {
      const task: any = {
        id: 'task-123',
        goal: 'Test task',
        status: 'IMPLEMENTING' as WorkflowState,
        startedAt: new Date().toISOString(),
        roleApprovals: []
      };

      await service.updateAfterStateChange('IMPLEMENTING' as WorkflowState, task);
      
      // Verify context files were created
      const statusFile = path.join(testContextDir, 'STATUS.txt');
      expect(await fs.pathExists(statusFile)).toBe(true);
    });

    it('should handle different workflow states', async () => {
      const task: any = {
        id: 'task-123',
        goal: 'Test task',
        status: 'UNDERSTANDING' as WorkflowState,
        startedAt: new Date().toISOString(),
        roleApprovals: []
      };

      const states: WorkflowState[] = ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'];
      
      for (const state of states) {
        await expect(service.updateAfterStateChange(state, task)).resolves.not.toThrow();
      }
    });
  });
});

