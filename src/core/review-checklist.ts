/**
 * Review Checklist Manager - Enforces review process for REVIEWING state
 * @requirement REVIEW-CHECKLIST-001 - Review checklist enforcement
 */

import { Validator, CompleteValidationResult } from './validator.js';
import chalk from 'chalk';

/**
 * Action definition for checklist item
 */
export interface ChecklistAction {
  type: 'command' | 'review' | 'check';
  command?: string;  // For command type
  files?: string[];  // For review type
  checks?: string[];  // For review type
  expected: {
    exitCode?: number;  // For command type
    outputContains?: string[];  // For command type
    result?: string;  // For review/check type
  };
}

/**
 * Review checklist item - Actionable task for Cursor
 */
export interface ReviewChecklistItem {
  id: string;
  description: string;
  category: 'automated' | 'manual';
  completed: boolean;
  completedAt?: string;
  notes?: string;
  // Actionable task metadata
  action: ChecklistAction;
  verifyCommand?: string;  // Command to auto-execute and verify
  checkCommand: string;  // Command to mark complete (only after action done)
}

/**
 * Review checklist structure
 */
export interface ReviewChecklist {
  items: ReviewChecklistItem[];
  completedAt?: string;
  validationResult?: CompleteValidationResult;
}

/**
 * Default review checklist items - Actionable tasks for Cursor
 */
const DEFAULT_CHECKLIST_ITEMS: Omit<ReviewChecklistItem, 'completed' | 'completedAt' | 'notes'>[] = [
  {
    id: 'auto-validation',
    description: 'Run automated validation',
    category: 'automated',
    action: {
      type: 'command',
      command: 'npx ai-workflow validate',
      expected: {
        exitCode: 0,
        outputContains: ['Validation passed', 'All checks pass', 'Overall Status', '✅']
      }
    },
    verifyCommand: 'npx ai-workflow review execute auto-validation',
    checkCommand: 'npx ai-workflow review check auto-validation'
  },
  {
    id: 'code-quality',
    description: 'Review code for quality and style',
    category: 'manual',
    action: {
      type: 'review',
      files: ['src/**/*.ts', 'packages/**/*.ts'],
      checks: ['naming conventions', 'code style', 'error handling', 'function complexity'],
      expected: {
        result: 'Code follows project conventions and style guide'
      }
    },
    checkCommand: 'npx ai-workflow review check code-quality'
  },
  {
    id: 'requirements',
    description: 'Check all requirements are satisfied',
    category: 'manual',
    action: {
      type: 'check',
      checks: ['All requirements implemented', 'Requirements linked to code', 'Requirements tested'],
      expected: {
        result: 'All requirements satisfied and verified'
      }
    },
    checkCommand: 'npx ai-workflow review check requirements'
  },
  {
    id: 'test-coverage',
    description: 'Verify test coverage is adequate',
    category: 'manual',
    action: {
      type: 'check',
      checks: ['Unit tests written', 'Integration tests added', 'Coverage >= 80%', 'Edge cases tested'],
      expected: {
        result: 'Test coverage is adequate (>= 80%)'
      }
    },
    checkCommand: 'npx ai-workflow review check test-coverage'
  },
  {
    id: 'error-handling',
    description: 'Check error handling is comprehensive',
    category: 'manual',
    action: {
      type: 'review',
      files: ['src/**/*.ts', 'packages/**/*.ts'],
      checks: ['Error handling in all functions', 'Meaningful error messages', 'Error recovery mechanisms'],
      expected: {
        result: 'Error handling is comprehensive with meaningful messages'
      }
    },
    checkCommand: 'npx ai-workflow review check error-handling'
  },
  {
    id: 'documentation',
    description: 'Verify documentation is complete',
    category: 'manual',
    action: {
      type: 'check',
      checks: ['Feature documentation updated', 'API documentation complete', 'README updated if needed'],
      expected: {
        result: 'Documentation is complete and up-to-date'
      }
    },
    checkCommand: 'npx ai-workflow review check documentation'
  },
  {
    id: 'security',
    description: 'Check security considerations',
    category: 'manual',
    action: {
      type: 'review',
      files: ['src/**/*.ts', 'packages/**/*.ts'],
      checks: ['Input validation', 'Authentication/authorization', 'Sensitive data handling', 'Security best practices'],
      expected: {
        result: 'Security considerations addressed'
      }
    },
    checkCommand: 'npx ai-workflow review check security'
  }
];

