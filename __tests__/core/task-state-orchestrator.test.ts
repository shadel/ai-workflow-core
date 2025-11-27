/**
 * Unit tests for TaskStateOrchestrator
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskStateOrchestrator, StateActionHandler, RateLimitingChecker, StateHistoryUpdater, StatePersistenceHandler, StatePrerequisitesValidator } from '../../src/core/task-state-orchestrator.js';
import { TaskValidator } from '../../src/core/task-validator.js';
import { TaskQueueManager } from '../../src/core/task-queue.js';
import { TaskFileSync } from '../../src/core/task-file-sync.js';
import { TaskLoaderService } from '../../src/core/task-loader-service.js';
import { ContextUpdateService } from '../../src/core/context-update-service.js';
import { ContextInjector } from '../../src/core/context-injector.js';
import { RoleSystem } from '../../src/core/role-system.js';
import { RuleManager } from '../../src/utils/rule-manager.js';
import { WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from '../test-helpers.js';
import { jest } from '@jest/globals';

describe('TaskStateOrchestrator', () => {
  let orchestrator: TaskStateOrchestrator;
  let testContextDir: string;
  let taskFile: string;
  let validator: TaskValidator;
  let queueManager: TaskQueueManager;
  let fileSync: TaskFileSync;
  let loaderService: TaskLoaderService;
  let contextService: ContextUpdateService;
  let mockStateActionHandler: StateActionHandler;
  let mockRateLimitingChecker: RateLimitingChecker;
  let mockStateHistoryUpdater: StateHistoryUpdater;
  let mockStatePersistenceHandler: StatePersistenceHandler;
  let mockPrerequisitesValidator: StatePrerequisitesValidator;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    await fs.ensureDir(testContextDir);
    taskFile = path.join(testContextDir, 'current-task.json');
    
    validator = new TaskValidator();
    queueManager = new TaskQueueManager(testContextDir);
    fileSync = new TaskFileSync(testContextDir);
    loaderService = new TaskLoaderService(queueManager, taskFile);
    
    const contextInjector = new ContextInjector(testContextDir);
    const roleSystem = new RoleSystem();
    const ruleManager = new RuleManager();
    contextService = new ContextUpdateService(contextInjector, roleSystem, ruleManager);
    
    // Create mock handlers
    mockStateActionHandler = {
      handleStateSpecificActions: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) as any
    };
    
    mockRateLimitingChecker = {
      checkRateLimiting: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) as any
    };
    
    mockStateHistoryUpdater = {
      updateStateInHistory: jest.fn() as any
    };
    
    mockStatePersistenceHandler = {
      persistStateUpdate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) as any
    };
    
    mockPrerequisitesValidator = {
      validateStatePrerequisites: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) as any
    };
    
    orchestrator = new TaskStateOrchestrator(
      validator,
      queueManager,
      fileSync,
      loaderService,
      contextService,
      taskFile,
      {
        stateActionHandler: mockStateActionHandler,
        rateLimitingChecker: mockRateLimitingChecker,
        stateHistoryUpdater: mockStateHistoryUpdater,
        statePersistenceHandler: mockStatePersistenceHandler,
        prerequisitesValidator: mockPrerequisitesValidator
      }
    );
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  describe('updateState()', () => {
    it('should throw error when no active task exists', async () => {
      await expect(orchestrator.updateState('DESIGNING' as WorkflowState, async () => null)).rejects.toThrow('No active task to update state');
    });

    it('should update state from UNDERSTANDING to DESIGNING', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'UNDERSTANDING' as WorkflowState;
        // Don't add current state to history - that causes corruption validation error
        // History should only contain past states, not current state
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      await orchestrator.updateState('DESIGNING' as WorkflowState, getCurrentTask);

      // Verify handlers were called
      expect(mockStateHistoryUpdater.updateStateInHistory).toHaveBeenCalled();
      expect(mockStatePersistenceHandler.persistStateUpdate).toHaveBeenCalled();
      expect(mockStateActionHandler.handleStateSpecificActions).toHaveBeenCalledWith('DESIGNING');
    });

    it('should throw error when state transition is invalid', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'UNDERSTANDING' as WorkflowState;
        // Don't add current state to history - that causes corruption validation error
        // History should only contain past states, not current state
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      // Try to jump from UNDERSTANDING to IMPLEMENTING (skipping DESIGNING)
      await expect(orchestrator.updateState('IMPLEMENTING' as WorkflowState, getCurrentTask)).rejects.toThrow();
    });

    it('should check rate limiting before state update', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'UNDERSTANDING' as WorkflowState;
        // Don't add current state to history - that causes corruption validation error
        // History should only contain past states, not current state
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      await orchestrator.updateState('DESIGNING' as WorkflowState, getCurrentTask);

      expect(mockRateLimitingChecker.checkRateLimiting).toHaveBeenCalled();
    });

    it('should validate prerequisites before state update', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'UNDERSTANDING' as WorkflowState;
        // Don't add current state to history - that causes corruption validation error
        // History should only contain past states, not current state
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      await orchestrator.updateState('DESIGNING' as WorkflowState, getCurrentTask);

      expect(mockPrerequisitesValidator.validateStatePrerequisites).toHaveBeenCalledWith('DESIGNING');
    });

    it('should update context after state change', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'UNDERSTANDING' as WorkflowState;
        // Don't add current state to history - that causes corruption validation error
        // History should only contain past states, not current state
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      await orchestrator.updateState('DESIGNING' as WorkflowState, getCurrentTask);

      // Verify context files were created
      expect(await fs.pathExists(path.join(testContextDir, 'STATUS.txt'))).toBe(true);
    });

    it('should handle state-specific actions', async () => {
      const task = await queueManager.createTask('Test task orchestrator');
      const taskId = task.id;
      const queue = await (queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        if (!queueTask.workflow) {
          queueTask.workflow = {
            currentState: 'UNDERSTANDING' as WorkflowState,
            stateEnteredAt: new Date().toISOString(),
            stateHistory: []
          };
        }
        queueTask.workflow.currentState = 'REVIEWING' as WorkflowState;
        if (!queueTask.workflow.stateHistory) {
          queueTask.workflow.stateHistory = [];
        }
        // History should only contain past states, not current state (REVIEWING)
        // Current state is REVIEWING, so history should only have states before it
        queueTask.workflow.stateHistory = [
          { state: 'UNDERSTANDING', enteredAt: new Date().toISOString() },
          { state: 'DESIGNING', enteredAt: new Date().toISOString() },
          { state: 'IMPLEMENTING', enteredAt: new Date().toISOString() },
          { state: 'TESTING', enteredAt: new Date().toISOString() }
          // REVIEWING is current state, so it should NOT be in history
        ];
        await (queueManager as any).saveQueue(queue);
        await fileSync.syncFromQueue(queueTask);
        // Wait for file sync
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const getCurrentTask = async () => {
        const activeTask = await queueManager.getActiveTask();
        if (activeTask) {
          return {
            id: activeTask.id,
            goal: activeTask.goal,
            status: activeTask.workflow?.currentState || 'UNDERSTANDING',
            startedAt: activeTask.createdAt,
            roleApprovals: []
          };
        }
        return null;
      };

      await orchestrator.updateState('READY_TO_COMMIT' as WorkflowState, getCurrentTask);

      expect(mockStateActionHandler.handleStateSpecificActions).toHaveBeenCalledWith('READY_TO_COMMIT');
    });
  });
});

