/**
 * Validator - Core validation logic for workflow
 * Simplified for Core build (basic quality gates only)
 * @requirement REQ-V2-003 - Validation command
 */

import fs from 'fs-extra';
import path from 'path';
import { Task, WorkflowState } from '@shadel/workflow-core';

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
  async validateAll(): Promise<CompleteValidationResult> {
    const workflow = await this.validateWorkflow();
    const files = await this.validateFiles();

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
            overall: false
          };
        }
      }
    }

    return {
      workflow,
      files,
      overall
    };
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
}