/**
 * Review Checklist Manager
 */
export class ReviewChecklistManager {
  /**
   * Create default review checklist
   */
  static createDefaultChecklist(): ReviewChecklist {
    return {
      items: DEFAULT_CHECKLIST_ITEMS.map(item => ({
        ...item,
        completed: false,
        // Ensure all required fields are present
        action: item.action,
        verifyCommand: item.verifyCommand,
        checkCommand: item.checkCommand
      }))
    };
  }

  /**
   * Migrate old checklist format to new actionable format
   */
  static migrateChecklist(oldChecklist: any): ReviewChecklist {
    // If already in new format, return as is
    if (oldChecklist.items && oldChecklist.items.length > 0 && oldChecklist.items[0].action) {
      return oldChecklist;
    }

    // Migrate old format to new format
    const defaultChecklist = this.createDefaultChecklist();
    const migratedItems = defaultChecklist.items.map(defaultItem => {
      // Try to find matching old item by id
      const oldItem = oldChecklist.items?.find((i: any) => i.id === defaultItem.id);
      if (oldItem) {
        return {
          ...defaultItem,
          completed: oldItem.completed || false,
          completedAt: oldItem.completedAt,
          notes: oldItem.notes
        };
      }
      return defaultItem;
    });

    return {
      items: migratedItems,
      completedAt: oldChecklist.completedAt,
      validationResult: oldChecklist.validationResult
    };
  }

  /**
   * Run automated validation and mark item complete
   */
  static async runAutomatedValidation(): Promise<{
    success: boolean;
    result?: CompleteValidationResult;
    error?: string;
  }> {
    try {
      const validator = new Validator();
      const result = await validator.validateAll();
      
      if (result.overall) {
        return {
          success: true,
          result
        };
      } else {
        // Validation failed but didn't throw - include error message
        const errorMessages: string[] = [];
        if (!result.files.passed) {
          errorMessages.push(result.files.message);
        }
        if (!result.workflow.passed) {
          errorMessages.push(result.workflow.message);
        }
        
        return {
          success: false,
          result,
          error: errorMessages.join('; ') || 'Validation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute action for a checklist item and verify result
   * Returns true if action passed and item can be marked complete
   */
  static async executeItemAction(item: ReviewChecklistItem): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    canMarkComplete: boolean;
  }> {
    if (item.action.type === 'command' && item.action.command) {
      try {
        const { execSync } = await import('child_process');
        let output = '';
        let exitCode = 0;
        
        try {
          output = execSync(item.action.command, { 
            encoding: 'utf-8',
            stdio: 'pipe'
          }).toString();
          exitCode = 0; // execSync throws on non-zero, so if we're here, it's 0
        } catch (error: any) {
          // execSync throws on non-zero exit code
          output = error.stdout?.toString() || error.message || '';
          exitCode = error.status || error.code || 1;
        }
        
        // Check expected exit code
        if (item.action.expected.exitCode !== undefined && exitCode !== item.action.expected.exitCode) {
          return {
            success: false,
            output,
            error: `Expected exit code ${item.action.expected.exitCode}, got ${exitCode}`,
            canMarkComplete: false
          };
        }
        
        // Check expected output contains (only if exit code matches)
        // Note: For validation command, we check if output contains success indicators
        // even if exit code is non-zero (validation might fail but still provide useful output)
        if (item.action.expected.outputContains) {
          const anyFound = item.action.expected.outputContains.some(pattern => 
            output.includes(pattern)
          );
          // If exit code matches expected, output check is required
          // If exit code doesn't match, we still check output but it's less critical
          if (exitCode === (item.action.expected.exitCode ?? 0) && !anyFound) {
            return {
              success: false,
              output,
              error: `Expected output to contain one of: ${item.action.expected.outputContains.join(', ')}`,
              canMarkComplete: false
            };
          }
        }
        
        // If exit code doesn't match expected, it's a failure
        if (exitCode !== (item.action.expected.exitCode ?? 0)) {
          return {
            success: false,
            output,
            error: `Command failed with exit code ${exitCode}`,
            canMarkComplete: false
          };
        }
        
        return {
          success: true,
          output,
          canMarkComplete: true
        };
      } catch (error: any) {
        return {
          success: false,
          error: (error as Error).message,
          canMarkComplete: false
        };
      }
    }
    
    // For manual review/check types, return success but require manual check
    // Cursor must perform the review manually, then call check command
    return {
      success: true,
      canMarkComplete: false  // Manual items require explicit check
    };
  }

  /**
   * Get checklist as JSON for Cursor parsing
   */
  static toJSON(checklist: ReviewChecklist): any {
    return {
      progress: {
        completed: checklist.items.filter(item => item.completed).length,
        total: checklist.items.length,
        percentage: this.getCompletionPercentage(checklist)
      },
      items: checklist.items.map(item => ({
        id: item.id,
        description: item.description,
        category: item.category,
        completed: item.completed,
        completedAt: item.completedAt,
        notes: item.notes,
        action: item.action,
        verifyCommand: item.verifyCommand,
        checkCommand: item.checkCommand
      }))
    };
  }

  /**
   * Check if checklist is complete
   */
  static isChecklistComplete(checklist: ReviewChecklist): boolean {
    return checklist.items.every(item => item.completed);
  }

  /**
   * Mark checklist item as complete
   */
  static markItemComplete(
    checklist: ReviewChecklist,
    itemId: string,
    notes?: string
  ): ReviewChecklist {
    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: true,
          completedAt: new Date().toISOString(),
          notes
        };
      }
      return item;
    });

