/**
 * Sync CLI Command for Core Build
 * Updates workflow state and context files
 * @requirement REQ-V2-003 - Sync command
 * @requirement CLI-MESSAGES-REVIEW - Use standardized message utilities
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { handleCliError } from '../utils/error-handler.js';
import { ErrorMessages, SuccessMessages, AIPrompts } from '../utils/messages.js';
import { normalizeState, formatState } from '../utils/state-formatter.js';
import { formatCommandOutput, type NextAction } from '../utils/output-formatter.js';

/**
 * Register sync command
 * @requirement REQ-V2-003 - CLI sync command
 * @requirement BUG-FIX-002 - Actually sync state with --state option
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync workflow state and update context files')
    .option('--state <state>', 'Update to specific workflow state')
    .action(async (options: { state?: string }) => {
      try {
        const taskFile = '.ai-context/current-task.json';
        
        // Check if task exists
        if (!await fs.pathExists(taskFile)) {
          ErrorMessages.noTask();
          process.exit(1);
        }

        const { TaskManager } = await import('../../core/task-manager.js');
        const taskManager = new TaskManager();
        
        // BUG-FIX-009-AI: Check for missing workflow phases (AI Flow Correction)
        const analysis = await taskManager.analyzeWorkflowCompleteness();
        
        if (!analysis.complete) {
          // Missing phases detected - guide AI
          console.log(chalk.yellow('\n⚠️  WORKFLOW INCOMPLETE!\n'));
          console.log(chalk.red(`Missing ${analysis.missingPhases.length} workflow phase(s)\n`));
          console.log(chalk.cyan('🤖 AI: You need to complete the missing phases below:\n'));
          console.log(chalk.gray('─'.repeat(70)));
          console.log(analysis.instructions);
          console.log(chalk.gray('─'.repeat(70)));
          console.log(chalk.yellow('\n💡 Complete the missing phases above, then run sync again.\n'));
          process.exit(1);
        }
        
        // If --state provided, update state
        if (options.state) {
          const normalizedState = normalizeState(options.state);
          
          // BUG-FIX: Explicit error handling to ensure we don't continue on error
          try {
            await taskManager.updateTaskState(normalizedState as any);
          } catch (error) {
            // If updateTaskState fails, handle error and exit immediately
            // Don't continue with success messages or checklist display
            // Get current state for error context
            const currentTask = await taskManager.getCurrentTask();
            const currentState = (currentTask as any)?.workflow?.currentState || (currentTask as any)?.status;
            
            handleCliError(error, {
              command: 'sync',
              operation: 'update-state',
              suggestions: ['Check if state transition is valid', 'Ensure task exists'],
              currentState: currentState,
              attemptedState: normalizedState
            });
            // handleCliError calls process.exit(1), but add explicit return for safety
            return;
          }
          
          // Only continue if updateTaskState succeeded
          // Use standardized success message
          SuccessMessages.stateUpdated(normalizedState);
          
          // Phase 4.3: Show checklist after transition
          try {
            const { StateChecklistService } = await import('../../core/state-checklist-service.js');
            const { ChecklistRegistry } = await import('../../core/checklist-registry.js');
            const { TaskQueueManager } = await import('../../core/task-queue.js');
            const { TaskFileSync } = await import('../../core/task-file-sync.js');
            const contextInjector = taskManager.getContextInjector();
            const patternProvider = contextInjector.getPatternProvider();
            
            const queueManager = new TaskQueueManager('.ai-context');
            const fileSync = new TaskFileSync('.ai-context');
            const registry = new ChecklistRegistry();
            const checklistService = new StateChecklistService(
              queueManager,
              fileSync,
              taskFile,
              registry,
              patternProvider
            );
            
            const checklist = await checklistService.loadStateChecklist(normalizedState as any);
            
            // Consolidated checklist prompt (single, concise)
            AIPrompts.checklistPrompt();
            
            if (checklist) {
              checklistService.displayChecklist(checklist, normalizedState as any);
            } else {
              // Initialize if not exists
              await checklistService.initializeStateChecklist(normalizedState as any);
              const newChecklist = await checklistService.loadStateChecklist(normalizedState as any);
              if (newChecklist) {
                checklistService.displayChecklist(newChecklist, normalizedState as any);
              }
            }
            
            // Single reminder after checklist (simplified)
            AIPrompts.checklistReminder();
          } catch (error) {
            // If checklist display fails, continue anyway (graceful degradation)
            if (process.env.DEBUG) {
              console.warn(chalk.yellow(`⚠️  Warning: Could not display checklist: ${(error as Error).message}`));
            }
          }
          
          // AI reload prompt - use standardized message
          AIPrompts.contextFilesUpdated();
          process.exit(0);
        } else {
          // Show current state
          const taskData = await fs.readJson(taskFile);
          const currentState = taskData.workflow?.currentState || 'UNDERSTANDING';
          const normalizedState = normalizeState(currentState);

          // Use standardized success message
          SuccessMessages.workflowSynced(normalizedState);
          process.exit(0);
        }

      } catch (error) {
        handleCliError(error, {
          command: 'sync',
          operation: options.state ? 'update-state' : 'sync',
          suggestions: options.state 
            ? ['Check if state transition is valid', 'Ensure task exists']
            : ['Check if task file exists', 'Verify workflow state']
        });
      }
    });
}

