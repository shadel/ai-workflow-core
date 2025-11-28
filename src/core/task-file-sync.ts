/**
 * Task File Sync - Centralized file sync operations
 * @requirement REQ-V2-003 - Task file synchronization
 * 
 * This class is the ONLY way to write to current-task.json
 * All file writes must go through this class to ensure consistency.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import type { WorkflowState } from '@shadel/workflow-core';
import type { Task as QueueTask, ReviewChecklist } from './task-queue.js';
import { TaskFileLock } from './task-file-lock.js';

/**
 * Task data in current-task.json file
 */
import type { StateChecklist } from './state-checklist-service.js';

export interface TaskFileData {
  taskId: string;
  originalGoal: string;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt?: string;
  workflow: {
    currentState: WorkflowState;
    stateEnteredAt: string;
    stateHistory: Array<{
      state: WorkflowState;
      enteredAt: string;
    }>;
  };
  requirements?: string[];
  reviewChecklist?: ReviewChecklist;
  stateChecklists?: {
    [state in WorkflowState]?: StateChecklist;
  };
}

/**
 * Options for sync operations
 */
export interface SyncOptions {
  preserveFields?: string[];     // Fields to preserve from existing file
  skipValidation?: boolean;       // Skip validation (use with caution)
  backup?: boolean;               // Create backup before sync (default: true)
}

/**
 * Task File Sync - Centralized file sync operations
 * 
 * Responsibilities:
 * - Sync queue data to file (one-way: queue → file)
 * - Atomic writes to prevent corruption
 * - Manual edit detection (content-based)
 * - Backup and rollback support
 */
export class TaskFileSync {
  private taskFile: string;
  private contextDir: string;
  private fileLock: TaskFileLock;

  constructor(contextDir: string = '.ai-context') {
    this.contextDir = contextDir;
    this.taskFile = path.join(contextDir, 'current-task.json');
    this.fileLock = new TaskFileLock(contextDir);
  }

  /**
   * Sync file from queue (one-way: queue → file)
   * This is the ONLY way to write to current-task.json
   * 
   * @param queueTask - Task from queue system
   * @param options - Sync options
   */
  async syncFromQueue(
    queueTask: QueueTask,
    options?: SyncOptions
  ): Promise<void> {
    const DEBUG = process.env.DEBUG_TASK_FILE_SYNC === 'true';
    
    if (DEBUG) {
      console.log('[DEBUG TaskFileSync.syncFromQueue] Starting sync:', {
        queueTaskId: queueTask.id,
        queueTaskStatus: queueTask.status,
        queueTaskGoal: queueTask.goal,
        preserveFields: options?.preserveFields || []
      });
    }
    
    // 0. Ensure directory exists before acquiring lock (with retry for race conditions)
    try {
      await fs.ensureDir(this.contextDir);
    } catch (error: any) {
      // Retry once if directory creation fails (race condition with cleanup)
      if (error.code === 'ENOENT' || error.code === 'EEXIST') {
        await new Promise(resolve => setTimeout(resolve, 10));
        await fs.ensureDir(this.contextDir);
      } else {
        throw error;
      }
    }
    
    // 1. Acquire file lock (lock acquisition also ensures directory exists)
    await this.fileLock.acquire();

    try {
      // 2. Create backup (if enabled)
      if (options?.backup !== false) {
        await this.backupFile();
      }

      // 3. Build file data from queue
      const fileData = await this.buildFileData(queueTask, options);
      
      if (DEBUG) {
        console.log('[DEBUG TaskFileSync.syncFromQueue] Built fileData:', {
          taskId: fileData.taskId,
          originalGoal: fileData.originalGoal,
          status: fileData.status,
          hasReviewChecklist: !!fileData.reviewChecklist
        });
      }

      // 4. Atomic write (temp → rename)
      // TRACK: Log taskId before write
      if (DEBUG || process.env.TRACK_TASK_ID === 'true') {
        console.log('[TRACK TaskFileSync] About to write file with taskId:', fileData.taskId);
      }
      await this.atomicWrite(fileData);
      
      if (DEBUG || process.env.TRACK_TASK_ID === 'true') {
        console.log('[TRACK TaskFileSync] File written successfully with taskId:', fileData.taskId);
      }

      // 5. Verify consistency
      await this.verifySync(queueTask, fileData);
      
      if (DEBUG) {
        console.log('[DEBUG TaskFileSync.syncFromQueue] Verification passed');
      }
    } catch (error) {
      if (DEBUG) {
        console.error('[DEBUG TaskFileSync.syncFromQueue] Error:', (error as Error).message);
      }
      // Rollback from backup if exists
      if (await this.hasBackup()) {
        console.warn('⚠️ Sync failed, rolling back from backup...');
        await this.rollbackFromBackup();
      }
      throw new Error(`Sync failed: ${(error as Error).message}`);
    } finally {
      // 6. Release lock
      await this.fileLock.release();
      
      if (DEBUG) {
        console.log('[DEBUG TaskFileSync.syncFromQueue] Lock released, sync complete');
      }
    }
  }

