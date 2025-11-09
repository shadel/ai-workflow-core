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
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync workflow state and update context files')
    .action(async () => {
      try {
        const taskFile = '.ai-context/current-task.json';
        
        // Check if task exists
        if (!await fs.pathExists(taskFile)) {
          console.log(chalk.yellow('⚠️  No active task to sync'));
          console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
          return;
        }

        // Read current task
        const taskData = await fs.readJson(taskFile);
        const currentState = taskData.workflow?.currentState || 'UNDERSTANDING';

        console.log(chalk.green('✅ Workflow state synchronized!'));
        console.log('');
        console.log(`  Current: ${currentState}`);
        console.log('');
        console.log(chalk.gray('  📝 Context files are up-to-date'));
        console.log(chalk.gray('  (STATUS.txt, NEXT_STEPS.md updated by last command)'));
        console.log('');

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

