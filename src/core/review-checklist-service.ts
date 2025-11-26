/**
 * Review Checklist Service - Centralized review checklist logic
 * 
 * REFACTORED: Extracted from TaskManager review checklist methods for Phase 5.
 * Handles checklist initialization, validation, persistence, and loading.
 * 
 * @internal
 * @requirement REFACTOR-EXTRACT-REVIEW-CHECKLIST-SERVICE - Phase 5: Extract Review Checklist Service
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import { TaskQueueManager } from './task-queue.js';
import { TaskFileSync } from './task-file-sync.js';

/**
 * Review Checklist Service
 * 
 * Centralizes review checklist logic with initialization, validation, persistence, and loading.
 */
export class ReviewChecklistService {
  private queueManager: TaskQueueManager;
  private fileSync: TaskFileSync;
  private taskFile: string;

  constructor(
    queueManager: TaskQueueManager,
    fileSync: TaskFileSync,
    taskFile: string
  ) {
    this.queueManager = queueManager;
    this.fileSync = fileSync;
    this.taskFile = taskFile;
  }

  /**
   * Initialize review checklist when entering REVIEWING state
   * Auto-runs validation as first checklist item
   * Enhanced with comprehensive checks
   */
  async initializeReviewChecklist(): Promise<void> {
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
  async validateReviewChecklistComplete(): Promise<void> {
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
  async saveReviewChecklist(checklist: any): Promise<void> {
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
  async loadReviewChecklist(): Promise<any | null> {
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
}



