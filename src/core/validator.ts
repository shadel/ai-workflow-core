/**
 * Validator - Core validation logic for workflow
 * Simplified for Core build (basic quality gates only)
 * @requirement REQ-V2-003 - Validation command
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { Task, WorkflowState } from '@shadel/workflow-core';
import type { PatternValidationResult } from './pattern-provider.js';

/**
 * Validation result
 * @requirement REQ-V2-003 - Validation result structure
 */
export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Complete validation results
 */
export interface CompleteValidationResult {
  workflow: ValidationResult;
  files: ValidationResult;
  overall: boolean;
  patterns?: PatternValidationResult[];
}


/**
 * Cursor verification for a pattern
 */
export interface CursorVerification {
  verified: boolean;
  verifiedAt: string;
  notes?: string;
}

/**
 * Validation results with caching support
 */
export interface ValidationResults {
  timestamp: string;
  taskId: string;
  commitHash?: string;
  results: {
    workflow: ValidationResult;
    files: ValidationResult;
    patterns?: PatternValidationResult[];
  };
  cursorVerified: {
    [patternId: string]: CursorVerification;
  };
  overall: boolean;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  saveToContext?: boolean;
  useCachedResults?: boolean;
}

/**
 * Validator - Basic quality gate checking
 * @requirement REQ-V2-003 - Core validation logic
 */
export class Validator {
  private contextDir = '.ai-context';
  private configDir = 'config';

