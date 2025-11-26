/**
 * Task Manager - Core task management logic
 * @requirement REQ-V2-003
 */

// REFACTORED: Removed WorkflowEngine import - using TaskStateEngine instead
import { normalizeState, type Task, type WorkflowState } from '@shadel/workflow-core';
import fs from 'fs-extra';
import { promises as fsPromises } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';
import { RuleManager } from '../utils/rule-manager.js';
import { TaskQueueManager } from './task-queue.js';
import { TaskMigration } from '../utils/migration.js';
import { TaskFileSync } from './task-file-sync.js';
import { TaskValidator } from './task-validator.js';
import { TaskFileLock } from './task-file-lock.js';
import { TaskStateEngine } from './task-state-engine.js';
import { TaskLoaderService } from './task-loader-service.js';
import { ContextUpdateService } from './context-update-service.js';
import { TaskRetrievalService } from './task-retrieval-service.js';
import { TaskCompletionService } from './task-completion-service.js';
import { TaskCreationService } from './task-creation-service.js';
import { TaskUpdateService } from './task-update-service.js';
import { TaskListService } from './task-list-service.js';
import { ReviewChecklistService } from './review-checklist-service.js';
import { WorkflowAnalysisService } from './workflow-analysis-service.js';
import { StateEnforcementGenerator } from './state-enforcement-generator.js';
import { 
  TaskStateOrchestrator,
  StateActionHandler,
  RateLimitingChecker,
  StateHistoryUpdater,
  StatePersistenceHandler,
  StatePrerequisitesValidator
} from './task-state-orchestrator.js';

export class TaskManager implements StateActionHandler, RateLimitingChecker, StateHistoryUpdater, StatePersistenceHandler, StatePrerequisitesValidator {
  // REFACTORED: Removed WorkflowEngine dependency - using TaskStateEngine instead
  // private engine: WorkflowEngine; // REMOVED - TaskStateEngine replaces this
  private contextDir: string;
  private taskFile: string;
  private contextInjector: ContextInjector;
  
  /**
   * Get context injector (for CLI commands)
   */
  getContextInjector(): ContextInjector {
    return this.contextInjector;
  }
  private roleSystem: RoleSystem;
  private ruleManager: RuleManager;
  private queueManager: TaskQueueManager;
  private migration: TaskMigration;
  private migrationChecked: boolean = false;
  
  // New classes for sync and validation
  private fileSync: TaskFileSync;
  private validator: TaskValidator;
  private fileLock: TaskFileLock;
  
  // REFACTORED: Phase 3 - Extract orchestration services
  private loaderService: TaskLoaderService;
  private contextService: ContextUpdateService;
  private orchestrator: TaskStateOrchestrator;
  
  // REFACTORED: Phase 4 - Extract Task CRUD services
  private retrievalService: TaskRetrievalService;
  private completionService: TaskCompletionService;
  private creationService: TaskCreationService;
  private updateService: TaskUpdateService;
  private listService: TaskListService;
  
  // REFACTORED: Phase 5 - Extract Review Checklist Service
  private reviewChecklistService: ReviewChecklistService;
  
  // REFACTORED: Phase 6 - Extract Workflow Analysis Service
  private workflowAnalysisService: WorkflowAnalysisService;
  
  // REFACTORED: Phase 7 - Extract State Enforcement Generator
  private stateEnforcementGenerator: StateEnforcementGenerator;

