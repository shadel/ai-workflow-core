/**
 * Task State Orchestrator - Orchestrates state update operations
 * 
 * REFACTORED: Extracted from TaskManager.updateTaskState() for Phase 3.
 * Orchestrates the entire state update flow: load → validate → update → persist → actions → context
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Extract orchestration services
 */

import fs from 'fs-extra';
import path from 'path';
import type { WorkflowState } from '@shadel/workflow-core';
import { TaskStateEngine } from './task-state-engine.js';
import { TaskValidator } from './task-validator.js';
import { TaskQueueManager } from './task-queue.js';
import { TaskFileSync } from './task-file-sync.js';
import { TaskLoaderService, TaskLoadResult } from './task-loader-service.js';
import { ContextUpdateService } from './context-update-service.js';

/**
 * State-specific action handler interface
 */
export interface StateActionHandler {
  handleStateSpecificActions(state: WorkflowState): Promise<void>;
}

/**
 * Rate limiting checker interface
 */
export interface RateLimitingChecker {
  checkRateLimiting(fileTaskData: any, taskData: any): Promise<void>;
}

/**
 * State history updater interface
 */
export interface StateHistoryUpdater {
  updateStateInHistory(taskData: any, currentState: WorkflowState, newState: WorkflowState): void;
}

/**
 * State persistence handler interface
 */
export interface StatePersistenceHandler {
  persistStateUpdate(activeQueueTask: any, taskData: any, taskId: string): Promise<void>;
}

/**
 * State prerequisites validator interface
 */
export interface StatePrerequisitesValidator {
  validateStatePrerequisites(state: WorkflowState): Promise<void>;
}

/**
 * Task State Orchestrator
 * 
 * Orchestrates the entire state update flow by coordinating multiple services.
 */
export class TaskStateOrchestrator {
  private validator: TaskValidator;
  private queueManager: TaskQueueManager;
  private fileSync: TaskFileSync;
  private loaderService: TaskLoaderService;
  private contextService: ContextUpdateService;
  private taskFile: string;
  
  // Handlers for operations that remain in TaskManager (for now)
  private stateActionHandler?: StateActionHandler;
  private rateLimitingChecker?: RateLimitingChecker;
  private stateHistoryUpdater?: StateHistoryUpdater;
  private statePersistenceHandler?: StatePersistenceHandler;
  private prerequisitesValidator?: StatePrerequisitesValidator;

  constructor(
    validator: TaskValidator,
    queueManager: TaskQueueManager,
    fileSync: TaskFileSync,
    loaderService: TaskLoaderService,
    contextService: ContextUpdateService,
    taskFile: string,
    options?: {
      stateActionHandler?: StateActionHandler;
      rateLimitingChecker?: RateLimitingChecker;
      stateHistoryUpdater?: StateHistoryUpdater;
      statePersistenceHandler?: StatePersistenceHandler;
      prerequisitesValidator?: StatePrerequisitesValidator;
    }
  ) {
    this.validator = validator;
    this.queueManager = queueManager;
    this.fileSync = fileSync;
    this.loaderService = loaderService;
    this.contextService = contextService;
    this.taskFile = taskFile;
    
    if (options) {
      this.stateActionHandler = options.stateActionHandler;
      this.rateLimitingChecker = options.rateLimitingChecker;
      this.stateHistoryUpdater = options.stateHistoryUpdater;
      this.statePersistenceHandler = options.statePersistenceHandler;
      this.prerequisitesValidator = options.prerequisitesValidator;
    }
  }

  /**
   * Update task state
   * 
   * Orchestrates the entire state update flow:
   * 1. Load task data
   * 2. Validate state transition
   * 3. Check rate limiting
   * 4. Update state in history
   * 5. Persist to queue/file
   * 6. Handle state-specific actions
   * 7. Update context
   * 
   * @param state - New workflow state
   * @param getCurrentTask - Function to get current task (for context update)
   */
  async updateState(
    state: WorkflowState,
    getCurrentTask: () => Promise<any>
  ): Promise<void> {
    // Step 1: Load task data
    const loadResult = await this.loaderService.loadTaskForStateUpdate();
    
    // Step 2: Validate state update
    await this.validateStateUpdate(loadResult, state);
    
    // Step 3: Check rate limiting
    if (this.rateLimitingChecker) {
      await this.rateLimitingChecker.checkRateLimiting(loadResult.fileTaskData, loadResult.taskData);
    } else {
      // Fallback: Basic rate limiting check
      await this.checkRateLimitingFallback(loadResult.fileTaskData, loadResult.taskData);
    }
    
    // Step 4: Update state in history
    if (this.stateHistoryUpdater) {
      this.stateHistoryUpdater.updateStateInHistory(loadResult.taskData, loadResult.currentState, state);
    } else {
      // Fallback: Basic state history update
      this.updateStateInHistoryFallback(loadResult.taskData, loadResult.currentState, state);
    }
    
    // Step 5: Persist state update
    if (this.statePersistenceHandler) {
      await this.statePersistenceHandler.persistStateUpdate(
        loadResult.activeQueueTask,
        loadResult.taskData,
        loadResult.taskId
      );
    } else {
      // Fallback: Basic persistence
      await this.persistStateUpdateFallback(
        loadResult.activeQueueTask,
        loadResult.taskData,
        loadResult.taskId
      );
    }
    
    // Step 6: Handle state-specific actions
    if (this.stateActionHandler) {
      await this.stateActionHandler.handleStateSpecificActions(state);
    }
    
    // Step 7: Update context
    const currentTask = await getCurrentTask();
    await this.contextService.updateAfterStateChange(state, currentTask);
  }

