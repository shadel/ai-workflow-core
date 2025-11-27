/**
 * State Checklist Service - Centralized state checklist logic for all workflow states
 * 
 * Phase 1.2: Extended from ReviewChecklistService to support all 6 workflow states.
 * Handles checklist initialization, validation, persistence, and loading for any state.
 * 
 * @internal
 * @requirement Dynamic State Checklists - Phase 1.2
 */

import fs from 'fs-extra';
import chalk from 'chalk';
import { WorkflowState } from '@shadel/workflow-core';
import { TaskQueueManager } from './task-queue.js';
import { TaskFileSync } from './task-file-sync.js';
import { ChecklistRegistry } from './checklist-registry.js';
import { getAllStateChecklistItems, getStateChecklistItems } from './state-checklist-items.js';
import { PatternProvider } from './pattern-provider.js';
import { StateChecklistIncompleteError } from './state-checklist-incomplete-error.js';
import { PatternChecklistGenerator } from './pattern-checklist-generator.js';
import { PatternVerificationService } from './pattern-verification-service.js';

/**
 * State Checklist structure (generalized from ReviewChecklist)
 */
export interface StateChecklist {
  items: StateChecklistItem[];
  completedAt?: string;
  validationResult?: any; // Same as ReviewChecklist validationResult
}

/**
 * Checklist Evidence structure
 */
export interface ChecklistEvidence {
  type: 'file_created' | 'file_modified' | 'command_run' | 'test_passed' | 'validation_passed' | 'manual' | 'other';
  description: string;
  files?: string[];  // For file-based evidence
  command?: string;  // For command-based evidence
  output?: string;   // For command output
  testResults?: {    // For test-based evidence
    passed: number;
    failed: number;
    total: number;
  };
  validationResults?: any;  // For validation-based evidence
  manualNotes?: string;     // For manual evidence
  timestamp: string;
  verified?: boolean;        // Whether evidence was verified
}

/**
 * State Checklist Item (generalized from ReviewChecklistItem)
 */
export interface StateChecklistItem {
  id: string;
  title: string;
  description: string;
  required?: boolean;
  priority?: 'high' | 'medium' | 'low';
  completed: boolean;
  completedAt?: string;
  notes?: string;
  evidence?: ChecklistEvidence;  // Evidence for completion
  evidenceRequired?: boolean;    // Whether evidence is mandatory for this item
}

/**
 * State Checklist Service
 * 
 * Centralizes checklist logic for all workflow states with initialization,
 * validation, persistence, and loading.
 */
export class StateChecklistService {
  private queueManager: TaskQueueManager;
  private fileSync: TaskFileSync;
  private taskFile: string;
  private registry: ChecklistRegistry;
  private patternProvider: PatternProvider | null = null;
  private patternChecklistGenerator: PatternChecklistGenerator | null = null;
  private patternVerificationService: PatternVerificationService | null = null;

  constructor(
    queueManager: TaskQueueManager,
    fileSync: TaskFileSync,
    taskFile: string,
    registry?: ChecklistRegistry,
    patternProvider?: PatternProvider
  ) {
    this.queueManager = queueManager;
    this.fileSync = fileSync;
    this.taskFile = taskFile;
    
    // Initialize registry (create new if not provided)
    this.registry = registry || new ChecklistRegistry();
    
    // Register default state checklist items
    // Phase 1.4: Register default checklists via registry method
    this.registry.registerDefaultChecklists();
    
    // Also register items directly as fallback (for immediate availability)
    const defaultItems = getAllStateChecklistItems();
    this.registry.registerItems(defaultItems);
    
    // Store pattern provider (optional, for Phase 2)
    if (patternProvider) {
      this.patternProvider = patternProvider;
      // Initialize pattern checklist generator and verification service
      this.patternChecklistGenerator = new PatternChecklistGenerator();
      this.patternVerificationService = new PatternVerificationService();
    }
  }