  constructor(contextDir = '.ai-context') {
    // REFACTORED: Removed WorkflowEngine instantiation - using TaskStateEngine instead
    // this.engine = new WorkflowEngine(); // REMOVED
    this.contextDir = contextDir;
    this.taskFile = path.join(contextDir, 'current-task.json');
    this.contextInjector = new ContextInjector(contextDir);  // BUG FIX: Pass contextDir
    this.roleSystem = new RoleSystem();
    this.ruleManager = new RuleManager();  // v3.0.3 - Rules integration
    this.queueManager = new TaskQueueManager(contextDir);
    this.migration = new TaskMigration(contextDir);
    
    // Initialize new classes
    this.fileSync = new TaskFileSync(contextDir);
    this.validator = new TaskValidator();
    this.fileLock = new TaskFileLock(contextDir);
    
    // REFACTORED: Phase 3 - Initialize orchestration services
    this.loaderService = new TaskLoaderService(this.queueManager, this.taskFile);
    this.contextService = new ContextUpdateService(
      this.contextInjector,
      this.roleSystem,
      this.ruleManager
    );
    
    // Initialize orchestrator with handlers (TaskManager implements handler interfaces)
    // TaskStateEngine is used via static methods, not as instance
    this.orchestrator = new TaskStateOrchestrator(
      this.validator,
      this.queueManager,
      this.fileSync,
      this.loaderService,
      this.contextService,
      this.taskFile,
      {
        stateActionHandler: this,
        rateLimitingChecker: this,
        stateHistoryUpdater: this,
        statePersistenceHandler: this,
        prerequisitesValidator: this
      }
    );
    
    // REFACTORED: Phase 4 - Initialize Task CRUD services
    this.retrievalService = new TaskRetrievalService(
      this.queueManager,
      this.fileSync,
      this.validator,
      this.migration,
      this.taskFile,
      (queueTask: any, preserveFields: string[]) => this.syncFileFromQueue(queueTask, preserveFields)
    );
    this.completionService = new TaskCompletionService(
      this.queueManager,
      this.fileSync,
      this.contextInjector,
      this.roleSystem,
      this.ruleManager,
      this.migration,
      this.contextDir,
      this.taskFile,
      (queueTask: any, preserveFields: string[]) => this.syncFileFromQueue(queueTask, preserveFields)
    );
    this.creationService = new TaskCreationService(
      this.queueManager,
      this.contextInjector,
      this.roleSystem,
      this.ruleManager,
      this.migration,
      this.contextDir,
      this.taskFile,
      (queueTask: any, preserveFields: string[]) => this.syncFileFromQueue(queueTask, preserveFields)
    );
    this.updateService = new TaskUpdateService(
      this.queueManager,
      this.contextInjector,
      this.ruleManager,
      this.migration,
      this.taskFile,
      () => this.getCurrentTask(),
      (queueTask: any, preserveFields: string[]) => this.syncFileFromQueue(queueTask, preserveFields)
    );
    this.listService = new TaskListService(
      this.queueManager,
      this.migration,
      this.contextDir,
      () => this.getCurrentTask()
    );
    
    // REFACTORED: Phase 5 - Initialize Review Checklist Service
    this.reviewChecklistService = new ReviewChecklistService(
      this.queueManager,
      this.fileSync,
      this.taskFile
    );
    
    // REFACTORED: Phase 6 - Initialize Workflow Analysis Service
    this.workflowAnalysisService = new WorkflowAnalysisService(this.taskFile);
    
    // REFACTORED: Phase 7 - Initialize State Enforcement Generator
    this.stateEnforcementGenerator = new StateEnforcementGenerator();
  }

  /**
   * Check and run migration if needed (only once per instance)
   * Cursor Integration: Ensures Cursor can read from new format after migration
   */
  private async ensureMigration(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    if (await this.migration.needsMigration()) {
      const result = await this.migration.migrate();
      if (!result.success) {
        console.warn(`⚠️ Migration warning: ${result.error}`);
      }
    }
  }

  /**
   * Create a new task
   * 
   * REFACTORED: Phase 4 - Delegates to TaskCreationService
   * 
   * @param goal Task goal/description
   * @param requirements Optional requirement IDs
   * @param force Force activation if task is queued
   * @returns Created task
   */
  async createTask(goal: string, requirements?: string[], force = false): Promise<Task> {
    return this.creationService.createTask(goal, requirements, force);
  }

  /**
   * Get current task
   * @requirement REQ-V2-003 - Task status retrieval
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   */
  /**
   * Get current active task
   * 
   * REFACTORED: Phase 4 - Delegates to TaskRetrievalService
   * 
   * @returns Current task or null if no active task
   */
  async getCurrentTask(): Promise<Task | null> {
    return this.retrievalService.getCurrentTask();
  }