  /**
   * Validate workflow state
   * @requirement REQ-V2-003 - Workflow state validation
   */
  async validateWorkflow(): Promise<ValidationResult> {
    const taskFile = path.join(this.contextDir, 'current-task.json');

    // Check if task exists
    if (!await fs.pathExists(taskFile)) {
      return {
        passed: false,
        message: 'No active task found',
        details: { suggestion: 'Create a task: npx ai-workflow task create "<goal>"' }
      };
    }

    try {
      const taskData = await fs.readJson(taskFile);
      const state = taskData.workflow?.currentState;

      // Validate state exists
      if (!state) {
        return {
          passed: false,
          message: 'Task has no workflow state',
          details: { taskFile }
        };
      }

      // Valid states
      const validStates: WorkflowState[] = [
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];

      if (!validStates.includes(state)) {
        return {
          passed: false,
          message: `Invalid workflow state: ${state}`,
          details: { validStates }
        };
      }

      return {
        passed: true,
        message: 'Workflow state valid',
        details: {
          currentState: state,
          taskId: taskData.taskId,
          goal: taskData.originalGoal
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Failed to read task file: ${error}`,
        details: { error }
      };
    }
  }

  /**
   * Validate required files exist
   * @requirement REQ-V2-003 - Required files validation
   */
  async validateFiles(): Promise<ValidationResult> {
    const requiredFiles = [
      path.join(this.contextDir, 'current-task.json'),
      path.join(this.contextDir, 'STATUS.txt'),
      path.join(this.contextDir, 'NEXT_STEPS.md')
    ];

    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      if (!await fs.pathExists(file)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      return {
        passed: false,
        message: 'Required context files missing',
        details: { missingFiles }
      };
    }

    return {
      passed: true,
      message: 'All required files present',
      details: { files: requiredFiles }
    };
  }

  /**
   * Run all validations
   * @requirement REQ-V2-003 - Complete validation
   * @requirement CRITICAL-FIX - Enforce READY_TO_COMMIT state
   */
  async validateAll(options?: ValidationOptions): Promise<CompleteValidationResult> {
    // Check if we should use cached results
    if (options?.useCachedResults) {
      const cached = await this.loadValidationResults();
      if (cached && !(await this.isResultsStale(cached))) {
        // Apply Cursor verifications to cached results
        // cached.results is CompleteValidationResult, ensure it has overall
        const cachedResults: CompleteValidationResult = {
          ...cached.results,
          overall: cached.overall
        };
        const verified = await this.applyCursorVerifications(cachedResults);
        return verified;
      }
    }

    // Run fresh validation
    const workflow = await this.validateWorkflow();
    const files = await this.validateFiles();

    // Get pattern violations if task exists
    let patterns: PatternValidationResult[] = [];
    try {
      const taskFile = path.join(this.contextDir, 'current-task.json');
      if (await fs.pathExists(taskFile)) {
        const taskData = await fs.readJson(taskFile);
        const { PatternProvider } = await import('./pattern-provider.js');
        const { TaskManager } = await import('./task-manager.js');
        
        const taskManager = new TaskManager();
        const task = await taskManager.getCurrentTask();
        
        if (task) {
          const patternProvider = new PatternProvider();
          patterns = await patternProvider.validateStatePatterns(
            task.status as WorkflowState,
            { task }
          );
        }
      }
    } catch (error) {
      // If pattern validation fails, continue without patterns
      // This ensures backward compatibility
    }

    let overall = workflow.passed && files.passed;
    
    // CRITICAL: Check if at READY_TO_COMMIT state before allowing commit
    if (overall) {
      const taskFile = path.join(this.contextDir, 'current-task.json');
      if (await fs.pathExists(taskFile)) {
        const taskData = await fs.readJson(taskFile);
        const currentState = taskData.workflow?.currentState;
        
        if (currentState !== 'READY_TO_COMMIT') {
          return {
            workflow: {
              passed: false,
              message: `Cannot commit at ${currentState} state. Must be at READY_TO_COMMIT.`,
              details: {
                currentState,
                requiredState: 'READY_TO_COMMIT',
                suggestion: `Progress through workflow states to READY_TO_COMMIT before committing.
Current: ${currentState}
Required: READY_TO_COMMIT

Next steps based on current state:
${this.getNextStepsForState(currentState)}`
              }
            },
            files,
            patterns,
            overall: false
          };
        }
      }
    }

    const results: CompleteValidationResult = {
      workflow,
      files,
      patterns,
      overall
    };

    // Apply Cursor verifications if available
    const verified = await this.applyCursorVerifications(results);

    // Save to context if requested
    if (options?.saveToContext) {
      await this.saveValidationResults(verified);
    }

    return verified;
  }
  
  /**
   * Get next steps based on current state
   * @requirement CRITICAL-FIX - State progression guidance
   */
  private getNextStepsForState(state: string): string {
    const guidance: Record<string, string> = {
      'UNDERSTANDING': '1. Complete requirements understanding\n2. Design the solution\n3. Sync to DESIGNING',
      'DESIGNING': '1. Implement the design\n2. Write the code\n3. Sync to IMPLEMENTING',
      'IMPLEMENTING': '1. Write tests (MANDATORY!)\n2. Ensure tests pass\n3. Sync to TESTING',
      'TESTING': '1. Review code quality\n2. Check requirements met\n3. Sync to REVIEWING',
      'REVIEWING': '1. Run validation\n2. Fix any issues\n3. Sync to READY_TO_COMMIT'
    };
    
    return guidance[state] || 'Progress to next workflow state';
  }

  /**
   * Check if ready to commit
   * @requirement REQ-V2-003 - Commit readiness check
   */
  async isReadyToCommit(): Promise<boolean> {
    const results = await this.validateAll();

    if (!results.overall) {
      return false;
    }

    // Check if at READY_TO_COMMIT state
    const taskFile = path.join(this.contextDir, 'current-task.json');
    if (!await fs.pathExists(taskFile)) {
      return false;
    }

    const taskData = await fs.readJson(taskFile);
    return taskData.workflow?.currentState === 'READY_TO_COMMIT';
  }

  /**
   * Save validation results to context
   */
  async saveValidationResults(results: CompleteValidationResult): Promise<void> {
    const resultsFile = path.join(this.contextDir, 'validation-results.json');
    
    // Get current task and commit hash
    let taskId = '';
    let commitHash: string | undefined;
    
    try {
      const taskFile = path.join(this.contextDir, 'current-task.json');
      if (await fs.pathExists(taskFile)) {
        const taskData = await fs.readJson(taskFile);
        taskId = taskData.taskId || '';
      }
    } catch (error) {
      // Ignore errors
    }

    try {
      commitHash = this.getCurrentCommitHash();
    } catch (error) {
      // Ignore errors if not a git repo
    }

    const validationResults: ValidationResults = {
      timestamp: new Date().toISOString(),
      taskId,
      commitHash,
      results: results,
      cursorVerified: await this.loadCursorVerifications(),
      overall: results.overall
    };

    await fs.writeJson(resultsFile, validationResults, { spaces: 2 });
  }

  /**
   * Load validation results from context
   */
  async loadValidationResults(): Promise<ValidationResults | null> {
    const resultsFile = path.join(this.contextDir, 'validation-results.json');
    
    if (!await fs.pathExists(resultsFile)) {
      return null;
    }

    try {
      return await fs.readJson(resultsFile);
    } catch (error) {
      return null;
    }
  }

  /**
   * Load Cursor verifications from validation results
   */
  private async loadCursorVerifications(): Promise<{ [patternId: string]: CursorVerification }> {
    const cached = await this.loadValidationResults();
    return cached?.cursorVerified || {};
  }

  /**
   * Apply Cursor verifications to validation results
   */
  /**
   * Normalize pattern identifier for matching
   * Supports multiple formats: pattern ID, pattern title, check name
   */
  private normalizePatternId(identifier: string): string {
    return identifier.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Find verification for a pattern using multiple matching strategies
   */
  private findVerification(
    pattern: PatternValidationResult['pattern'],
    cursorVerified: { [patternId: string]: CursorVerification }
  ): CursorVerification | null {
    // Strategy 1: Exact pattern ID match
    if (cursorVerified[pattern.id]) {
      return cursorVerified[pattern.id];
    }

    // Strategy 2: Normalized pattern ID match
    const normalizedId = this.normalizePatternId(pattern.id);
    for (const [key, verification] of Object.entries(cursorVerified)) {
      if (this.normalizePatternId(key) === normalizedId) {
        return verification;
      }
    }

    // Strategy 3: Pattern title match (normalized)
    const normalizedTitle = this.normalizePatternId(pattern.title);
    for (const [key, verification] of Object.entries(cursorVerified)) {
      if (this.normalizePatternId(key) === normalizedTitle) {
        return verification;
      }
    }

    // Strategy 4: Check name match (from validation.rule)
    const checkName = pattern.validation?.rule || '';
    if (checkName) {
      const normalizedCheck = this.normalizePatternId(checkName);
      for (const [key, verification] of Object.entries(cursorVerified)) {
        if (this.normalizePatternId(key) === normalizedCheck) {
          return verification;
        }
      }
    }

    return null;
  }

  async applyCursorVerifications(results: CompleteValidationResult): Promise<CompleteValidationResult> {
    const cursorVerified = await this.loadCursorVerifications();
    
    if (!results.patterns || Object.keys(cursorVerified).length === 0) {
      return results;
    }

    // Override pattern results with Cursor verifications
    const updatedPatterns = results.patterns.map(patternResult => {
      const verification = this.findVerification(patternResult.pattern, cursorVerified);
      
      if (verification?.verified && !patternResult.passed) {
        // Cursor verified this pattern, override the result
        return {
          ...patternResult,
          passed: true,
          message: `Verified by Cursor: ${verification.notes || 'OK'}`
        };
      }
      
      return patternResult;
    });

    // Recalculate overall status
    // Only error severity violations block commit
    const errorViolations = updatedPatterns.filter(
      p => !p.passed && p.severity === 'error'
    );

    const overall = results.workflow.passed && 
                   results.files.passed && 
                   errorViolations.length === 0;

    return {
      ...results,
      patterns: updatedPatterns,
      overall
    };
  }

  /**
   * Check if validation results are stale
   * Relaxed for results with Cursor verifications (preserve verifications)
   */
  async isResultsStale(results: ValidationResults): Promise<boolean> {
    const hasVerifications = Object.keys(results.cursorVerified || {}).length > 0;
    
    // Check if commit hash changed
    try {
      const currentHash = this.getCurrentCommitHash();
      if (results.commitHash && currentHash !== results.commitHash) {
        // If has verifications, only mark stale if task also changed
        // This preserves verifications across commits for same task
        if (hasVerifications) {
          // Check if task changed - if same task, keep verifications
          try {
            const taskFile = path.join(this.contextDir, 'current-task.json');
            if (await fs.pathExists(taskFile)) {
              const taskData = await fs.readJson(taskFile);
              if (results.taskId && taskData.taskId === results.taskId) {
                // Same task, same verifications - don't mark stale
                return false;
              }
            }
          } catch (error) {
            // Ignore errors
          }
        }
        return true;
      }
    } catch (error) {
      // If not a git repo, skip commit hash check
    }

    // Check if task changed
    try {
      const taskFile = path.join(this.contextDir, 'current-task.json');
      if (await fs.pathExists(taskFile)) {
        const taskData = await fs.readJson(taskFile);
        if (results.taskId && taskData.taskId !== results.taskId) {
          return true;
        }
      } else if (results.taskId) {
        // Task file doesn't exist but results have taskId
        return true;
      }
    } catch (error) {
      // Ignore errors
    }

    // Check timestamp (invalidate after 30 minutes)
    // If has verifications, extend to 2 hours (preserve verifications longer)
    const maxAge = hasVerifications ? 2 * 60 * 60 * 1000 : 30 * 60 * 1000; // 2 hours vs 30 minutes
    const age = Date.now() - new Date(results.timestamp).getTime();
    if (age > maxAge) {
      return true;
    }

    return false;
  }

  /**
   * Get current git commit hash
   */
  private getCurrentCommitHash(): string | undefined {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Verify a pattern (mark as verified by Cursor)
   */
  async verifyPattern(patternId: string, notes?: string): Promise<void> {
    const cached = await this.loadValidationResults();
    
    const verification: CursorVerification = {
      verified: true,
      verifiedAt: new Date().toISOString(),
      notes
    };

    const cursorVerified = cached?.cursorVerified || {};
    cursorVerified[patternId] = verification;

    // Update cached results if they exist
    if (cached) {
      cached.cursorVerified = cursorVerified;
      cached.timestamp = new Date().toISOString();
      
      const resultsFile = path.join(this.contextDir, 'validation-results.json');
      await fs.writeJson(resultsFile, cached, { spaces: 2 });
    } else {
      // Create new validation results with just the verification
      const resultsFile = path.join(this.contextDir, 'validation-results.json');
      let taskId = '';
      try {
        const taskFile = path.join(this.contextDir, 'current-task.json');
        if (await fs.pathExists(taskFile)) {
          const taskData = await fs.readJson(taskFile);
          taskId = taskData.taskId || '';
        }
      } catch (error) {
        // Ignore errors
      }

      const newResults: ValidationResults = {
        timestamp: new Date().toISOString(),
        taskId,
        commitHash: this.getCurrentCommitHash(),
        results: {
          workflow: { passed: false, message: 'No validation run yet' },
          files: { passed: false, message: 'No validation run yet' }
        },
        cursorVerified,
        overall: false
      };

      await fs.writeJson(resultsFile, newResults, { spaces: 2 });
    }
  }
}