  /**
   * Initialize state checklist when entering a state
   * Generalized from initializeReviewChecklist to work for all states
   * Phase 2.3: Enhanced with pattern checklist integration
   */
  async initializeStateChecklist(state: WorkflowState): Promise<void> {
    // Get checklist items for this state from registry
    const activeTask = await this.queueManager.getActiveTask();
    // Get full task from queue for extended properties
    const queue = await (this.queueManager as any).loadQueue();
    const queueTask = queue?.tasks?.find((t: any) => t.id === activeTask?.id);
    const context = {
      state,
      goal: activeTask?.goal,
      patterns: queueTask?.patterns,
      roles: queueTask?.roles,
      tags: queueTask?.tags || activeTask?.tags
    };
    
    const items = this.registry.getChecklistsForContext(context);
    
    // Phase 2.3: Get pattern-based checklist items
    let patternItems: StateChecklistItem[] = [];
    if (this.patternProvider && this.patternChecklistGenerator) {
      try {
        const patterns = await this.patternProvider.getPatternsForState(state);
        const allPatterns = [...patterns.mandatory, ...patterns.recommended];
        const patternChecklistItems = this.patternChecklistGenerator.generateChecklistItems(allPatterns);
        
        // Convert PatternChecklistItem to StateChecklistItem
        patternItems = patternChecklistItems.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          required: item.required ?? false,
          priority: item.priority ?? 'medium',
          completed: false
        }));
        