  /**
   * Sync current-task.json from queue (one-way sync)
   * Only syncs if task is ACTIVE
   * Validates sync succeeded
   * Preserves specified fields (requirements, etc.)
   * 
   * NOW PUBLIC: CLI commands need to use this
   * 
   * @param queueTask Task from queue to sync (optional, will get active task if not provided)
   * @param preserveFields Fields to preserve from existing file
   */
  /**
   * Sync file from queue task
   * REFACTORED: Now uses TaskFileSync for centralized, consistent file operations
   * 
   * This method delegates to TaskFileSync.syncFromQueue() which provides:
   * - File locking (prevents race conditions)
   * - Atomic writes (prevents corruption)
   * - Backup/rollback support
   * - Consistency verification
   * - Proper handling of reviewChecklist and all fields
   * 
   * @param queueTask - Task from queue (optional, will fetch active task if not provided)
   * @param preserveFields - Fields to preserve from existing file (default: ['requirements'])
   */
  public async syncFileFromQueue(
    queueTask?: any,
    preserveFields: string[] = ['requirements']
  ): Promise<void> {
    const DEBUG = process.env.DEBUG_TASK_MANAGER === 'true' || process.env.DEBUG_TASK_FILE_SYNC === 'true';
    
    // Get active task if not provided
    if (!queueTask) {
      queueTask = await this.queueManager.getActiveTask();
      if (!queueTask) {
        throw new Error('No active task to sync');
      }
    }
    
    if (DEBUG) {
      console.log('[DEBUG TaskManager.syncFileFromQueue] Starting:', {
        queueTaskId: queueTask.id,
        queueTaskStatus: queueTask.status,
        queueTaskGoal: queueTask.goal,
        preserveFields: preserveFields
      });
    }
    
    // Validation: Only sync if ACTIVE
    if (queueTask.status !== 'ACTIVE') {
      throw new Error(`Cannot sync file for non-active task: ${queueTask.id} (status: ${queueTask.status})`);
    }
    
    // TRACK: Log taskId before sync
    const TRACK = process.env.TRACK_TASK_ID === 'true';
    if (TRACK) {
      console.log('[TRACK TaskManager.syncFileFromQueue] About to sync taskId:', queueTask.id);
    }
    
    // REFACTORED: Use TaskFileSync instead of manual file operations
    // This ensures consistency with other sync operations and proper handling of all fields
    await this.fileSync.syncFromQueue(queueTask, {
      preserveFields: preserveFields,
      backup: true
    });
    
    // TRACK: Log taskId after sync
    if (TRACK) {
      console.log('[TRACK TaskManager.syncFileFromQueue] Sync completed for taskId:', queueTask.id);
    }
    
    if (DEBUG) {
      console.log('[DEBUG TaskManager.syncFileFromQueue] Completed successfully');
    }
  }