  /**
   * Validate state update operation
   */
  private async validateStateUpdate(
    loadResult: TaskLoadResult,
    newState: WorkflowState
  ): Promise<void> {
    // Validate state history integrity
    if (loadResult.validationData && loadResult.validationData.workflow) {
      try {
        const validationResult = await this.validator.validateStateHistory(loadResult.validationData);
        if (!validationResult.valid) {
          throw new Error(`State history validation failed: ${validationResult.error}`);
        }
      } catch (error) {
        throw error;
      }
    }
    
    // Validate state transition is allowed
    try {
      await this.validator.validateStateTransition(loadResult.currentState, newState);
    } catch (error) {
      throw new Error(
        `${(error as Error).message}\n\n` +
        `Workflow states must progress sequentially:\n` +
        `  UNDERSTANDING → DESIGNING → IMPLEMENTING → \n` +
        `  TESTING → REVIEWING → READY_TO_COMMIT\n\n` +
        `Current state: ${loadResult.currentState}\n` +
        `You tried to jump to: ${newState}\n` +
        `Next valid state: ${TaskStateEngine.getNextState(loadResult.currentState) || 'Already at final state'}`
      );
    }
    
    // Validate prerequisites for target state
    // Note: For REVIEWING state, we want to initialize checklist even if validation fails
    // So we catch errors from validateStatePrerequisites and continue
    if (this.prerequisitesValidator) {
      try {
        await this.prerequisitesValidator.validateStatePrerequisites(newState);
      } catch (error) {
        // If validation fails in REVIEWING state, we still want to initialize checklist
        // This ensures checklist is created even if validation has issues
        if (newState === 'REVIEWING') {
          // Continue to initialize checklist even if prerequisites check fails
          // The checklist initialization will handle its own validation
        } else {
          // For other states, rethrow the error
          throw error;
        }
      }
    }
  }

  /**
   * Fallback rate limiting check
   */
  private async checkRateLimitingFallback(fileTaskData: any, taskData: any): Promise<void> {
    // Reload file data to ensure freshness for rate limiting
    let reloadedFileTaskData = fileTaskData;
    if (await fs.pathExists(this.taskFile)) {
      try {
        reloadedFileTaskData = await fs.readJson(this.taskFile);
      } catch (error) {
        // File exists but can't be read - use existing fileTaskData
      }
    }
    
    // Basic rate limiting check (warn only, don't block)
    if (reloadedFileTaskData && reloadedFileTaskData.workflow) {
      const lastStateChange = reloadedFileTaskData.workflow.stateEnteredAt;
      if (lastStateChange) {
        const timeSinceLastChange = Date.now() - new Date(lastStateChange).getTime();
        const oneMinute = 60 * 1000;
        if (timeSinceLastChange < oneMinute) {
          console.warn(
            `⚠️  Rapid state change detected (${Math.floor(timeSinceLastChange / 1000)} seconds since last change)`
          );
        }
      }
    }
  }

  /**
   * Fallback state history update
   */
  private updateStateInHistoryFallback(
    taskData: any,
    currentState: WorkflowState,
    newState: WorkflowState
  ): void {
    // Record OLD state in history BEFORE updating to new state
    const oldState = currentState;
    const oldStateEnteredAt = taskData.workflow.stateEnteredAt || new Date().toISOString();
    
    // Add OLD state to history (if not already there)
    if (!taskData.workflow.stateHistory) {
      taskData.workflow.stateHistory = [];
    }
    
    const alreadyInHistory = taskData.workflow.stateHistory.some(
      (entry: any) => entry.state === oldState
    );
    
    if (!alreadyInHistory) {
      taskData.workflow.stateHistory.push({
        state: oldState,  // OLD state (step being completed)
        enteredAt: oldStateEnteredAt
      });
    }
    
    // NOW update to new state
    taskData.workflow.currentState = newState;
    taskData.workflow.stateEnteredAt = new Date().toISOString();
  }

  /**
   * Fallback state persistence
   */
  private async persistStateUpdateFallback(
    activeQueueTask: any,
    taskData: any,
    taskId: string
  ): Promise<void> {
    // Update queue system if activeQueueTask exists
    if (activeQueueTask && taskId) {
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        queueTask.workflow = taskData.workflow;
        queueTask.status = 'ACTIVE';
        queue.activeTaskId = taskId;
        await (this.queueManager as any).saveQueue(queue);
        
        // Sync file using TaskFileSync
        await this.fileSync.syncFromQueue(queueTask, {
          preserveFields: ['requirements'],
          backup: true
        });
      }
    } else {
      // Fallback: Update file directly if no queue task (backward compatibility)
      if (!taskData.status) {
        taskData.status = 'in_progress';
      }
      
      // Ensure directory exists before writing
      await fs.ensureDir(path.dirname(this.taskFile));
      
      await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
      await new Promise(resolve => setImmediate(resolve)); // Force flush
    }
  }
}