        // Register pattern items in registry
        this.registry.registerItems(patternChecklistItems);
      } catch (error) {
        // If pattern loading fails, continue without pattern items (graceful degradation)
        console.warn(`⚠️  Warning: Failed to load pattern checklists: ${(error as Error).message}`);
      }
    }
    
    // Convert ChecklistItem to StateChecklistItem
    const stateChecklistItems: StateChecklistItem[] = items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      required: item.required ?? false,
      priority: item.priority ?? 'medium',
      completed: false
    }));
    
    // Combine state items and pattern items
    const checklistItems = [...stateChecklistItems, ...patternItems];
    
    const checklist: StateChecklist = {
      items: checklistItems
    };
    
    // State-specific initialization logic
    if (state === 'REVIEWING') {
      // For REVIEWING state, use existing ReviewChecklistManager logic
      await this.initializeReviewChecklistInternal();
      return;
    }
    
    // For other states, create and save basic checklist
    await this.saveStateChecklist(checklist, state);
    
    // Display checklist status (skip in test mode to reduce console output)
    if (process.env.NODE_ENV !== 'test' && process.env.SKIP_CHECKLIST_DISPLAY !== 'true') {
      console.log(chalk.cyan(`\n📋 Entering ${state} State\n`));
      this.displayChecklist(checklist, state);
    }
  }

  /**
   * Validate that state checklist is complete before allowing transition
   * Generalized from validateReviewChecklistComplete to work for all states
   */
  async validateStateChecklistComplete(state: WorkflowState): Promise<void> {
    // Skip checklist validation in test mode (allows tests to focus on their specific functionality)
    // Unless explicitly enabled for tests that need to test validation behavior
    if ((process.env.NODE_ENV === 'test' || process.env.SKIP_CHECKLIST_VALIDATION === 'true') 
        && process.env.ENABLE_CHECKLIST_VALIDATION !== 'true') {
      return;
    }
    
    // For READY_TO_COMMIT state, use existing validation logic
    if (state === 'READY_TO_COMMIT') {
      // Check REVIEWING checklist completion (backward compatibility)
      const reviewingChecklist = await this.loadStateChecklist('REVIEWING');
      if (!reviewingChecklist) {
        throw new Error(
          'Review checklist not found. You must complete REVIEWING state first.\n\n' +
          'Run: npx ai-workflow sync --state REVIEWING'
        );
      }
      
      const incompleteRequired = reviewingChecklist.items.filter(
        item => item.required && !item.completed
      );
      
      if (incompleteRequired.length > 0) {
        const percentage = Math.round(
          (reviewingChecklist.items.filter(i => i.completed).length / reviewingChecklist.items.length) * 100
        );
        
        console.log(chalk.red('\n❌ Review checklist incomplete!\n'));
        this.displayChecklist(reviewingChecklist, 'REVIEWING');
        
        throw new Error(
          `Cannot proceed to READY_TO_COMMIT: Review checklist is ${percentage}% complete.\n\n` +
          `Completed: ${reviewingChecklist.items.filter(i => i.completed).length}/${reviewingChecklist.items.length} items\n\n` +
          `Please complete all required checklist items before proceeding.`
        );
      }
      
      return;
    }
    
    // For other states, check if required items are complete
    const checklist = await this.loadStateChecklist(state);
    if (!checklist) {
      // Checklist not found - this is OK for non-REVIEWING states (initialization may have failed)
      // Only warn, don't block
      return;
    }
    
    const incompleteRequired = checklist.items.filter(
      item => item.required && !item.completed
    );
    
    if (incompleteRequired.length > 0) {
      // Use StateChecklistIncompleteError for consistent error handling
      const incompleteItems = incompleteRequired.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description
      }));
      
      throw new StateChecklistIncompleteError(state, incompleteItems);
    }
  }

  /**
   * Save state checklist to task
   * Generalized from saveReviewChecklist to work for all states
   */
  async saveStateChecklist(checklist: StateChecklist, state: WorkflowState): Promise<void> {
    const activeTask = await this.queueManager.getActiveTask();
    
    if (!activeTask) {
      throw new Error('No active task to save checklist to');
    }
    
    try {
      // Save to queue
      const queue = await (this.queueManager as any).loadQueue();
      const queueTask = queue.tasks.find((t: any) => t.id === activeTask.id);
      if (queueTask) {
        // For REVIEWING state, maintain backward compatibility with reviewChecklist schema
        if (state === 'REVIEWING') {
          queueTask.reviewChecklist = checklist;
        } else {
          // For other states, use stateChecklists object
          if (!queueTask.stateChecklists) {
            queueTask.stateChecklists = {};
          }
          queueTask.stateChecklists[state] = checklist;
        }
        await (this.queueManager as any).saveQueue(queue);
      }
    } catch (error) {
      console.warn('Warning: Failed to save checklist to queue:', (error as Error).message);
    }
    
    // Sync to file - use queueTask (has stateChecklists) instead of activeTask
    const queue = await (this.queueManager as any).loadQueue();
    const queueTaskForSync = queue.tasks.find((t: any) => t.id === activeTask.id);
    if (queueTaskForSync) {
      await this.fileSync.syncFromQueue(queueTaskForSync, {
        preserveFields: ['requirements'],
        backup: true
      });
    } else {
      // Fallback: sync with activeTask if queueTask not found
      await this.fileSync.syncFromQueue(activeTask, {
        preserveFields: ['requirements'],
        backup: true
      });
    }
    
    if (process.env.DEBUG) {
      console.log(`✅ ${state} checklist saved and synced successfully`);
    }
  }

  /**
   * Load state checklist from task
   * Generalized from loadReviewChecklist to work for all states
   * Phase 2: Added lazy initialization for early states (UNDERSTANDING, DESIGNING)
   */
  async loadStateChecklist(state: WorkflowState): Promise<StateChecklist | null> {
    // Try to load existing checklist
    const existing = await this.tryLoadExistingChecklist(state);
    if (existing) {
      return existing;
    }
    
    // If no checklist exists, initialize it (lazy initialization)
    // This is especially important for UNDERSTANDING state (first state)
    try {
      // Only auto-initialize for early states (UNDERSTANDING, DESIGNING)
      // Later states should be initialized via state transition
      if (state === 'UNDERSTANDING' || state === 'DESIGNING') {
        await this.initializeStateChecklist(state);
        // Try loading again after initialization
        return await this.tryLoadExistingChecklist(state);
      }
    } catch (error) {
      // If initialization fails, return null (graceful degradation)
      console.warn(`⚠️  Warning: Failed to auto-initialize checklist for ${state}: ${(error as Error).message}`);
    }
    
    return null;
  }

  /**
   * Helper method to try loading existing checklist
   * Extracted from current loadStateChecklist() implementation
   * Phase 2: Refactored for lazy initialization support
   */
  private async tryLoadExistingChecklist(state: WorkflowState): Promise<StateChecklist | null> {
    try {
      const activeTask = await this.queueManager.getActiveTask();
      
      if (activeTask) {
        // For REVIEWING state, check reviewChecklist first (backward compatibility)
        if (state === 'REVIEWING' && (activeTask as any).reviewChecklist) {
          return (activeTask as any).reviewChecklist;
        }
        
        // Check stateChecklists object
        if ((activeTask as any).stateChecklists && (activeTask as any).stateChecklists[state]) {
          return (activeTask as any).stateChecklists[state];
        }
      }
    } catch (error) {
      // If queue load fails, continue to check current-task.json
    }
    
    // Fallback to current-task.json
    try {
      if (await fs.pathExists(this.taskFile)) {
        const taskData = await fs.readJson(this.taskFile);
        
        // Phase 4.2: Auto-migrate old reviewChecklist to new schema
        if (state === 'REVIEWING' && taskData.reviewChecklist && !taskData.stateChecklists) {
          // Auto-migrate: copy reviewChecklist to stateChecklists.REVIEWING
          if (!taskData.stateChecklists) {
            taskData.stateChecklists = {};
          }
          taskData.stateChecklists.REVIEWING = taskData.reviewChecklist;
          
          // Save migrated data (async, don't wait)
          this.saveMigratedChecklist(taskData).catch(err => {
            console.warn(`⚠️  Warning: Failed to save migrated checklist: ${err.message}`);
          });
          
          return taskData.reviewChecklist;
        }
        
        // For REVIEWING state, check reviewChecklist first (backward compatibility)
        if (state === 'REVIEWING' && taskData.reviewChecklist) {
          return taskData.reviewChecklist;
        }
        
        // Check stateChecklists object
        if (taskData.stateChecklists && taskData.stateChecklists[state]) {
          return taskData.stateChecklists[state];
        }
      }
    } catch (error) {
      // If file read fails, return null
    }
    
    return null;
  }

  /**
   * Save migrated checklist data (helper for auto-migration)
   * Phase 4.2: Preserve migrated data
   */
  private async saveMigratedChecklist(taskData: any): Promise<void> {
    try {
      // Use queue manager to update task
      const activeTask = await this.queueManager.getActiveTask();
      if (activeTask && activeTask.id === taskData.taskId) {
        // Update queue task via load/save pattern
        const queue = await (this.queueManager as any).loadQueue();
        const queueTask = queue?.tasks?.find((t: any) => t.id === activeTask.id);
        if (queueTask) {
          queueTask.stateChecklists = taskData.stateChecklists;
          await (this.queueManager as any).saveQueue(queue);
        }
        
        // Sync to file using fileSync
        const queueAfterUpdate = await (this.queueManager as any).loadQueue();
        const updatedQueueTask = queueAfterUpdate?.tasks?.find((t: any) => t.id === activeTask.id);
        if (updatedQueueTask) {
          await this.fileSync.syncFromQueue(updatedQueueTask, {
            preserveFields: ['requirements'],
            backup: true
          });
        }
      } else {
        // No queue task, update file directly
        await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
      }
    } catch (error) {
      // Migration save failed - log but don't throw (backward compatible)
      console.warn(`⚠️  Warning: Failed to save migrated checklist: ${(error as Error).message}`);
    }
  }

  /**
   * Mark a checklist item as complete
   * New method for marking individual items complete
   * @param state - Workflow state
   * @param itemId - Checklist item ID
   * @param evidence - Evidence for completion (required if evidenceRequired is true)
   */
  async markItemComplete(state: WorkflowState, itemId: string, evidence?: ChecklistEvidence): Promise<void> {
    const checklist = await this.loadStateChecklist(state);
    if (!checklist) {
      throw new Error(`No checklist found for state ${state}`);
    }
    
    const item = checklist.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Checklist item ${itemId} not found for state ${state}`);
    }
    
    // Check if evidence is required
    if (item.evidenceRequired && !evidence) {
      throw new Error(
        `Evidence is REQUIRED for checklist item "${item.title}" (${itemId}).\n` +
        `Please provide evidence when marking as complete.\n` +
        `Use: npx ai-workflow checklist check ${itemId} --evidence <type> [options]`
      );
    }
    
    // Validate evidence if provided
    if (evidence) {
      this.validateEvidence(evidence, item);
    }
    
    item.completed = true;
    item.completedAt = new Date().toISOString();
    item.evidence = evidence;
    
    await this.saveStateChecklist(checklist, state);
  }

  /**
   * Validate evidence structure
   */
  private validateEvidence(evidence: ChecklistEvidence, item: StateChecklistItem): void {
    // Basic validation
    if (!evidence.type) {
      throw new Error('Evidence must have a type');
    }
    
    if (!evidence.description) {
      throw new Error('Evidence must have a description');
    }
    
    if (!evidence.timestamp) {
      evidence.timestamp = new Date().toISOString();
    }
    
    // Type-specific validation
    if (evidence.type === 'file_created' || evidence.type === 'file_modified') {
      if (!evidence.files || evidence.files.length === 0) {
        throw new Error('File-based evidence must include files array');
      }
    }
    
    if (evidence.type === 'command_run') {
      if (!evidence.command) {
        throw new Error('Command-based evidence must include command');
      }
    }
    
    if (evidence.type === 'test_passed') {
      if (!evidence.testResults) {
        throw new Error('Test-based evidence must include testResults');
      }
    }
    
    if (evidence.type === 'manual') {
      if (!evidence.manualNotes) {
        throw new Error('Manual evidence must include manualNotes');
      }
    }
  }

  /**
   * Display checklist for a state
   * Enhanced from ReviewChecklistManager.displayChecklist
   */
  displayChecklist(checklist: StateChecklist, state: WorkflowState): void {
    if (checklist.items.length === 0) {
      console.log(chalk.gray('  No checklist items for this state.\n'));
      return;
    }
    
    const required = checklist.items.filter(i => i.required);
    const optional = checklist.items.filter(i => !i.required);
    
    if (required.length > 0) {
      console.log(chalk.cyan('  Required Items:'));
      for (const item of required) {
        const icon = item.completed ? chalk.green('✅') : chalk.gray('☐');
        const priority = item.priority === 'high' ? chalk.red(' [HIGH]') : '';
        console.log(`  ${icon} ${item.title}${priority}`);
        if (item.description) {
          console.log(chalk.gray(`     ${item.description}`));
        }
        // Show item ID so user knows what to use for "checklist check <item-id>"
        console.log(chalk.dim(`     ID: ${item.id}`));
      }
      console.log('');
    }
    
    if (optional.length > 0) {
      console.log(chalk.gray('  Optional Items:'));
      for (const item of optional) {
        const icon = item.completed ? chalk.green('✅') : chalk.gray('☐');
        console.log(`  ${icon} ${item.title}`);
        if (item.description) {
          console.log(chalk.gray(`     ${item.description}`));
        }
        // Show item ID so user knows what to use for "checklist check <item-id>"
        console.log(chalk.dim(`     ID: ${item.id}`));
      }
      console.log('');
    }
    
    const completed = checklist.items.filter(i => i.completed).length;
    const total = checklist.items.length;
    const percentage = Math.round((completed / total) * 100);
    
    console.log(chalk.gray(`  Progress: ${completed}/${total} (${percentage}%)\n`));
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY: Delegate to existing ReviewChecklistService methods
  // ============================================================================

  /**
   * Initialize review checklist (REVIEWING state specific)
   * Used internally by initializeStateChecklist for REVIEWING state
   */
  private async initializeReviewChecklistInternal(): Promise<void> {
    // Import ReviewChecklistManager for REVIEWING state specific logic
    const { ReviewChecklistManager } = await import('./review-checklist.js');
    const checklist = ReviewChecklistManager.createDefaultChecklist();
    
    let updatedChecklist = checklist;
    
    console.log(chalk.cyan('\n📋 Entering REVIEWING State\n'));
    console.log(chalk.gray('This state performs quality review before commit.\n'));
    
    try {
      console.log(chalk.cyan('🔍 Running automated validation...\n'));
      const validationResult = await ReviewChecklistManager.runAutomatedValidation();
      
      if (validationResult.success && validationResult.result) {
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
        }
      } else {
        console.log(chalk.red(`❌ Validation failed: ${validationResult.error || 'Unknown error'}\n`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Validation error: ${(error as Error).message}\n`));
    }
    
    try {
      console.log(chalk.cyan('🔍 Running additional quality checks...\n'));
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
      console.log(chalk.yellow(`⚠️  Some quality checks failed: ${(error as Error).message}\n`));
    }
    
    // Convert ReviewChecklist to StateChecklist format (add title property to items)
    const stateChecklist = this.convertReviewChecklistToStateChecklist(updatedChecklist);
    await this.saveStateChecklist(stateChecklist, 'REVIEWING');
    
    const savedChecklist = await this.loadStateChecklist('REVIEWING');
    if (!savedChecklist) {
      console.warn('⚠️ Warning: Checklist save verification failed, retrying...');
      await this.saveStateChecklist(stateChecklist, 'REVIEWING');
    }
    
    console.log(chalk.cyan('\n📋 Review Checklist Status:\n'));
    ReviewChecklistManager.displayChecklist(updatedChecklist);
    console.log(chalk.gray('\n💡 Complete all checklist items before progressing to READY_TO_COMMIT\n'));
  }

  /**
   * Convert ReviewChecklistItem to StateChecklistItem by adding title property
   */
  private convertReviewChecklistItemToStateChecklistItem(item: any): StateChecklistItem {
    return {
      id: item.id,
      title: item.description, // Use description as title if title doesn't exist
      description: item.description,
      required: item.category === 'automated',
      priority: item.category === 'automated' ? 'high' as const : 'medium' as const,
      completed: item.completed,
      completedAt: item.completedAt,
      notes: item.notes
    };
  }

  /**
   * Convert ReviewChecklist to StateChecklist format
   */
  private convertReviewChecklistToStateChecklist(reviewChecklist: any): StateChecklist {
    return {
      items: reviewChecklist.items.map((item: any) => 
        this.convertReviewChecklistItemToStateChecklistItem(item)
      ),
      completedAt: reviewChecklist.completedAt
    };
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY: Delegate methods for ReviewChecklistService compatibility
  // ============================================================================

  /**
   * @deprecated Use initializeStateChecklist('REVIEWING') instead
   */
  async initializeReviewChecklist(): Promise<void> {
    return this.initializeStateChecklist('REVIEWING');
  }

  /**
   * @deprecated Use validateStateChecklistComplete('REVIEWING') instead
   */
  async validateReviewChecklistComplete(): Promise<void> {
    return this.validateStateChecklistComplete('REVIEWING');
  }

  /**
   * @deprecated Use saveStateChecklist(checklist, 'REVIEWING') instead
   */
  async saveReviewChecklist(checklist: any): Promise<void> {
    return this.saveStateChecklist(checklist, 'REVIEWING');
  }

  /**
   * @deprecated Use loadStateChecklist('REVIEWING') instead
   */
  async loadReviewChecklist(): Promise<any | null> {
    return this.loadStateChecklist('REVIEWING');
  }
}

