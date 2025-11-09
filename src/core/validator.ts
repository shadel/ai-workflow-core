/**
 * Validator - Core validation logic for workflow
 * Simplified for Core build (basic quality gates only)
 * @requirement REQ-V2-003 - Validation command
 */

import fs from 'fs-extra';
import path from 'path';
import { Task, WorkflowState } from '@workflow/core';

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
        'DESIGN_COMPLETE',
        'IMPLEMENTATION_COMPLETE',
        'TESTING_COMPLETE',
        'REVIEW_COMPLETE',
        'COMMIT_READY'
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
      '.ai-context/current-task.json',
      '.ai-context/STATUS.txt',
      '.ai-context/NEXT_STEPS.md'
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
   */
  async validateAll(): Promise<CompleteValidationResult> {
    const workflow = await this.validateWorkflow();
    const files = await this.validateFiles();

    const overall = workflow.passed && files.passed;

    return {
      workflow,
      files,
      overall
    };
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

    // Check if at COMMIT_READY state
    const taskFile = path.join(this.contextDir, 'current-task.json');
    if (!await fs.pathExists(taskFile)) {
      return false;
    }

    const taskData = await fs.readJson(taskFile);
    return taskData.workflow?.currentState === 'COMMIT_READY';
  }
}