  /**
   * Build file data from queue task
   * 
   * @param queueTask - Task from queue system
   * @param options - Sync options
   */
  private async buildFileData(
    queueTask: QueueTask,
    options?: SyncOptions
  ): Promise<TaskFileData> {
    const DEBUG = process.env.DEBUG_TASK_FILE_SYNC === 'true';
    
    // Preserve fields from existing file if specified
    const preserved = options?.preserveFields || [];
    const existingData = await this.loadExistingFile();
    
    if (DEBUG) {
      console.log('[DEBUG TaskFileSync.buildFileData] Input:', {
        queueTaskId: queueTask.id,
        queueTaskGoal: queueTask.goal,
        existingFileTaskId: existingData?.taskId,
        existingFileGoal: existingData?.originalGoal,
        preserveFields: preserved
      });
    }

    // Create default workflow if missing
    const defaultWorkflow = {
      currentState: 'UNDERSTANDING' as WorkflowState,
      stateEnteredAt: queueTask.createdAt,
      stateHistory: []
    };

    // Requirements: sync from queue if exists, otherwise default to empty array for backward compatibility
    // If preserve is false and queueValue is undefined, default to []
    const requirementsValue = this.preserveOrSync(
      existingData?.requirements,
      (queueTask as any).requirements,
      preserved.includes('requirements')
    );

    const fileData: TaskFileData = {
      taskId: queueTask.id, // CRITICAL: Always use queue task ID
      originalGoal: queueTask.goal,
      status: (queueTask.status === 'ACTIVE' ? 'in_progress' : 
               queueTask.status === 'DONE' ? 'completed' : 'in_progress') as 'in_progress' | 'completed',
      startedAt: queueTask.createdAt,
      completedAt: queueTask.completedAt,
      workflow: queueTask.workflow || defaultWorkflow,
      requirements: requirementsValue !== undefined ? requirementsValue : [],
      // FIX: Sync reviewChecklist from queue
      reviewChecklist: queueTask.reviewChecklist,
      // Sync stateChecklists from queue (for all states)
      stateChecklists: (queueTask as any).stateChecklists,
    };
    
    if (DEBUG) {
      console.log('[DEBUG TaskFileSync.buildFileData] Output:', {
        taskId: fileData.taskId,
        originalGoal: fileData.originalGoal,
        status: fileData.status
      });
    }
    
    return fileData;
  }

  /**
   * Preserve existing value or sync from queue
   */
  private preserveOrSync<T>(
    existing: T | undefined,
    queueValue: T | undefined,
    preserve: boolean
  ): T | undefined {
    if (preserve && existing !== undefined) {
      return existing;
    }
    // Return queueValue (can be undefined if not in queue)
    return queueValue;
  }

