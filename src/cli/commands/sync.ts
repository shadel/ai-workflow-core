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
          console.log(chalk.gray('  📝 Context files updated\n'));
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