    const allComplete = updatedItems.every(item => item.completed);
    
    return {
      ...checklist,
      items: updatedItems,
      completedAt: allComplete ? new Date().toISOString() : undefined
    };
  }

  /**
   * Get checklist completion percentage
   */
  static getCompletionPercentage(checklist: ReviewChecklist): number {
    if (checklist.items.length === 0) return 100;
    const completed = checklist.items.filter(item => item.completed).length;
    return Math.round((completed / checklist.items.length) * 100);
  }

  /**
   * Display checklist status - Actionable format for Cursor
   */
  static displayChecklist(checklist: ReviewChecklist): void {
    const percentage = this.getCompletionPercentage(checklist);
    const completed = checklist.items.filter(item => item.completed).length;
    const total = checklist.items.length;

    console.log(chalk.bold('\n📋 Review Checklist Status'));
    console.log(chalk.gray(`Progress: ${completed}/${total} (${percentage}%)\n`));

    for (const item of checklist.items) {
      const icon = item.completed ? chalk.green('✅') : chalk.yellow('⏳');
      const category = item.category === 'automated' 
        ? chalk.cyan('[AUTO]')
        : chalk.blue('[MANUAL]');
      
      console.log(`${icon} ${category} ${chalk.bold(item.description)}`);
      
      // Show action for incomplete items
      if (!item.completed) {
        if (item.action.type === 'command' && item.action.command) {
          console.log(chalk.gray(`   Action: ${chalk.cyan(item.action.command)}`));
          if (item.action.expected.exitCode !== undefined) {
            console.log(chalk.gray(`   Expected: Exit code ${item.action.expected.exitCode}`));
          }
          if (item.verifyCommand) {
            console.log(chalk.gray(`   Verify: ${chalk.cyan(item.verifyCommand)}`));
          }
        } else if (item.action.type === 'review' || item.action.type === 'check') {
          if (item.action.files) {
            console.log(chalk.gray(`   Action: Review files: ${item.action.files.join(', ')}`));
          }
          if (item.action.checks) {
            console.log(chalk.gray(`   Checks: ${item.action.checks.join(', ')}`));
          }
          if (item.action.expected.result) {
            console.log(chalk.gray(`   Expected: ${item.action.expected.result}`));
          }
        }
        console.log(chalk.gray(`   After completion: ${chalk.cyan(item.checkCommand)}`));
      }
      
      // Show completion info for completed items
      if (item.completed) {
        if (item.completedAt) {
          console.log(chalk.gray(`   Completed: ${new Date(item.completedAt).toLocaleString()}`));
        }
        if (item.notes) {
          console.log(chalk.gray(`   Notes: ${item.notes}`));
        }
      }
      console.log(''); // Empty line between items
    }

    if (this.isChecklistComplete(checklist)) {
      console.log(chalk.green('\n✅ Review checklist complete! Ready to proceed to READY_TO_COMMIT.'));
    } else {
      console.log(chalk.yellow(`\n⚠️  Review checklist incomplete. ${total - completed} item(s) remaining.`));
      console.log(chalk.gray('💡 Each item is an actionable task. Cursor must execute the action before checking.'));
    }
  }
}


