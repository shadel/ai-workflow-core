/**
 * Sync CLI Command for Core Build
 * Updates workflow state and context files
 * @requirement REQ-V2-003 - Sync command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * Print AI reload prompt to ensure Cursor reads updated context files
 * @see docs/solutions/cursor-auto-reload-solutions.md
 */
function printAIReloadPrompt(): void {
  const separator = chalk.yellow('━'.repeat(60));
  
  console.log(separator);
  console.log(chalk.bold.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
  console.log('');
  console.log(chalk.white('⚠️  Context files have been updated!'));
  console.log(chalk.white('   Please reload these files NOW:'));
  console.log('');
  console.log(chalk.green('   1. Read: .ai-context/STATUS.txt'));
  console.log(chalk.green('   2. Read: .ai-context/NEXT_STEPS.md'));
  console.log('');
  console.log(chalk.gray('   (Files contain new state-based patterns)'));
  console.log(separator);
  console.log('');
}

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
          console.error(chalk.red('❌ Error: No active task to sync'));
          console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
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
          await taskManager.updateTaskState(options.state as any);
          
          console.log(chalk.green('✅ Workflow state updated!'));
          console.log('');
          console.log(`  New state: ${options.state}`);
          console.log('');
          console.log(chalk.gray('  📝 Context files updated'));
          console.log('');
          
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
            
            const newState = options.state.toUpperCase();
            const checklist = await checklistService.loadStateChecklist(newState as any);
            
            // 🔥 CRITICAL: Prompt Cursor to read checklist from console output
            console.log(chalk.bold.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(chalk.bold.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
            console.log('');
            console.log(chalk.white('⚠️  MANDATORY: You MUST read the checklist below!'));
            console.log(chalk.white('   The checklist is displayed in this console output.'));
            console.log(chalk.white('   Review all required items and complete them before progressing.'));
            console.log('');
            console.log(chalk.gray('   Checklist items are shown below this message.'));
            console.log(chalk.bold.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
            
            if (checklist) {
              checklistService.displayChecklist(checklist, newState as any);
            } else {
              // Initialize if not exists
              await checklistService.initializeStateChecklist(newState as any);
              const newChecklist = await checklistService.loadStateChecklist(newState as any);
              if (newChecklist) {
                checklistService.displayChecklist(newChecklist, newState as any);
              }
            }
            
            // Remind Cursor again after checklist display
            console.log(chalk.bold.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(chalk.bold.cyan('📋 CHECKLIST REMINDER FOR AI:'));
            console.log('');
            console.log(chalk.white('✅ You have seen the checklist above.'));
            console.log(chalk.white('⚠️  You MUST complete all required items before progressing to next state.'));
            console.log(chalk.white('💡 Use: npx ai-workflow checklist check <item-id> --evidence <type>'));
            console.log(chalk.bold.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
          } catch (error) {
            // If checklist display fails, continue anyway (graceful degradation)
            if (process.env.DEBUG) {
              console.warn(chalk.yellow(`⚠️  Warning: Could not display checklist: ${(error as Error).message}`));
            }
          }
          
          // 🔥 AI RELOAD PROMPT - Solution for cursor-auto-reload
          printAIReloadPrompt();
          process.exit(0);
        } else {
          // Show current state
          const taskData = await fs.readJson(taskFile);
          const currentState = taskData.workflow?.currentState || 'UNDERSTANDING';

          console.log(chalk.green('✅ Workflow complete and synchronized!'));
          console.log('');
          console.log(`  Current: ${currentState}`);
          console.log('');
          console.log(chalk.gray('  📝 Context files are up-to-date\n'));
          process.exit(0);
        }

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

