/**
 * Task Manager - Core task management logic
 * @requirement REQ-V2-003
 */

import { WorkflowEngine, Task, WorkflowState, normalizeState } from '@shadel/workflow-core';
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

export class TaskManager {
  private engine: WorkflowEngine;
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

  constructor(contextDir = '.ai-context') {
    this.engine = new WorkflowEngine();
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
   * @requirement REQ-V2-003 - Task management CRUD operations
   * @requirement REQ-V2-010 - Auto-inject context after command
   * @requirement BUG-FIX-004 - Prevent overwriting existing task
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   */
  async createTask(goal: string, requirements?: string[], force = false): Promise<Task> {
    const DEBUG = process.env.DEBUG_TASK_MANAGER === 'true';
    
    if (DEBUG) console.log('[DEBUG createTask] Starting, goal:', goal, 'contextDir:', this.contextDir);
    
    await fs.ensureDir(this.contextDir);
    
    // Check and run migration if needed
    await this.ensureMigration();
    
    // BUG-FIX-007: Validate goal quality
    if (!goal || goal.trim().length < 10) {
      throw new Error(
        `Task goal must be at least 10 characters and descriptive.\n\n` +
        `Received: "${goal}"\n` +
        `Length: ${goal?.length || 0} characters\n\n` +
        `Example: "Implement user authentication with JWT"\n` +
        `Bad: "fix bug" (too vague)\n` +
        `Bad: "a" (too short)`
      );
    }
    
    // Allow auto-queue: TaskQueueManager will handle queuing if active task exists
    // Use TaskQueueManager to create task (auto-queues if active task exists)
    if (DEBUG) console.log('[DEBUG createTask] Calling queueManager.createTask...');
    let queueTask;
    try {
      queueTask = await this.queueManager.createTask(goal);
      if (DEBUG) console.log('[DEBUG createTask] queueTask received:', queueTask ? `id=${queueTask.id}, status=${queueTask.status}` : 'UNDEFINED');
    } catch (error) {
      if (DEBUG) console.log('[DEBUG createTask] queueManager.createTask failed:', (error as Error).message);
      throw error;
    }
    
    if (!queueTask) {
      const errorMsg = `queueManager.createTask returned undefined. Goal: "${goal}", contextDir: "${this.contextDir}"`;
      if (DEBUG) console.log('[DEBUG createTask] ERROR:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // If force=true, switch to new task immediately
    if (force && queueTask.status !== 'ACTIVE') {
      // activateTask will deactivate old active task and preserve its state
      const activatedTask = await this.queueManager.activateTask(queueTask.id);
      // Use the activated task
      Object.assign(queueTask, activatedTask);
    }
    
    // Convert queue task to WorkflowEngine Task format for compatibility
    const task: Task = {
      id: queueTask.id,
      goal: queueTask.goal,
      status: queueTask.workflow?.currentState || 'UNDERSTANDING',
      startedAt: queueTask.createdAt,
      roleApprovals: []
    };
    
    if (DEBUG) console.log('[DEBUG createTask] Created task object:', `id=${task.id}, status=${task.status}`);
    
    // Fix 1: Only sync file if task is ACTIVE
    // If QUEUED, don't sync - file will be synced when activated
    if (queueTask.status === 'ACTIVE') {
      if (DEBUG) console.log('[DEBUG createTask] Task is ACTIVE, syncing file...');
      
      // REFACTORED: Update queue task with requirements first, then sync
      // Always set requirements in queue (even if empty array) for consistency
      const queue = await (this.queueManager as any).loadQueue();
      const queueTaskInQueue = queue.tasks.find((t: any) => t.id === queueTask.id);
      if (queueTaskInQueue) {
        (queueTaskInQueue as any).requirements = requirements || [];
        await (this.queueManager as any).saveQueue(queue);
        // Update local reference - IMPORTANT: Update queueTask object that will be synced
        (queueTask as any).requirements = requirements || [];
      } else {
        // If not found in queue, still set on queueTask for sync
        (queueTask as any).requirements = requirements || [];
      }
      
      // REFACTORED: Use TaskFileSync to sync (removed redundant write)
      // Don't preserve requirements - always sync from queue
      await this.syncFileFromQueue(queueTask, []);
      
      if (DEBUG) console.log('[DEBUG createTask] File synced successfully');
    } else {
      if (DEBUG) console.log('[DEBUG createTask] Task is QUEUED, skipping file sync');
    }
    
    if (DEBUG) console.log('[DEBUG createTask] Task file written, verifying...');
    const fileExists = await fs.pathExists(this.taskFile);
    if (DEBUG) console.log('[DEBUG createTask] Task file exists:', fileExists);
    
    // Activate roles based on task context
    const activeRoles = this.roleSystem.getActiveRoles({
      taskGoal: goal,
      linkedRequirements: requirements?.map(id => ({ id }))
    });
    
    // Load local rules (v3.0.3)
    const localRules = await this.ruleManager.getRules();
    
    // Auto-inject context for AI
    // Cursor Integration: Updates STATUS.txt and NEXT_STEPS.md that Cursor reads
    if (DEBUG) console.log('[DEBUG createTask] Updating context...');
    try {
      await this.contextInjector.updateAfterCommand('task.create', {
        task,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules  // v3.0.3 - Include project rules
      });
      if (DEBUG) console.log('[DEBUG createTask] Context updated successfully');
    } catch (error) {
      if (DEBUG) console.log('[DEBUG createTask] Context update failed (non-fatal):', (error as Error).message);
      // Don't throw - context update failure shouldn't prevent task creation
    }
    
    if (DEBUG) console.log('[DEBUG createTask] Returning task:', `id=${task.id}`);
    return task;
  }

  /**
   * Get current task
   * @requirement REQ-V2-003 - Task status retrieval
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   */
  async getCurrentTask(): Promise<Task | null> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // DEBUG: Log getCurrentTask call
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getCurrentTask() called');
    }
    
    // Try to get active task from queue system first
    let activeQueueTask = await this.queueManager.getActiveTask();
    
    // DEBUG: Log queue task result
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] getCurrentTask() - activeQueueTask:', activeQueueTask ? `Found: ${activeQueueTask.id}` : 'null');
    }
    
    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    // This ensures we don't fail when queue write hasn't completed yet
    if (!activeQueueTask && await fs.pathExists(this.taskFile)) {
      // DEBUG: Log retry attempt
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Retrying queue read, file exists');
      }
      
      // Use setImmediate instead of setTimeout for faster retry
      await new Promise(resolve => setImmediate(resolve));
      activeQueueTask = await this.queueManager.getActiveTask();
      