  /**
   * Update task state
   * @requirement REQ-V2-002 - State machine integration
   * @requirement REQ-V2-010 - Auto-inject context after state change
   * @requirement BUG-FIX-001 - Validate state transitions
   * @requirement BUG-FIX-009 - Validate state history integrity
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Use orchestrator
   */
  async updateTaskState(state: WorkflowState): Promise<void> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // REFACTORED: Phase 3 - Use orchestrator to coordinate state update
    // Orchestrator handles: load → validate → update → persist → actions → context
    await this.orchestrator.updateState(state, () => this.getCurrentTask());
  }
  
  /**
   * Handle state-specific actions after state is saved
   * 
   * REFACTORED: Extracted from updateTaskState() to reduce complexity.
   * Executes actions specific to certain states (e.g., initialize checklist for REVIEWING).
   * Called AFTER state is persisted to ensure state is saved first.
   * 
   * @param state - New workflow state
   * 
   * @requirement REFACTOR-DECOMPOSE-COMPLEX-FUNCTIONS - Phase 2: Extract helper methods
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Implements StateActionHandler
   */
  async handleStateSpecificActions(state: WorkflowState): Promise<void> {
    // Handle state-specific actions AFTER state is saved
    // This ensures state is persisted before running state-specific actions
    switch (state) {
      case 'REVIEWING':
        // Auto-run validation when entering REVIEWING state
        // This is called AFTER state is updated to ensure state is saved
        try {
          await this.initializeReviewChecklist();
        } catch (error) {
          // If checklist initialization fails, log but don't block state transition
          // State is already saved, so we continue
          console.warn(`⚠️ Warning: Failed to initialize review checklist: ${(error as Error).message}`);
        }
        break;
    }
  }

  /**
   * Persist state update to queue and file
   * 
   * REFACTORED: Extracted from updateTaskState() to reduce complexity.
   * Updates queue system with lock, then syncs file atomically.
   * Falls back to direct file write if no queue task (backward compatibility).
   * 
   * @param activeQueueTask - Active task from queue (may be null)
   * @param taskData - Task data to persist
   * @param taskId - Task ID
   * 
   * @requirement REFACTOR-DECOMPOSE-COMPLEX-FUNCTIONS - Phase 2: Extract helper methods
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Implements StatePersistenceHandler
   */
  async persistStateUpdate(
    activeQueueTask: any,
    taskData: any,
    taskId: string
  ): Promise<void> {
    // DEBUG: Log state update
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] updateTaskState() - Updating to state:', taskData.workflow.currentState, 'taskId:', taskId);
    }
    
    // Fix 6: Update queue system with lock, then sync file atomically
    if (activeQueueTask && taskId) {
      // Update queue (queue operations already use lock internally)
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        queueTask.workflow = taskData.workflow;
        // Ensure task stays ACTIVE
        queueTask.status = 'ACTIVE';
        queue.activeTaskId = taskId;
        
        // DEBUG: Log queue save
        if (process.env.DEBUG_TASK_MANAGER) {
          console.log('[DEBUG] updateTaskState() - Saving queue, taskId:', taskId);
        }
        
        await (this.queueManager as any).saveQueue(queue);
        // saveQueue() already includes setImmediate() for file flush
        
        // DEBUG: Log queue saved
        if (process.env.DEBUG_TASK_MANAGER) {
          console.log('[DEBUG] updateTaskState() - Queue saved');
        }
        
        // Sync file using syncFileFromQueue() (atomic write with validation)
        // This ensures file matches queue exactly
        await this.syncFileFromQueue(queueTask, ['requirements']);
        
        // DEBUG: Log file sync complete
        if (process.env.DEBUG_TASK_MANAGER) {
          console.log('[DEBUG] updateTaskState() - File synced and validated');
        }
      } else {
        // DEBUG: Log queue task not found
        if (process.env.DEBUG_TASK_MANAGER) {
          console.log('[DEBUG] updateTaskState() - Queue task not found for taskId:', taskId);
        }
      }
    } else {
      // Fallback: Update file directly if no queue task (backward compatibility)
      // Ensure taskData has all required fields
      if (!taskData.status) {
        taskData.status = 'in_progress';
      }
      
      // DEBUG: Log file write
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] updateTaskState() - Writing task file (no queue), taskId:', taskData.taskId);
      }
      
      await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
      
      // FIX: Force event loop to process file system flush for task file
      await new Promise(resolve => setImmediate(resolve));
      
      // DEBUG: Log file write complete
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] updateTaskState() - Task file written and flushed');
      }
    }
  }

  /**
   * Update state in history and current state
   * 
   * REFACTORED: Extracted from updateTaskState() to reduce complexity.
   * Records OLD state in history before updating to new state.
   * History tracks completed steps, not current step.
   * 
   * @param taskData - Task data object to update
   * @param currentState - Current workflow state (will be recorded in history)
   * @param newState - New workflow state (will become current state)
   * 
   * @requirement REFACTOR-DECOMPOSE-COMPLEX-FUNCTIONS - Phase 2: Extract helper methods
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Implements StateHistoryUpdater
   * @requirement BUG-FIX-012 - Record OLD state in history
   */
  updateStateInHistory(
    taskData: any,
    currentState: WorkflowState,
    newState: WorkflowState
  ): void {
    // BUG-FIX-012: Record OLD state in history BEFORE updating to new state
    // History should track completed steps, not current step
    const oldState = currentState;
    const oldStateEnteredAt = taskData.workflow.stateEnteredAt || new Date().toISOString();
    
    // Add OLD state to history (if not already there)
    if (!taskData.workflow) {
      taskData.workflow = {
        currentState: 'UNDERSTANDING',
        stateEnteredAt: new Date().toISOString(),
        stateHistory: []
      };
    }
    if (!taskData.workflow.stateHistory) {
      taskData.workflow.stateHistory = [];
    }
    
    const alreadyInHistory = taskData.workflow.stateHistory.some(
      (entry: any) => entry.state === oldState
    );
    
    if (!alreadyInHistory) {
      taskData.workflow.stateHistory.push({
        state: oldState,  // ✅ OLD state (step being completed)
        enteredAt: oldStateEnteredAt
      });
    }
    
    // NOW update to new state
    taskData.workflow.currentState = newState;
    taskData.workflow.stateEnteredAt = new Date().toISOString();
  }

  /**
   * Check rate limiting for state changes
   * 
   * REFACTORED: Extracted from updateTaskState() to reduce complexity.
   * Warns if state changes too rapidly. Reloads file data to ensure freshness
   * for rate limiting check.
   * 
   * @param fileTaskData - File task data (may be null)
   * @param taskData - Task data (fallback if file data unavailable)
   * 
   * @requirement REFACTOR-DECOMPOSE-COMPLEX-FUNCTIONS - Phase 2: Extract helper methods
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Implements RateLimitingChecker
   * @requirement BUG-FIX-010 - Rate limiting on state changes
   */
  async checkRateLimiting(fileTaskData: any, taskData: any): Promise<void> {
    // BUG-FIX-010: Warn if state changes too rapidly
    // File is source of truth for timing (stateEnteredAt timestamp)
    // Reload file data before rate limiting check to ensure freshness
    // Note: File data is loaded by TaskLoaderService, but reload here ensures
    // accuracy for rate limiting check (file may have been updated)
    let reloadedFileTaskData = fileTaskData;
    if (await fs.pathExists(this.taskFile)) {
      try {
        // Reload file data to ensure freshness for rate limiting
        reloadedFileTaskData = await fs.readJson(this.taskFile);
      } catch (error) {
        // File exists but can't be read - use existing fileTaskData
      }
    }
    
    // Rate limiting check: Always prefer file data (source of truth for timing)
    const rapidChangeData = reloadedFileTaskData && reloadedFileTaskData.workflow 
      ? reloadedFileTaskData 
      : (taskData && taskData.workflow ? taskData : null);
    
    if (rapidChangeData) {
      this.checkRapidStateChange(rapidChangeData);
    }
  }

  /**
   * Validate state update operation
   * 
   * REFACTORED: Extracted from updateTaskState() to reduce complexity.
   * Performs all validation checks before allowing state transition:
   * - State history integrity
   * - State transition validity
   * - State prerequisites
   * 
   * @param validationData - Task data for validation (prefer file data to catch corruption)
   * @param currentState - Current workflow state
   * @param newState - Target workflow state
   * @throws Error if validation fails
   * 
   * @requirement REFACTOR-DECOMPOSE-COMPLEX-FUNCTIONS - Phase 2: Extract helper methods
   */
  /**
   * Validate state history integrity
   * 
   * REFACTORED: Phase 8 - Delegates to TaskValidator
   * 
   * @requirement BUG-FIX-009 - Prevent state forgery
   * @requirement BUG-FIX-009-AI - Public API for AI flow correction
   * @public API for reuse across commands and hooks
   */
  public async validateStateHistory(taskData?: any): Promise<void> {
    // Load task data if not provided
    if (!taskData) {
      if (!await fs.pathExists(this.taskFile)) {
        return; // No task, nothing to validate
      }
      taskData = await fs.readJson(this.taskFile);
    }
    
    // Ensure workflow exists
    if (!taskData || !taskData.workflow) {
      return; // No workflow data, nothing to validate
    }
    
    // REFACTORED: Phase 8 - Use TaskValidator for validation
    const validationResult = await this.validator.validateStateHistory(taskData);
    if (!validationResult.valid) {
      throw new Error(`State history validation failed: ${validationResult.error}`);
    }
  }
  
  /**
   * Analyze workflow completeness for AI users
   * 
   * REFACTORED: Phase 6 - Delegates to WorkflowAnalysisService
   * 
   * @returns Workflow completeness analysis result
   */
  public async analyzeWorkflowCompleteness(): Promise<{
    complete: boolean;
    currentState: WorkflowState;
    missingPhases: WorkflowState[];
    instructions?: string;
  }> {
    return this.workflowAnalysisService.analyzeWorkflowCompleteness();
  }
  
  /**
   * Check for rapid state changes (quality indicator)
   * @requirement BUG-FIX-010 - Detect suspiciously fast progression
   * @note For AI users, this is informational only (AI is fast!)
   */
  private checkRapidStateChange(taskData: any): void {
    const lastStateChange = taskData.workflow.stateEnteredAt;
    
    if (!lastStateChange) {
      return; // First state change, no warning
    }
    
    const timeSinceLastChange = Date.now() - new Date(lastStateChange).getTime();
    const fiveMinutes = 5 * 60 * 1000;
    const oneMinute = 60 * 1000;
    
    if (timeSinceLastChange < oneMinute) {
      console.warn(
        `\n⚠️  RAPID STATE CHANGE DETECTED!\n\n` +
        `Time since last state change: ${Math.floor(timeSinceLastChange / 1000)} seconds\n\n` +
        `This is suspiciously fast. Real work typically takes:\n` +
        `  • Design: 10-60 minutes\n` +
        `  • Implementation: 30-240 minutes\n` +
        `  • Testing: 15-60 minutes\n` +
        `  • Review: 10-30 minutes\n\n` +
        `Are you sure the work is complete?\n` +
        `If you're just testing the workflow, this is fine.\n` +
        `But for real work, take your time!\n`
      );
    } else if (timeSinceLastChange < fiveMinutes) {
      console.warn(
        `\n⚠️  State changed recently (${Math.floor(timeSinceLastChange / 60000)} minutes ago)\n` +
        `Make sure the work for the previous state is complete.\n`
      );
    }
  }
  
  /**
   * Validate prerequisites for entering a state
   * @requirement BUG-FIX-001 - Quality gates
   * @requirement REFACTOR-EXTRACT-ORCHESTRATION-SERVICES - Phase 3: Implements StatePrerequisitesValidator
   */
  async validateStatePrerequisites(state: WorkflowState): Promise<void> {
    switch (state) {
      case 'TESTING':
        // Check if tests exist (basic check)
        const hasTests = await fs.pathExists('__tests__') || 
                        await fs.pathExists('test') ||
                        await fs.pathExists('tests');
        if (!hasTests) {
          console.warn('⚠️  Warning: No test directory found. Consider adding tests.');
        }
        break;
        
      case 'REVIEWING':
        // Verify we're coming from TESTING state (tests should be passing)
        // Check that tests exist and have been run
        const testDirs = ['__tests__', 'test', 'tests'];
        let hasTestDir = false;
        for (const dir of testDirs) {
          if (await fs.pathExists(dir)) {
            hasTestDir = true;
            break;
          }
        }
        if (!hasTestDir) {
          console.warn('⚠️  Warning: No test directory found. Review may be incomplete without tests.');
        }
        
        // Verify previous states were completed
        // This ensures proper workflow progression
        const currentTask = await this.getCurrentTask();
        if (currentTask) {
          // Check state history to ensure proper progression
          // Use this.taskFile directly (already set in constructor)
          const taskFile = this.taskFile;
          
          if (await fs.pathExists(taskFile)) {
            try {
              const taskData = await fs.readJson(taskFile);
              const stateHistory = taskData.workflow?.stateHistory || [];
              const requiredStates = ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING'];
              const completedStates = stateHistory.map((entry: any) => entry.state);
              
              // Check if all required states were completed
              const missingStates = requiredStates.filter(state => !completedStates.includes(state));
              if (missingStates.length > 0) {
                console.warn(`⚠️  Warning: Missing state history entries: ${missingStates.join(', ')}`);
              }
            } catch (error) {
              // File read failed, continue
            }
          }
        }
        break;
        
      case 'READY_TO_COMMIT':
        // Check if review checklist is complete
        await this.validateReviewChecklistComplete();
        // Should have completed all previous states
        // Validation will be done by validator
        break;
    }
  }

  /**
   * Initialize review checklist when entering REVIEWING state
   * 
   * REFACTORED: Phase 5 - Delegates to ReviewChecklistService
   */
  private async initializeReviewChecklist(): Promise<void> {
    return this.reviewChecklistService.initializeReviewChecklist();
  }

  /**
   * Validate that review checklist is complete before allowing READY_TO_COMMIT
   * 
   * REFACTORED: Phase 5 - Delegates to ReviewChecklistService
   */
  private async validateReviewChecklistComplete(): Promise<void> {
    return this.reviewChecklistService.validateReviewChecklistComplete();
  }

  /**
   * Save review checklist to task
   * 
   * REFACTORED: Phase 5 - Delegates to ReviewChecklistService
   */
  private async saveReviewChecklist(checklist: any): Promise<void> {
    return this.reviewChecklistService.saveReviewChecklist(checklist);
  }

  /**
   * Load review checklist from task
   * 
   * REFACTORED: Phase 5 - Delegates to ReviewChecklistService
   */
  private async loadReviewChecklist(): Promise<any | null> {
    return this.reviewChecklistService.loadReviewChecklist();
  }

  /**
   * Complete task
   * @requirement REQ-V2-003 - Task lifecycle completion
   * @requirement REQ-V2-010 - Auto-inject context after completion
   * @requirement BUG-FIX-003 - Require READY_TO_COMMIT state
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   */
  /**
   * Complete the current active task
   * 
   * REFACTORED: Phase 4 - Delegates to TaskCompletionService
   * 
   * @returns Completion result with alreadyCompleted flag
   */
  async completeTask(): Promise<{ alreadyCompleted: boolean }> {
    return this.completionService.completeTask();
  }

  /**
   * Get workflow progress
   * 
   * REFACTORED: Now uses TaskStateEngine.getProgress() instead of WorkflowEngine.
   * Gets current state from active task and calculates progress.
   * 
   * Note: Changed from sync to async to load current task state.
   */
  async getProgress(): Promise<number> {
    const currentTask = await this.getCurrentTask();
    if (!currentTask || !currentTask.status) {
      return 0; // No task or no state - return 0%
    }
    
    // REFACTORED: Use TaskStateEngine for progress calculation
    return TaskStateEngine.getProgress(currentTask.status);
  }

  /**
   * List tasks (current + history)
   * 
   * REFACTORED: Phase 4 - Delegates to TaskListService
   * 
   * @param statusFilter Optional workflow state filter
   * @param limit Maximum number of tasks to return (default: 10)
   * @returns Array of tasks
   */
  async listTasks(statusFilter?: string, limit = 10): Promise<Task[]> {
    return this.listService.listTasks(statusFilter, limit);
  }

  /**
   * Update task details
   * 
   * REFACTORED: Phase 4 - Delegates to TaskUpdateService
   * 
   * @param taskId Task ID to update
   * @param updates Update options (goal, addReq)
   */
  async updateTask(
    taskId: string,
    updates: {
      goal?: string;
      addReq?: string;
    }
  ): Promise<void> {
    return this.updateService.updateTask(taskId, updates);
  }

  /**
   * Generate state enforcement .mdc file
   * 
   * REFACTORED: Phase 7 - Delegates to StateEnforcementGenerator
   * 
   * @param state Current workflow state
   */
  private async generateStateEnforcementMDC(state: WorkflowState): Promise<void> {
    const currentTask = await this.getCurrentTask();
    const taskId = currentTask?.id || 'none';
    const taskGoal = currentTask?.goal || 'No current task (check status - may be completed)';
    
    await this.stateEnforcementGenerator.generateStateEnforcementMDC(state, taskId, taskGoal);
  }
}