  /**
   * Load existing file data
   * Handles old format files (with `goal` field) by converting to new format (`originalGoal`)
   */
  private async loadExistingFile(): Promise<TaskFileData | null> {
    // Ensure directory exists before checking file (prevents ENOENT errors)
    try {
      await fs.ensureDir(this.contextDir);
    } catch (error) {
      // If directory creation fails, file definitely doesn't exist
      return null;
    }
    
    if (!await fs.pathExists(this.taskFile)) {
      return null;
    }

    try {
      const fileData = await fs.readJson(this.taskFile);
      
      // Migration: Convert old format (goal) to new format (originalGoal)
      if (fileData.goal && !fileData.originalGoal) {
        fileData.originalGoal = fileData.goal;
        delete fileData.goal;
      }
      
      return fileData;
    } catch (error) {
      // If file exists but can't be read, return null
      console.warn(`⚠️ Failed to load existing file: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Atomic write using temp file + rename
   * 
   * This ensures file writes are atomic and prevent corruption
   */
  private async atomicWrite(data: TaskFileData): Promise<void> {
    const TRACK = process.env.TRACK_TASK_ID === 'true';
    const tempFile = `${this.taskFile}.tmp.${Date.now()}`;

    try {
      // Ensure directory exists before writing
      await fs.ensureDir(this.contextDir);
      
      // TRACK: Log taskId before write
      if (TRACK) {
        console.log('[TRACK TaskFileSync.atomicWrite] Writing taskId:', data.taskId, 'to temp file:', tempFile);
      }
      
      // Write to temp file
      await fs.writeJson(tempFile, data, { spaces: 2 });

      // TRACK: Log before rename
      if (TRACK) {
        console.log('[TRACK TaskFileSync.atomicWrite] About to rename temp file to:', this.taskFile);
      }

      // Atomic rename (cross-platform)
      await fs.move(tempFile, this.taskFile, { overwrite: true });
      
      // TRACK: Log after rename
      if (TRACK) {
        console.log('[TRACK TaskFileSync.atomicWrite] Renamed successfully, taskId:', data.taskId);
      }

      // Force flush - use multiple strategies for reliability
      await new Promise(resolve => setImmediate(resolve));
      
      // Additional flush for Windows (file system caching)
      // Increased delay to ensure file is fully written and visible to other processes
      if (process.platform === 'win32') {
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        // Small delay for other platforms too
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } catch (error) {
      // Cleanup temp file on error
      await fs.remove(tempFile).catch(() => {});
      throw error;
    }
  }

  /**
   * Verify sync consistency
   */
  private async verifySync(
    queueTask: QueueTask,
    fileData: TaskFileData
  ): Promise<void> {
    const DEBUG = process.env.DEBUG_TASK_FILE_SYNC === 'true';
    
    // Small delay to ensure file is fully written and flushed (especially on Windows)
    if (process.platform === 'win32') {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    const loaded = await fs.readJson(this.taskFile);
    
    if (DEBUG) {
      console.log('[DEBUG TaskFileSync.verifySync] Verification:', {
        expectedTaskId: queueTask.id,
        loadedTaskId: loaded.taskId,
        match: loaded.taskId === queueTask.id
      });
    }

    if (loaded.taskId !== queueTask.id) {
      const errorMsg = `Sync verification failed: taskId mismatch. Expected: ${queueTask.id}, Got: ${loaded.taskId}`;
      if (DEBUG) {
        console.error('[DEBUG TaskFileSync.verifySync]', errorMsg, {
          fileData: JSON.stringify(loaded, null, 2)
        });
      }
      throw new Error(errorMsg);
    }

    // Verify critical fields
    if (loaded.workflow?.currentState !== queueTask.workflow?.currentState) {
      throw new Error('Sync verification failed: state mismatch');
    }

      // Verify reviewChecklist is synced (if exists in queue)
      if (queueTask.reviewChecklist !== undefined) {
        const queueChecklist = JSON.stringify(queueTask.reviewChecklist);
        const fileChecklist = JSON.stringify(loaded.reviewChecklist);
        if (queueChecklist !== fileChecklist) {
          throw new Error('Sync verification failed: reviewChecklist mismatch');
        }
      }
  }

  /**
   * Detect manual edit using content hash
   * 
   * Uses content-based hash comparison instead of timestamp
   * to avoid false positives/negatives from file system timing.
   */
  /**
   * Detect if file was manually edited
   * @param queueTask - Task from queue to compare
   * @param fileData - Optional file data to avoid re-reading (performance optimization)
   */
  async detectManualEdit(queueTask: QueueTask, fileData?: TaskFileData): Promise<boolean> {
    const DEBUG = process.env.DEBUG_TASK_FILE_SYNC === 'true';
    
    // Performance optimization: Use provided fileData if available to avoid re-reading
    let fileDataToUse: TaskFileData;
    if (fileData) {
      fileDataToUse = fileData;
    } else {
      if (!await fs.pathExists(this.taskFile)) {
        return false;
      }
      try {
        fileDataToUse = await fs.readJson(this.taskFile);
      } catch (error) {
        // If file read fails, assume no manual edit (safe default)
        console.warn(`⚠️ Failed to detect manual edit: ${(error as Error).message}`);
        return false;
      }
    }

    try {
      const fileHash = this.calculateHash(fileDataToUse);
      const queueHash = this.calculateHash(queueTask);

      // If hashes differ and taskId matches, manual edit detected
      const isManualEdit = fileHash !== queueHash && fileDataToUse.taskId === queueTask.id;
      
      if (DEBUG) {
        console.log('[DEBUG TaskFileSync.detectManualEdit]', {
          fileTaskId: fileDataToUse.taskId,
          queueTaskId: queueTask.id,
          fileHash: fileHash.substring(0, 8) + '...',
          queueHash: queueHash.substring(0, 8) + '...',
          hashMatch: fileHash === queueHash,
          taskIdMatch: fileDataToUse.taskId === queueTask.id,
          isManualEdit: isManualEdit
        });
      }
      
      return isManualEdit;
    } catch (error) {
      // If hash calculation fails, assume no manual edit (safe default)
      console.warn(`⚠️ Failed to detect manual edit: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Calculate content hash for comparison
   * 
   * Uses stable hash (excludes timestamps, etc.) to compare
   * only meaningful content differences.
   */
  private calculateHash(data: QueueTask | TaskFileData): string {
    // Use stable hash (exclude timestamps, etc.)
    const queueTask = data as QueueTask;
    const fileData = data as TaskFileData;
    
    // Normalize data for comparison
    // QueueTask has: id, goal, workflow, reviewChecklist
    // TaskFileData has: taskId, originalGoal, workflow, reviewChecklist
    const stable = {
      taskId: fileData.taskId || queueTask.id,
      goal: fileData.originalGoal || queueTask.goal,
      workflow: queueTask.workflow || fileData.workflow,
      requirements: (queueTask as any).requirements || fileData.requirements || [],
      reviewChecklist: queueTask.reviewChecklist || fileData.reviewChecklist || undefined
    };

    // Remove undefined values for consistent hashing
    const cleaned = Object.fromEntries(
      Object.entries(stable).filter(([_, v]) => v !== undefined)
    );

    return crypto.createHash('sha256')
      .update(JSON.stringify(cleaned))
      .digest('hex');
  }

  /**
   * Create backup of current file
   */
  async backupFile(): Promise<void> {
    // Defensive check: ensure file exists before backing up
    if (!await fs.pathExists(this.taskFile)) {
      return;
    }

    const backupDir = path.join(this.contextDir, 'backups');
    await fs.ensureDir(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `current-task.json.backup.${timestamp}`);

    try {
      // Double-check file exists before copying (defensive check)
      if (await fs.pathExists(this.taskFile)) {
        await fs.copy(this.taskFile, backupFile);
      } else {
        // File was deleted between checks, skip backup
        return;
      }
      
      // Keep only last 5 backups
      await this.cleanupOldBackups(backupDir);
    } catch (error) {
      console.warn(`⚠️ Failed to create backup: ${(error as Error).message}`);
      // Non-fatal, continue without backup
    }
  }

  /**
   * Check if backup exists
   */
  private async hasBackup(): Promise<boolean> {
    const backupDir = path.join(this.contextDir, 'backups');
    if (!await fs.pathExists(backupDir)) {
      return false;
    }

    const backups = await fs.readdir(backupDir);
    return backups.some(file => file.startsWith('current-task.json.backup.'));
  }

  /**
   * Rollback from backup
   */
  async rollbackFromBackup(): Promise<void> {
    const backupDir = path.join(this.contextDir, 'backups');
    if (!await fs.pathExists(backupDir)) {
      throw new Error('No backup directory found');
    }

    const backups = await fs.readdir(backupDir);
    const backupFiles = backups
      .filter(file => file.startsWith('current-task.json.backup.'))
      .sort()
      .reverse(); // Most recent first

    if (backupFiles.length === 0) {
      throw new Error('No backup files found');
    }

    // Ensure directory exists before copying
    await fs.ensureDir(this.contextDir);
    
    const latestBackup = path.join(backupDir, backupFiles[0]);
    await fs.copy(latestBackup, this.taskFile);
  }

  /**
   * Cleanup old backups (keep only last 5)
   */
  private async cleanupOldBackups(backupDir: string): Promise<void> {
    const backups = await fs.readdir(backupDir);
    const backupFiles = backups
      .filter(file => file.startsWith('current-task.json.backup.'))
      .sort()
      .reverse(); // Most recent first

    // Keep only last 5 backups
    if (backupFiles.length > 5) {
      const toDelete = backupFiles.slice(5);
      for (const file of toDelete) {
        await fs.remove(path.join(backupDir, file)).catch(() => {});
      }
    }
  }
}