      // DEBUG: Log retry result
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - After retry, activeQueueTask:', activeQueueTask ? `Found: ${activeQueueTask.id}` : 'null');
      }
      
      // FIX: If queue still doesn't have task but file does, try to reload from file
      // This handles cases where file was manually updated (tests, etc.)
      if (!activeQueueTask) {
        try {
          const fileTaskData = await fs.readJson(this.taskFile);
          if (fileTaskData.taskId && fileTaskData.status !== 'completed') {
            // DEBUG: Log file task data found
            if (process.env.DEBUG_TASK_MANAGER) {
              console.log('[DEBUG] getCurrentTask() - File task found, taskId:', fileTaskData.taskId);
            }
            
            // Try to get task from queue by ID
            const queue = await (this.queueManager as any).loadQueue();
            activeQueueTask = queue.tasks.find((t: any) => t.id === fileTaskData.taskId);
            
            // DEBUG: Log queue lookup result
            if (process.env.DEBUG_TASK_MANAGER) {
              console.log('[DEBUG] getCurrentTask() - Queue lookup, found:', activeQueueTask ? 'yes' : 'no');
            }
            
            // SECURITY FIX: Don't fix queue from file (P0 security issue)
            // If queue and file are out of sync, validate file data first
            if (activeQueueTask && queue.activeTaskId !== fileTaskData.taskId) {
              // Validate file data before trusting it
              try {
                const validation = await this.validator.validateStateHistory(fileTaskData);
                if (!validation.valid) {
                  // File data is invalid, don't trust it
                  console.warn(`⚠️  File data validation failed: ${validation.error}. Not fixing queue from file.`);
                  activeQueueTask = null; // Don't use corrupted file data
                } else {
                  // File data is valid, but still don't auto-fix queue (security risk)
                  // Let user manually fix or sync from queue
                  console.warn(`⚠️  Queue and file out of sync. Use 'npx ai-workflow sync' to fix.`);
                }
              } catch (error) {
                // Validation failed, don't trust file
                console.warn(`⚠️  File validation error: ${(error as Error).message}. Not fixing queue from file.`);
                activeQueueTask = null;
              }
            } else if (!activeQueueTask) {
              // DEBUG: Log task not in queue
              if (process.env.DEBUG_TASK_MANAGER) {
                console.log('[DEBUG] getCurrentTask() - Task not found in queue, will fallback to file');
              }
            }
          }
        } catch (error) {
          // DEBUG: Log file read error
          if (process.env.DEBUG_TASK_MANAGER) {
            console.log('[DEBUG] getCurrentTask() - File read failed:', (error as Error).message);
          }
          // File read failed, continue with null
        }
      }
    }
    
    if (activeQueueTask) {
      const DEBUG = process.env.DEBUG_TASK_MANAGER === 'true' || process.env.DEBUG_TASK_FILE_SYNC === 'true';
      
      if (DEBUG) {
        console.log('[DEBUG TaskManager.getCurrentTask] Active queue task:', {
          id: activeQueueTask.id,
          goal: activeQueueTask.goal,
          status: activeQueueTask.status
        });
      }
      
      // REFACTORED: Use content-based detection instead of timestamp
      if (await fs.pathExists(this.taskFile)) {
        try {
          // Read file first to check taskId match
          const fileData = await fs.readJson(this.taskFile);
          
          // TRACK: Log taskId comparison
          const TRACK = process.env.TRACK_TASK_ID === 'true';
          if (TRACK) {
            console.log('[TRACK TaskManager.getCurrentTask] Comparing taskIds - File:', fileData.taskId, 'Queue:', activeQueueTask.id);
          }
          
          // CRITICAL FIX: Only sync if file taskId doesn't match queue taskId
          // If they match, file is already correct (no need to sync)
          if (fileData.taskId !== activeQueueTask.id) {
            if (TRACK) {
              console.log('[TRACK TaskManager.getCurrentTask] ⚠️ File taskId MISMATCH! File:', fileData.taskId, 'Queue:', activeQueueTask.id, '- Will sync from queue');
            }
            if (DEBUG) {
              console.log('[DEBUG TaskManager.getCurrentTask] File taskId mismatch, syncing from queue:', {
                fileTaskId: fileData.taskId,
                queueTaskId: activeQueueTask.id
              });
            }
            // File has different task - sync from queue
            await this.fileSync.backupFile();
            await this.syncFileFromQueue(activeQueueTask, ['requirements']);
            
            if (TRACK) {
              // Verify after sync
              const fileDataAfterSync = await fs.readJson(this.taskFile);
              console.log('[TRACK TaskManager.getCurrentTask] File taskId AFTER sync:', fileDataAfterSync.taskId, 'Expected:', activeQueueTask.id);
            }
          } else {
            if (TRACK) {
              console.log('[TRACK TaskManager.getCurrentTask] ✓ File taskId matches queue, no sync needed');
            }
            // File taskId matches queue - check for manual edit (content changes)
            const manualEditDetected = await this.fileSync.detectManualEdit(activeQueueTask);
            
            if (manualEditDetected) {
              if (DEBUG) {
                console.log('[DEBUG TaskManager.getCurrentTask] Manual edit detected (same taskId), syncing from queue');
              }
              console.warn('⚠️  Warning: current-task.json was manually edited. Syncing from queue...');
              // Backup before sync
              await this.fileSync.backupFile();
              await this.syncFileFromQueue(activeQueueTask, ['requirements']);
            } else {
              // File matches queue - validate consistency
              const validation = await this.validator.validateBoth(activeQueueTask, fileData);
              
              if (!validation.valid) {
                if (DEBUG) {
                  console.log('[DEBUG TaskManager.getCurrentTask] Validation failed, syncing from queue:', {
                    queueTaskId: activeQueueTask.id,
                    fileTaskId: fileData.taskId,
                    error: validation.error
                  });
                }
                console.error(`❌ Validation failed: ${validation.error}`);
                // Auto-fix: sync from queue
                await this.fileSync.backupFile();
                await this.syncFileFromQueue(activeQueueTask, ['requirements']);
              }
            }
          }
        } catch (error) {
          // If file read fails, continue with queue task (non-fatal)
          if (DEBUG) {
            console.log('[DEBUG] getCurrentTask() - File read failed during manual edit check:', (error as Error).message);
          }
        }
      } else {
        // File doesn't exist but queue has task - sync file
        if (DEBUG) {
          console.log('[DEBUG TaskManager.getCurrentTask] File doesn\'t exist, syncing from queue');
        }
        await this.syncFileFromQueue(activeQueueTask, ['requirements']);
      }
      
      // DEBUG: Log returning queue task
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Returning queue task:', activeQueueTask.id, 'state:', activeQueueTask.workflow?.currentState);
      }
      
      return {
        id: activeQueueTask.id,
        goal: activeQueueTask.goal,
        status: activeQueueTask.workflow?.currentState || 'UNDERSTANDING',
        startedAt: activeQueueTask.createdAt,
        completedAt: activeQueueTask.completedAt,
        roleApprovals: []
      };
    }
    
    // Fallback to old format for backward compatibility
    if (!await fs.pathExists(this.taskFile)) {
      // DEBUG: Log no file
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - No task file, returning null');
      }
      return null;
    }

    try {
      const taskData = await fs.readJson(this.taskFile);
      
      // DEBUG: Log file task
      if (process.env.DEBUG_TASK_MANAGER) {
        console.log('[DEBUG] getCurrentTask() - Returning file task:', taskData.taskId, 'state:', taskData.workflow?.currentState);
      }
      
      // BUG-FIX-011: Don't return completed tasks as "current"
      // A completed task should not be considered active
      if (taskData.status === 'completed') {
        return null;
      }
      
      return {
        id: taskData.taskId,
        goal: taskData.originalGoal,
        status: taskData.workflow?.currentState || 'UNDERSTANDING',
        startedAt: taskData.startedAt,
        completedAt: taskData.completedAt,
        roleApprovals: []
      };
    } catch (error) {
      throw new Error(`Failed to load task: ${error}`);
    }
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
   */
  async updateTaskState(state: WorkflowState): Promise<void> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Try to get active task from queue first
    let activeQueueTask = await this.queueManager.getActiveTask();

    // CRITICAL: For history validation, always check the actual file if it exists
    // This ensures we catch manual file corruption (tests, manual edits, etc.)
    let fileTaskData: any = null;
    if (await fs.pathExists(this.taskFile)) {
      try {
        fileTaskData = await fs.readJson(this.taskFile);
      } catch (error) {
        // File exists but can't be read - will use queue data
      }
    }

    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    // This ensures we don't fail when queue write hasn't completed yet
    // Also handle case where file was manually updated (tests, etc.)
    if (!activeQueueTask && fileTaskData) {
      // Small delay to allow queue write to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      activeQueueTask = await this.queueManager.getActiveTask();
      
      // FIX: If queue still doesn't have task but file does, try to reload from file
      // This handles cases where file was manually updated (tests, etc.)
      if (!activeQueueTask && fileTaskData.taskId) {
        // Try to get task from queue by ID
        const queue = await (this.queueManager as any).loadQueue();
        activeQueueTask = queue.tasks.find((t: any) => t.id === fileTaskData.taskId);
        
        // If found, ensure it's set as active
        if (activeQueueTask && queue.activeTaskId !== fileTaskData.taskId) {
          queue.activeTaskId = fileTaskData.taskId;
          activeQueueTask.status = 'ACTIVE';
          await (this.queueManager as any).saveQueue(queue);
        }
      }
    }
    
    // CRITICAL: For validation, ALWAYS prefer file data to catch manual corruption
    // File data is the source of truth for validation (may be manually corrupted)
    // Queue data is used for operations, but file data is used for validation
    let validationData: any = null;
    let currentState: WorkflowState = 'UNDERSTANDING'; // Default, will be set from file or queue
    let taskId: string | null = null;
    let taskData: any;
    
    // ALWAYS use file data for validation if it exists (may be corrupted)
    // This is critical to catch manual file edits BEFORE they cause issues
    if (fileTaskData && fileTaskData.workflow) {
      // File exists and has workflow - use it for validation (may be corrupted)
      validationData = fileTaskData;
      currentState = normalizeState(fileTaskData.workflow.currentState) || 'UNDERSTANDING';
      taskId = fileTaskData.taskId;
    }
    
    // FIX: Try queue first (preferred), then file (fallback), then error
    if (activeQueueTask) {
      // Use queue system for operations (preferred)
      taskId = activeQueueTask.id;
      
      // FIX: Preserve existing fields from file (requirements, startedAt, etc.)
      // Start with file data if available, then merge queue data
      const existingTaskData = fileTaskData || {};
      taskData = {
        ...existingTaskData, // Preserve all existing fields
        taskId: activeQueueTask.id,
        originalGoal: activeQueueTask.goal,
        workflow: activeQueueTask.workflow || existingTaskData.workflow || {
          currentState: 'UNDERSTANDING',
          stateEnteredAt: new Date().toISOString(),
          stateHistory: []
        }
      };
      
      // If we don't have file data for validation, use queue data
      if (!validationData) {
        validationData = taskData;
        currentState = normalizeState(taskData.workflow.currentState) || 'UNDERSTANDING';
      }
    } else if (fileTaskData) {
      // Fallback to file format (backward compatibility)
      taskData = fileTaskData;
      taskId = taskData.taskId;
      
      // Use file data for validation
      if (!validationData) {
        validationData = fileTaskData;
        currentState = normalizeState(fileTaskData.workflow?.currentState) || 'UNDERSTANDING';
      }
    } else {
      // Both queue and file are missing - cannot proceed
      throw new Error('No active task to update state');
    }
    
    // BUG-FIX-009: Validate state history integrity BEFORE accepting update
    // Always use file data if available to catch manual edits/corruption
    // This MUST run before isValidTransition to catch corruption first
    // CRITICAL: validationData should have file data if file exists (may be corrupted)
    if (validationData && validationData.workflow) {
      try {
        // REFACTORED: Use TaskValidator to validate
        const validationResult = await this.validator.validateStateHistory(validationData);
        if (!validationResult.valid) {
          throw new Error(`State history validation failed: ${validationResult.error}`);
        }
      } catch (error) {
        // Re-throw validation errors (they contain "STATE HISTORY CORRUPTION")
        throw error;
      }
    }
    
    // CRITICAL: Validate state transition is allowed
    // REFACTORED: Use TaskValidator to validate state transition
    try {
      await this.validator.validateStateTransition(currentState, state);
    } catch (error) {
      // Re-throw with additional context
      throw new Error(
        `${(error as Error).message}\n\n` +
        `Workflow states must progress sequentially:\n` +
        `  UNDERSTANDING → DESIGNING → IMPLEMENTING → \n` +
        `  TESTING → REVIEWING → READY_TO_COMMIT\n\n` +
        `Current state: ${currentState}\n` +
        `You tried to jump to: ${state}\n` +
        `Next valid state: ${this.getNextState(currentState)}`
      );
    }
    
    // Validate prerequisites for target state
    // Note: For REVIEWING state, we want to initialize checklist even if validation fails
    // So we catch errors from validateStatePrerequisites and continue
    try {
      await this.validateStatePrerequisites(state);
    } catch (error) {
      // If validation fails in REVIEWING state, we still want to initialize checklist
      // This ensures checklist is created even if validation has issues
      if (state === 'REVIEWING') {
        // Continue to initialize checklist even if prerequisites check fails
        // The checklist initialization will handle its own validation
      } else {
        // For other states, rethrow the error
        throw error;
      }
    }
    
    // BUG-FIX-010: Warn if state changes too rapidly
    // File is source of truth for timing (stateEnteredAt timestamp)
    // Reload file data before rate limiting check to ensure freshness
    // Note: File already loaded at line 537, but reload here ensures
    // accuracy for rate limiting check (file may have been updated)
    if (await fs.pathExists(this.taskFile)) {
      try {
        // Reload file data to ensure freshness for rate limiting
        fileTaskData = await fs.readJson(this.taskFile);
      } catch (error) {
        // File exists but can't be read - use existing fileTaskData
      }
    }
    
    // Rate limiting check: Always prefer file data (source of truth for timing)
    const rapidChangeData = fileTaskData && fileTaskData.workflow 
      ? fileTaskData 
      : (taskData && taskData.workflow ? taskData : null);
    
    if (rapidChangeData) {
      this.checkRapidStateChange(rapidChangeData);
    }
    
    // BUG-FIX-012: Record OLD state in history BEFORE updating to new state
    // History should track completed steps, not current step
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
        state: oldState,  // ✅ OLD state (step being completed)
        enteredAt: oldStateEnteredAt
      });
    }
    
    // NOW update to new state
    taskData.workflow.currentState = state;
    taskData.workflow.stateEnteredAt = new Date().toISOString();

    // DEBUG: Log state update
    if (process.env.DEBUG_TASK_MANAGER) {
      console.log('[DEBUG] updateTaskState() - Updating to state:', state, 'taskId:', taskId);
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
    
    // Try to transition engine state (not critical, state already saved in file)
    try {
      await this.engine.transitionTo(state);
    } catch (error) {
      // Engine transition failed, but state is already saved in file, so continue
      console.warn(`⚠️ Engine transition warning: ${(error as Error).message}`);
    }
    
    // USER-INSIGHT-11: Auto-generate state enforcement .mdc file
    // DISABLED: Now using static hybrid file (v2.1.0-hybrid)
    // The file .cursor/rules/000-current-state-enforcement.mdc is now static
    // and contains instructions + quick reference for all states
    // try {
    //   await this.generateStateEnforcementMDC(state);
    // } catch (error) {
    //   console.warn(`⚠️ Failed to generate state enforcement file: ${(error as Error).message}`);
    //   // Don't fail the whole command if file generation fails
    // }
    
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
    
    // Auto-inject context for AI
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      // BUG-FIX-ROLES-3: Re-activate roles during sync to ensure checklists are shown
      const activeRoles = this.roleSystem.getActiveRoles({
        taskGoal: currentTask.goal,
        workflowState: state
      });
      
      // Load local rules (v3.0.3)
      const localRules = await this.ruleManager.getRules();
      
      await this.contextInjector.updateAfterCommand('sync', {
        task: currentTask,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules  // v3.0.3 - Include project rules
      });
    }
  }
  
  /**
   * Check if state transition is valid
   * @requirement BUG-FIX-001 - Sequential state progression
   */
  private isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const fromIndex = sequence.indexOf(from);
    const toIndex = sequence.indexOf(to);
    
    // BUG-FIX-001: Only allow forward progression by 1 step
    // States must progress sequentially - no backward movement, no staying at same state
    return toIndex === fromIndex + 1;
  }
  
  /**
   * Get next valid state
   * @requirement BUG-FIX-001 - State progression guidance
   */
  private getNextState(current: WorkflowState): WorkflowState | string {
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const index = sequence.indexOf(current);
    return sequence[index + 1] || 'Already at final state';
  }
  
  /**
   * Validate state history integrity
   * Detects manual file edits that forge invalid state progressions
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
    if (!taskData.workflow) {
      return; // No workflow data, nothing to validate
    }
    
    const { currentState, stateHistory } = taskData.workflow;
    
    if (!stateHistory || stateHistory.length === 0) {
      // Empty history is valid for new tasks
      return;
    }
    
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    // Extract states from history
    const historyStates = stateHistory.map((entry: any) => entry.state);
    
    // BUG-FIX-012-VALIDATION: Check current state in history FIRST (most critical check)
    // Current state should NEVER be in history (it's current, not completed)
    if (historyStates.length > 0 && historyStates.includes(currentState)) {
      throw new Error(
        `🚨 STATE HISTORY CORRUPTION!\n\n` +
        `Current state found in history (should only have completed steps):\n` +
        `  Current: ${currentState}\n` +
        `  History: ${historyStates.join(', ')}\n\n` +
        `This indicates Bug #12 is still present or manual corruption.\n\n` +
        `ACTION: Verify Bug #12 fix is applied, or delete task and recreate.`
      );
    }
    
    // Validate: History must follow sequential progression
    for (let i = 1; i < historyStates.length; i++) {
      const prevState = historyStates[i - 1];
      const currState = historyStates[i];
      
      if (!this.isValidTransition(prevState, currState)) {
        throw new Error(
          `🚨 STATE HISTORY CORRUPTION DETECTED!\n\n` +
          `Invalid transition found in state history:\n` +
          `  ${prevState} → ${currState}\n\n` +
          `This usually means:\n` +
          `  1. Manual edit to .ai-context/current-task.json (NOT ALLOWED)\n` +
          `  2. State forgery attempt (SECURITY ISSUE)\n` +
          `  3. File corruption (INTEGRITY ISSUE)\n\n` +
          `ACTION REQUIRED:\n` +
          `  1. Use ONLY "npx ai-workflow sync --state <STATE>" to change states\n` +
          `  2. Do NOT manually edit current-task.json\n` +
          `  3. If file is corrupted, delete and create new task\n\n` +
          `Security: This validation prevents bypassing workflow quality gates.`
        );
      }
    }
    
    // BUG-FIX-012-VALIDATION: After fixing Bug #12, history contains COMPLETED states
    // Current state should be ONE step ahead of last history entry
    // Example: current=DESIGNING, history=[UNDERSTANDING] ← This is CORRECT!
    if (historyStates.length > 0) {
      const lastHistoryState = historyStates[historyStates.length - 1];
      
      // Verify last history entry is the PREVIOUS state (one step before current)
      const sequence: WorkflowState[] = [
        'UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING',
        'TESTING', 'REVIEWING', 'READY_TO_COMMIT'
      ];
      const currentIndex = sequence.indexOf(currentState);
      const expectedPrevious = currentIndex > 0 ? sequence[currentIndex - 1] : null;
      
      if (expectedPrevious && lastHistoryState !== expectedPrevious) {
        // Allow this - might be valid state skip or retroactive task
        console.warn(
          `⚠️  Note: Last history state (${lastHistoryState}) doesn't match ` +
          `expected previous (${expectedPrevious}). This may be normal for retroactive tasks.`
        );
      }
    }
    
    // Validate: No impossible state jumps in history
    const currentIndex = sequence.indexOf(currentState as WorkflowState);
    
    // Check if we're at a state that requires passing through earlier states
    if (currentIndex >= 3) { // TESTING or later
      const requiredStates = sequence.slice(0, currentIndex);
      
      for (const requiredState of requiredStates) {
        if (!historyStates.includes(requiredState)) {
          console.warn(
            `⚠️  WARNING: State history suspicious!\n\n` +
            `Current state: ${currentState}\n` +
            `Missing from history: ${requiredState}\n\n` +
            `This could indicate state skipping.\n` +
            `History: ${historyStates.join(' → ')}`
          );
        }
      }
    }
  }
  
  /**
   * Analyze workflow completeness for AI users
   * Detects missing phases and provides guidance for AI to complete them
   * @requirement BUG-FIX-009-AI - AI flow correction mechanism
   */
  public async analyzeWorkflowCompleteness(): Promise<{
    complete: boolean;
    currentState: WorkflowState;
    missingPhases: WorkflowState[];
    instructions?: string;
  }> {
    const taskData = await fs.readJson(this.taskFile);
    const { currentState, stateHistory } = taskData.workflow;
    
    const sequence: WorkflowState[] = [
      'UNDERSTANDING',
      'DESIGNING',
      'IMPLEMENTING',
      'TESTING',
      'REVIEWING',
      'READY_TO_COMMIT'
    ];
    
    const currentIndex = sequence.indexOf(currentState as WorkflowState);
    
    // Required phases: All phases up to (not including) current
    // Note: UNDERSTANDING is the starting state and is implicitly complete
    const requiredPhases = sequence.slice(1, currentIndex); // Start from DESIGNING
    
    // Completed phases from history
    // BUG-FIX: Normalize state names for backward compatibility with v2.x data
    const historyStates = (stateHistory || []).map((e: any) => normalizeState(e.state));
    
    // Find missing phases (UNDERSTANDING not required in history as it's initial state)
    const missing = requiredPhases.filter(phase => !historyStates.includes(phase));
    
    if (missing.length === 0) {
      return {
        complete: true,
        currentState,
        missingPhases: []
      };
    }
    
    // Generate AI instructions for missing phases
    const instructions = this.generateAIFlowInstructions(missing, currentState);
    
    return {
      complete: false,
      currentState,
      missingPhases: missing,
      instructions
    };
  }
  
  /**
   * Generate AI-specific instructions for completing missing workflow phases
   * @requirement BUG-FIX-009-AI - AI guidance generation
   */
  private generateAIFlowInstructions(
    missing: WorkflowState[],
    current: WorkflowState
  ): string {
    let instructions = `🤖 AI FLOW CORRECTION NEEDED\n\n`;
    
    instructions += `Current State: ${current}\n`;
    instructions += `Missing Phases: ${missing.join(', ')}\n\n`;
    
    instructions += `You (AI) need to complete the following workflow phases:\n\n`;
    
    for (const phase of missing) {
      instructions += this.getPhaseInstructionsForAI(phase);
      instructions += `\n`;
    }
    
    instructions += `📋 WORKFLOW TO FOLLOW:\n\n`;
    
    // Generate step-by-step workflow
    for (let i = 0; i < missing.length; i++) {
      const phase = missing[i];
      const nextPhase = i < missing.length - 1 ? missing[i + 1] : current;
      
      instructions += `Step ${i + 1}: Complete ${phase} work\n`;
      instructions += `  Then run: npx ai-workflow sync\n`;
      instructions += `  Progress to: ${nextPhase}\n\n`;
    }
    
    instructions += `After completing all missing phases, your workflow will be complete and correct.\n`;
    
    return instructions;
  }
  
  /**
   * Get AI-specific instructions for a workflow phase
   * @requirement BUG-FIX-009-AI - Phase-specific AI guidance
   */
  private getPhaseInstructionsForAI(phase: WorkflowState): string {
    const instructions: Record<WorkflowState, string> = {
      'UNDERSTANDING': 
        `📋 MISSING PHASE: UNDERSTANDING\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Ask clarifying questions about the requirements\n` +
        `2. Identify key requirements and constraints\n` +
        `3. List assumptions\n` +
        `4. Confirm understanding with user\n` +
        `\n` +
        `AI Execution Time: 30-60 seconds\n` +
        `After completing: User will approve, then you sync to next state\n`,
        
      'DESIGNING':
        `🏗️  MISSING PHASE: DESIGN\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Propose architecture/design approach\n` +
        `2. Identify components and modules needed\n` +
        `3. Plan file structure\n` +
        `4. Get user approval on design\n` +
        `\n` +
        `AI Execution Time: 1-2 minutes\n` +
        `After completing: User will approve, then you sync to next state\n`,
        
      'IMPLEMENTING':
        `💻 MISSING PHASE: IMPLEMENTATION\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Write the actual code based on design\n` +
        `2. Implement all planned features\n` +
        `3. Follow best practices and code quality standards\n` +
        `4. Add inline documentation\n` +
        `\n` +
        `AI Execution Time: 2-10 minutes\n` +
        `After completing: You sync to next state\n`,
        
      'TESTING':
        `🧪 MISSING PHASE: TESTING (MANDATORY!)\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Write comprehensive unit tests\n` +
        `2. Write integration tests if needed\n` +
        `3. Test edge cases and error conditions\n` +
        `4. Ensure all tests pass\n` +
        `5. Achieve >70% test coverage\n` +
        `\n` +
        `⚠️  CRITICAL: Testing is MANDATORY and cannot be skipped!\n` +
        `AI Execution Time: 1-5 minutes\n` +
        `After completing: You sync to next state\n`,
        
      'REVIEWING':
        `👀 MISSING PHASE: REVIEW\n` +
        `\n` +
        `🤖 AI Task:\n` +
        `1. Review your code for quality issues\n` +
        `2. Verify all requirements are met\n` +
        `3. Check test coverage is adequate\n` +
        `4. Look for potential improvements\n` +
        `\n` +
        `AI Execution Time: 30-90 seconds\n` +
        `After completing: You sync to READY_TO_COMMIT\n`,
        
      'READY_TO_COMMIT':
        ``  // Should never be missing
    };
    
    return instructions[phase] || '';
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
   */
  private async validateStatePrerequisites(state: WorkflowState): Promise<void> {
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
   * Auto-runs validation as first checklist item
   * Enhanced with comprehensive checks
   */
  private async initializeReviewChecklist(): Promise<void> {
    const { ReviewChecklistManager } = await import('./review-checklist.js');
    const checklist = ReviewChecklistManager.createDefaultChecklist();
    
    let updatedChecklist = checklist;
    
    // Display review state information
    console.log(chalk.cyan('\n📋 Entering REVIEWING State\n'));
    console.log(chalk.gray('This state performs quality review before commit.\n'));
    
    try {
      // Auto-run validation
      console.log(chalk.cyan('🔍 Running automated validation...\n'));
      const validationResult = await ReviewChecklistManager.runAutomatedValidation();
      
      if (validationResult.success && validationResult.result) {
        // Mark validation item as complete
        updatedChecklist = ReviewChecklistManager.markItemComplete(
          checklist,
          'auto-validation',
          validationResult.result.overall 
            ? 'All validations passed' 
            : 'Validation completed with issues'
        );
        
        if (validationResult.result.overall) {
          console.log(chalk.green('✅ Automated validation passed!\n'));
        } else {
          console.log(chalk.yellow('⚠️  Automated validation found issues. Please review.\n'));
          // Show validation details if available
          if (validationResult.result.workflow && !validationResult.result.workflow.passed) {
            console.log(chalk.yellow(`   Workflow: ${validationResult.result.workflow.message}\n`));
          }
          if (validationResult.result.files && !validationResult.result.files.passed) {
            console.log(chalk.yellow(`   Files: ${validationResult.result.files.message}\n`));
          }
        }
      } else {
        // Validation failed - keep checklist as is (auto-validation item remains incomplete)
        console.log(chalk.red(`❌ Validation failed: ${validationResult.error || 'Unknown error'}\n`));
      }
    } catch (error) {
      // If validation throws error, still save checklist (validation item remains incomplete)
      console.log(chalk.red(`❌ Validation error: ${(error as Error).message}\n`));
    }
    
    // Additional automated checks for REVIEWING state
    try {
      console.log(chalk.cyan('🔍 Running additional quality checks...\n'));
      
      // Check test directory exists
      const testDirs = ['__tests__', 'test', 'tests'];
      let hasTests = false;
      for (const dir of testDirs) {
        if (await fs.pathExists(dir)) {
          hasTests = true;
          break;
        }
      }
      if (hasTests) {
        console.log(chalk.green('✅ Test directory found\n'));
      } else {
        console.log(chalk.yellow('⚠️  No test directory found\n'));
      }
      
    } catch (error) {
      // Additional checks failed, but don't block
      console.log(chalk.yellow(`⚠️  Some quality checks failed: ${(error as Error).message}\n`));
    }
    
    // Always store checklist (whether validation passed, failed, or threw error)
    // This must be called to ensure checklist is persisted
    await this.saveReviewChecklist(updatedChecklist);
    
    // Verify checklist was saved (for debugging)
    const savedChecklist = await this.loadReviewChecklist();
    if (!savedChecklist) {
      // If save failed, try again with error handling
      console.warn('⚠️ Warning: Checklist save verification failed, retrying...');
      await this.saveReviewChecklist(updatedChecklist);
    }
    
    // Display checklist status
    console.log(chalk.cyan('\n📋 Review Checklist Status:\n'));
    ReviewChecklistManager.displayChecklist(updatedChecklist);
    console.log(chalk.gray('\n💡 Complete all checklist items before progressing to READY_TO_COMMIT\n'));
  }

  /**
   * Validate that review checklist is complete before allowing READY_TO_COMMIT
   */
  private async validateReviewChecklistComplete(): Promise<void> {
    const { ReviewChecklistManager } = await import('./review-checklist.js');
    
    // Try to load checklist from multiple sources
    let checklist = await this.loadReviewChecklist();
    
    // If not found in queue or current-task.json, try reading directly from file
    // This is a fallback for test contexts where queue might not be properly synced
    // Note: loadReviewChecklist() already checks this.taskFile, so this is a redundant check
    // But we keep it for extra safety in test contexts
    if (!checklist) {
      try {
        if (await fs.pathExists(this.taskFile)) {
          const taskData = await fs.readJson(this.taskFile);
          if (taskData.reviewChecklist) {
            checklist = taskData.reviewChecklist;
          }
        }
      } catch (error) {
        // File read failed, continue
      }
    }
    
    if (!checklist) {
      throw new Error(
        'Review checklist not found. You must complete REVIEWING state first.\n\n' +
        'Run: npx ai-workflow sync --state REVIEWING'
      );
    }
    
    if (!ReviewChecklistManager.isChecklistComplete(checklist)) {
      const percentage = ReviewChecklistManager.getCompletionPercentage(checklist);
      const completed = checklist.items.filter((item: any) => item.completed).length;
      const total = checklist.items.length;
      
      console.log(chalk.red('\n❌ Review checklist incomplete!\n'));
      ReviewChecklistManager.displayChecklist(checklist);
      
      throw new Error(
        `Cannot proceed to READY_TO_COMMIT: Review checklist is ${percentage}% complete.\n\n` +
        `Completed: ${completed}/${total} items\n\n` +
        `Please complete all review checklist items before proceeding.\n` +
        `Use: npx ai-workflow review check <item-id> to mark items complete.`
      );
    }
  }

  /**
   * Save review checklist to task
   * 
   * REFACTORED: Now uses TaskFileSync instead of direct file write
   */
  private async saveReviewChecklist(checklist: any): Promise<void> {
    // 1. Save to queue first
    const activeTask = await this.queueManager.getActiveTask();
    
    if (!activeTask) {
      throw new Error('No active task to save checklist to');
    }
    
    try {
      // Update queue task
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === activeTask.id);
      if (queueTask) {
        queueTask.reviewChecklist = checklist;
        await (this.queueManager as any).saveQueue(queue);
        // Update local reference
        activeTask.reviewChecklist = checklist;
      }
    } catch (error) {
      console.warn('Warning: Failed to save checklist to queue:', (error as Error).message);
      // Continue to sync file even if queue update fails
    }
    
    // 2. Sync to file (via TaskFileSync) - this will sync reviewChecklist from queue
    await this.fileSync.syncFromQueue(activeTask, {
      preserveFields: ['requirements'],
      backup: true
    });
    
    if (process.env.DEBUG) {
      console.log('✅ Checklist saved and synced successfully');
    }
  }

  /**
   * Load review checklist from task
   */
  private async loadReviewChecklist(): Promise<any | null> {
    const { ReviewChecklistManager } = await import('./review-checklist.js');
    
    try {
      const activeTask = await this.queueManager.getActiveTask();
      
      if (activeTask && activeTask.reviewChecklist) {
        // Migrate if needed
        return ReviewChecklistManager.migrateChecklist(activeTask.reviewChecklist);
      }
    } catch (error) {
      // If queue load fails, continue to check current-task.json
    }
    
    // Fallback to current-task.json
    try {
      if (await fs.pathExists(this.taskFile)) {
        const taskData = await fs.readJson(this.taskFile);
        if (taskData.reviewChecklist) {
          // Migrate if needed
          return ReviewChecklistManager.migrateChecklist(taskData.reviewChecklist);
        }
      }
    } catch (error) {
      // If file read fails, return null
    }
    
    return null;
  }

  /**
   * Complete task
   * @requirement REQ-V2-003 - Task lifecycle completion
   * @requirement REQ-V2-010 - Auto-inject context after completion
   * @requirement BUG-FIX-003 - Require READY_TO_COMMIT state
   * @requirement FREE-TIER-001 - Use TaskQueueManager for multi-task support
   */
  async completeTask(): Promise<{ alreadyCompleted: boolean }> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Get active task from queue system
    let activeTask = await this.queueManager.getActiveTask();
    
    // FIX: Retry queue read if queue is null but file exists (handles timing issues)
    if (!activeTask && await fs.pathExists(this.taskFile)) {
      await new Promise(resolve => setTimeout(resolve, 10));
      activeTask = await this.queueManager.getActiveTask();
    }
    
    if (!activeTask) {
      // Fallback to old format for backward compatibility
      if (!await fs.pathExists(this.taskFile)) {
        throw new Error('No active task to complete');
      }
      const taskData = await fs.readJson(this.taskFile);
      
      // Check if task is already completed
      if (taskData.status === 'completed' || taskData.completedAt) {
        // Task already completed - return success (idempotent operation)
        return { alreadyCompleted: true };
      }
      
      const currentState = taskData.workflow?.currentState;
      
      // CRITICAL: Must be at READY_TO_COMMIT to complete task
      if (currentState !== 'READY_TO_COMMIT') {
        throw new Error(
          `Cannot complete task at ${currentState} state.\n\n` +
          `Task must be at READY_TO_COMMIT before completion.\n\n` +
          `Current state: ${currentState}\n` +
          `Required: READY_TO_COMMIT\n\n` +
          `Progress to READY_TO_COMMIT first, then complete.`
        );
      }
      
      taskData.status = 'completed';
      taskData.completedAt = new Date().toISOString();
      taskData.workflow.currentState = 'READY_TO_COMMIT';

      await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
      
      // FIX: Force event loop to process file system flush
      await new Promise(resolve => setImmediate(resolve));
      
      // Try to complete in engine (not critical, state already saved)
      try {
        await this.engine.completeTask();
      } catch (error) {
        // Engine might not have task, but that's okay - state is saved in file
        console.warn(`⚠️ Engine completion warning: ${(error as Error).message}`);
      }
      
      // BUG-FIX-006: Clear context files after completion
      await fs.remove(path.join(this.contextDir, 'STATUS.txt'));
      await fs.remove(path.join(this.contextDir, 'NEXT_STEPS.md'));
      await fs.remove(path.join(this.contextDir, 'WARNINGS.md'));
      return { alreadyCompleted: false };
    }
    
    // Use queue system
    // Check if task is already completed
    // Also check the file in case queue is out of sync
    if (activeTask.status === 'DONE' || activeTask.completedAt) {
      // Task already completed - return success (idempotent operation)
      return { alreadyCompleted: true };
    }
    
    // Double-check file in case queue is out of sync with file
    if (await fs.pathExists(this.taskFile)) {
      try {
        const fileTaskData = await fs.readJson(this.taskFile);
        if (fileTaskData.status === 'completed' || fileTaskData.completedAt) {
          // File shows completed but queue doesn't - file is source of truth
          return { alreadyCompleted: true };
        }
      } catch (error) {
        // File read failed, continue with queue data
      }
    }
    
    const currentState = activeTask.workflow?.currentState;
    
    // CRITICAL: Must be at READY_TO_COMMIT to complete task
    if (currentState !== 'READY_TO_COMMIT') {
      throw new Error(
        `Cannot complete task at ${currentState} state.\n\n` +
        `Task must be at READY_TO_COMMIT before completion.\n\n` +
        `Current state: ${currentState}\n` +
        `Required: READY_TO_COMMIT\n\n` +
        `Progress to READY_TO_COMMIT first, then complete.`
      );
    }
    
    // Complete task using queue system
    const result = await this.queueManager.completeTask(activeTask.id);
    
    // REFACTORED: Use TaskFileSync to sync completed task (full sync, not partial)
    // IMPORTANT: Only sync completed task if no next task is auto-activated
    // If next task is auto-activated, file will be synced with next task instead
    if (!result.nextActive && await fs.pathExists(this.taskFile)) {
      // Sync completed task from queue (full sync ensures all data is synced)
      await this.fileSync.syncFromQueue(result.completed, {
        preserveFields: ['requirements'],
        backup: true
      });
    }
    
    // Try to complete in engine (not critical, state already saved in queue)
    try {
      await this.engine.completeTask();
    } catch (error) {
      // Engine might not have task, but that's okay - state is saved in queue
      console.warn(`⚠️ Engine completion warning: ${(error as Error).message}`);
    }
    
    // Fix 5: Update context for next task (if auto-activated) and sync file
    // Cursor Integration: Updates STATUS.txt and NEXT_STEPS.md for next task
    // NOTE: If next task is auto-activated, file will be updated to next task
    // This is expected behavior - file always reflects active task
    if (result.nextActive && result.nextActive.status === 'ACTIVE') {
      // Sync file with next task (this will overwrite completed task in file)
      // This is correct behavior - file should always show active task
      await this.syncFileFromQueue(result.nextActive, ['requirements']);
      
      const nextTask: Task = {
        id: result.nextActive.id,
        goal: result.nextActive.goal,
        status: result.nextActive.workflow?.currentState || 'UNDERSTANDING',
        startedAt: result.nextActive.createdAt,
        roleApprovals: []
      };
      
      const activeRoles = this.roleSystem.getActiveRoles({
        taskGoal: nextTask.goal
      });
      const localRules = await this.ruleManager.getRules();
      
      await this.contextInjector.updateAfterCommand('task.complete', {
        task: nextTask,
        warnings: [],
        blockers: [],
        activeRoles,
        localRules
      });
    } else {
      // No next task - sync completed task to file first, then clear context files
      if (await fs.pathExists(this.taskFile)) {
        // Sync completed task from queue (full sync ensures all data is synced)
        await this.fileSync.syncFromQueue(result.completed, {
          preserveFields: ['requirements'],
          backup: true
        });
      }
      
      // Clear context files (but keep current-task.json to show completed status)
      await fs.remove(path.join(this.contextDir, 'STATUS.txt'));
      await fs.remove(path.join(this.contextDir, 'NEXT_STEPS.md'));
      await fs.remove(path.join(this.contextDir, 'WARNINGS.md'));
      
      // Note: current-task.json is kept to show completed task status
      // This allows getCurrentTask() to return null (completed tasks are not "current")
      // but file still exists with completed status for reference
    }
    
    return { alreadyCompleted: false };
  }

  /**
   * Get workflow progress
   */
  getProgress(): number {
    return this.engine.getProgress();
  }

  /**
   * List tasks (current + history)
   * @requirement REQ-V2-003 - Task listing (NEW v2.0)
   */
  async listTasks(statusFilter?: string, limit = 10): Promise<Task[]> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Use queue system to list tasks
    // Note: statusFilter is WorkflowState, but we list all tasks and filter by workflow state
    const queueTasks = await this.queueManager.listTasks({
      limit
    });
    
    // Convert queue tasks to WorkflowEngine Task format and filter by workflow state
    let tasks: Task[] = queueTasks.map(queueTask => ({
      id: queueTask.id,
      goal: queueTask.goal,
      status: queueTask.workflow?.currentState || 'UNDERSTANDING',
      startedAt: queueTask.createdAt,
      completedAt: queueTask.completedAt,
      roleApprovals: []
    }));
    
    // Filter by workflow state if specified
    if (statusFilter) {
      tasks = tasks.filter(t => t.status === statusFilter);
    }
    
    // Apply limit
    tasks = tasks.slice(0, limit);
    
    // Fallback to old format if no queue tasks
    if (tasks.length === 0) {
      const currentTask = await this.getCurrentTask();
      if (currentTask) {
        if (!statusFilter || currentTask.status === statusFilter) {
          tasks.push(currentTask);
        }
      }
    }
    
    // Get task history
    const historyDir = path.join(this.contextDir, 'task-history');
    if (await fs.pathExists(historyDir)) {
      const files = await fs.readdir(historyDir);
      const historyFiles = files.filter(f => f.endsWith('.json'));
      
      // Sort by modification time (most recent first)
      const filesWithStats = await Promise.all(
        historyFiles.map(async (file) => {
          const filePath = path.join(historyDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Read historical tasks
      for (const { file } of filesWithStats) {
        if (tasks.length >= limit) break;
        
        try {
          const taskData = await fs.readJson(path.join(historyDir, file));
          
          // Convert task data to Task format
          const historicalTask: Task = {
            id: taskData.taskId || file.replace('.json', ''),
            goal: taskData.originalGoal || '',
            status: taskData.workflow?.currentState || 'UNDERSTANDING',
            startedAt: taskData.startedAt || '',
            completedAt: taskData.completedAt,
            roleApprovals: taskData.roleApprovals || []
          };
          
          if (!statusFilter || historicalTask.status === statusFilter) {
            tasks.push(historicalTask);
          }
        } catch (error) {
          // Skip invalid task files
          continue;
        }
      }
    }
    
    return tasks.slice(0, limit);
  }

  /**
   * Update task details
   * @requirement REQ-V2-003 - Task update (NEW v2.0)
   */
  async updateTask(
    taskId: string,
    updates: {
      goal?: string;
      addReq?: string;
    }
  ): Promise<void> {
    // Check and run migration if needed
    await this.ensureMigration();
    
    // Check if it's the current task
    const currentTask = await this.getCurrentTask();
    if (!currentTask || currentTask.id !== taskId) {
      throw new Error(`Task ${taskId} not found or not active`);
    }
    
    // REFACTORED: Update queue first, then sync from queue to file (no direct file write)
    const activeQueueTask = await this.queueManager.getActiveTask();
    if (activeQueueTask && activeQueueTask.id === taskId) {
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === taskId);
      if (queueTask) {
        // Update queue task
        if (updates.goal) {
          queueTask.goal = updates.goal;
        }
        
        // Update requirements in queue
        if (updates.addReq) {
          if (!(queueTask as any).requirements) {
            (queueTask as any).requirements = [];
          }
          if (!(queueTask as any).requirements.includes(updates.addReq)) {
            (queueTask as any).requirements.push(updates.addReq);
          }
        }
        
        await (this.queueManager as any).saveQueue(queue);
        
        // REFACTORED: Sync from queue to file (no direct file write)
        await this.syncFileFromQueue(queueTask, []);
      }
    } else {
      // Fallback: If no queue task, update file directly (backward compatibility)
      if (await fs.pathExists(this.taskFile)) {
        const taskData = await fs.readJson(this.taskFile);
        
        // Apply updates
        if (updates.goal) {
          taskData.originalGoal = updates.goal;
        }
        
        if (updates.addReq) {
          if (!taskData.requirements) {
            taskData.requirements = [];
          }
          if (!taskData.requirements.includes(updates.addReq)) {
            taskData.requirements.push(updates.addReq);
          }
        }
        
        // Save updated task
        await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
        
        // FIX: Force event loop to process file system flush
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Auto-inject context for AI
    const updatedTask = await this.getCurrentTask();
    if (updatedTask) {
      const localRules = await this.ruleManager.getRules();  // v3.0.3
      await this.contextInjector.updateAfterCommand('task.update', {
        task: updatedTask,
        warnings: [],
        blockers: [],
        localRules  // v3.0.3 - Include project rules
      });
    }
  }

  /**
   * Generate state enforcement .mdc file
   * @requirement USER-INSIGHT-11 - Auto-generate 000-current-state-enforcement.mdc
   * User proposed solution: Put 6-step workflow enforcement in .cursor/rules
   */
  private async generateStateEnforcementMDC(state: WorkflowState): Promise<void> {
    const currentTask = await this.getCurrentTask();
    const taskId = currentTask?.id || 'none';
    const taskGoal = currentTask?.goal || 'No current task (check status - may be completed)';
    
    const content = `---
description: "CURRENT STATE ENFORCEMENT - Auto-generated on state change"
globs: "**/*"
alwaysApply: true
priority: 0
version: dynamic-${Date.now()}
tags: [state-enforcement, auto-generated, critical, ${state}]
generatedAt: ${new Date().toISOString()}
currentState: ${state}
taskId: ${taskId}
---

# 🚨 CURRENT WORKFLOW STATE: ${state}

⚠️  **This file is AUTO-GENERATED and updates when workflow state changes!**
⚠️  **Last updated:** ${new Date().toISOString()}
⚠️  **Current task:** ${taskId}
⚠️  **Do NOT manually edit - changes will be overwritten!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔴 MANDATORY EXECUTION PROTOCOL

**You are at ${state} state.**

At the START of this conversation, you MUST:

### ☑️ CHECKPOINT: Load State-Specific Behavior

Execute in EXACT order:

1. ✅ You are reading this file (000-current-state-enforcement.mdc) ← Automatic (priority 0!)
2. ✅ Current state from metadata: **${state}**
3. ✅ Task: ${taskGoal}
4. ✅ Call tool: \`read_file('.cursor/rules/state-behaviors/${state}.md')\`
5. ✅ Read ALL behavior rules from that file
6. ✅ Respond with verification:

**Required first response:**
\`\`\`
✓ Workflow State Enforcement Loaded:
  State: ${state}
  Task: ${taskGoal}
  Behavior file: state-behaviors/${state}.md
  I have loaded state-specific allowed/forbidden actions.
  I will follow ONLY allowed actions for this state.
\`\`\`

🚫 DO NOT respond until checkpoint complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 STATE-SPECIFIC BEHAVIOR RULES

**Full rules:** \`.cursor/rules/state-behaviors/${state}.md\`

**You MUST read that file before proceeding!**

${this.getStateSummary(state)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Priority:** 0 (HIGHEST - Read FIRST before all other .mdc files!)  
**Updates:** Automatically when state changes  
**Purpose:** Enforce proper workflow state behavior
`;

    // Write to .cursor/rules/
    const rulesDir = path.join(process.cwd(), '.cursor', 'rules');
    await fs.ensureDir(rulesDir);
    await fs.writeFile(
      path.join(rulesDir, '000-current-state-enforcement.mdc'),
      content,
      'utf-8'
    );
    
    console.log(`✅ Generated state enforcement: ${state}`);
    console.log(`   File: .cursor/rules/000-current-state-enforcement.mdc`);
    console.log(`   Priority: 0 (highest)`);
  }

  /**
   * Get state summary for 000 file
   */
  private getStateSummary(state: WorkflowState): string {
    const summaries: Record<WorkflowState, string> = {
      'UNDERSTANDING': `
**Quick Summary:**
- ✅ Allowed: Ask questions, read code, analyze
- 🚫 Forbidden: Write code, modify files, commit
- 🎯 Next: Progress to DESIGNING when requirements clear
`,
      'DESIGNING': `
**Quick Summary:**
- ✅ Allowed: Design solution, plan architecture, create pseudocode
- 🚫 Forbidden: Write production code, run tests, commit
- 🎯 Next: Progress to IMPLEMENTING when design approved
`,
      'IMPLEMENTING': `
**Quick Summary:**
- ✅ Allowed: Write code, implement features, build
- 🚫 Forbidden: Write tests (next step!), make commits
- 🎯 Next: Progress to TESTING when implementation done
`,
      'TESTING': `
**Quick Summary:**
- ✅ Allowed: Write tests, run test suites, verify coverage
- 🚫 Forbidden: Modify production code (tests only!), commit
- 🎯 Next: Progress to REVIEWING when tests pass
`,
      'REVIEWING': `
**Quick Summary:**
- ✅ Allowed: Review code, check quality, run validation
- 🚫 Forbidden: Major changes, commits without validation
- 🎯 Next: Run validation to progress to READY_TO_COMMIT
`,
      'READY_TO_COMMIT': `
**Quick Summary:**
- ✅ Allowed: Make commit, complete task
- 🚫 Forbidden: Skip validation, use --no-verify
- 🎯 Final: Commit and complete task

**⚠️ TASK COMPLETION REMINDER:**
After committing your changes, remember to complete your task:
\`\`\`bash
npx ai-workflow task complete
\`\`\`
This marks your task as finished and allows starting next task.
`
    };
    
    return summaries[state] || '';
  }
}


