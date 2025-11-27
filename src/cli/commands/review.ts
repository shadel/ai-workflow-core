/**
 * Review CLI Command - Manage review checklist for REVIEWING state
 * @requirement REVIEW-CHECKLIST-001 - Review checklist CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { TaskManager } from '../../core/task-manager.js';
import { ReviewChecklistManager } from '../../core/review-checklist.js';

/**
 * Register review command
 */
export function registerReviewCommand(program: Command): void {
  const reviewCommand = program
    .command('review')
    .description('Manage review checklist for REVIEWING state');

  // review status - Show checklist status
  reviewCommand
    .command('status')
    .description('Show review checklist status')
    .option('--json', 'Output as JSON for Cursor parsing')
    .action(async (options: { json?: boolean }) => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getCurrentTask();
        
        if (!task) {
          console.error(chalk.red('❌ Error: No active task'));
          console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
          process.exit(1);
        }

        if (task.status !== 'REVIEWING') {
          console.error(chalk.red(`❌ Error: Task is not in REVIEWING state (current: ${task.status})`));
          console.log(chalk.gray('\n💡 Sync to REVIEWING first: npx ai-workflow sync --state REVIEWING\n'));
          process.exit(1);
        }

        // Load checklist from task
        const checklist = await (taskManager as any).loadReviewChecklist();
        
        if (!checklist) {
          console.log(chalk.yellow('⚠️  Review checklist not initialized'));
          console.log(chalk.gray('\n💡 Sync to REVIEWING state to initialize checklist:\n'));
          console.log(chalk.cyan('   npx ai-workflow sync --state REVIEWING\n'));
          process.exit(0);
        }

        // JSON output for Cursor
        if (options.json) {
          const jsonOutput = ReviewChecklistManager.toJSON(checklist);
          console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
          ReviewChecklistManager.displayChecklist(checklist);
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // review execute <item-id> - Execute action and auto-verify
  reviewCommand
    .command('execute <item-id>')
    .description('Execute action for checklist item and auto-verify (for Cursor)')
    .action(async (itemId: string) => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getCurrentTask();
        
        if (!task) {
          console.error(chalk.red('❌ Error: No active task'));
          process.exit(1);
        }

        if (task.status !== 'REVIEWING') {
          console.error(chalk.red(`❌ Error: Task is not in REVIEWING state (current: ${task.status})`));
          process.exit(1);
        }

        // Load checklist
        const checklist = await (taskManager as any).loadReviewChecklist();
        
        if (!checklist) {
          console.error(chalk.red('❌ Error: Review checklist not initialized'));
          console.log(chalk.gray('\n💡 Sync to REVIEWING state first: npx ai-workflow sync --state REVIEWING\n'));
          process.exit(1);
        }

        // Check if item exists
        const item = checklist.items.find((i: any) => i.id === itemId);
        if (!item) {
          console.error(chalk.red(`❌ Error: Checklist item "${itemId}" not found`));
          console.log(chalk.gray('\nAvailable items:'));
          checklist.items.forEach((i: any) => {
            console.log(chalk.gray(`  - ${i.id}: ${i.description}`));
          });
          process.exit(1);
        }

        // Check if already completed
        if (item.completed) {
          console.log(chalk.yellow(`⚠️  Item "${item.description}" is already completed`));
          process.exit(0);
        }

        // Execute action
        console.log(chalk.cyan(`\n🔍 Executing action for: ${item.description}\n`));
        const result = await ReviewChecklistManager.executeItemAction(item);
        
        if (result.success && result.canMarkComplete) {
          // Auto-mark complete if action passed
          const updatedChecklist = ReviewChecklistManager.markItemComplete(
            checklist,
            itemId,
            result.output ? `Auto-executed: ${result.output.substring(0, 100)}` : 'Action executed successfully'
          );
          
          // Save checklist
          await (taskManager as any).saveReviewChecklist(updatedChecklist);
          
          console.log(chalk.green(`\n✅ Action executed successfully! Item marked as complete.\n`));
          
          // Show updated status
          ReviewChecklistManager.displayChecklist(updatedChecklist);
          
          // If all complete, suggest proceeding
          if (ReviewChecklistManager.isChecklistComplete(updatedChecklist)) {
            console.log(chalk.cyan('\n💡 All checklist items complete! You can now proceed to READY_TO_COMMIT:'));
            console.log(chalk.gray('   npx ai-workflow sync --state READY_TO_COMMIT\n'));
          }
        } else if (result.success && !result.canMarkComplete) {
          // Manual items - action executed but need manual check
          console.log(chalk.yellow(`\n⚠️  This is a manual review item. Please review and then run:`));
          console.log(chalk.cyan(`   ${item.checkCommand}\n`));
        } else {
          // Action failed
          console.log(chalk.red(`\n❌ Action failed: ${result.error || 'Unknown error'}\n`));
          if (result.output) {
            console.log(chalk.gray('Output:'));
            console.log(chalk.gray(result.output));
          }
          console.log(chalk.yellow(`\n⚠️  Please fix issues and try again.\n`));
          process.exit(1);
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // review check <item-id> - Mark checklist item as complete (after action done)
  reviewCommand
    .command('check <item-id>')
    .description('Mark a review checklist item as complete (only after action is done)')
    .option('--notes <notes>', 'Add notes to the checklist item')
    .action(async (itemId: string, options: { notes?: string }) => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getCurrentTask();
        
        if (!task) {
          console.error(chalk.red('❌ Error: No active task'));
          process.exit(1);
        }

        if (task.status !== 'REVIEWING') {
          console.error(chalk.red(`❌ Error: Task is not in REVIEWING state (current: ${task.status})`));
          process.exit(1);
        }

        // Load checklist - create if missing
        let checklist = await (taskManager as any).loadReviewChecklist();
        
        if (!checklist) {
          // Auto-create checklist if missing (shouldn't happen, but handle gracefully)
          console.log(chalk.yellow('⚠️  Checklist not found. Creating default checklist...\n'));
          const defaultChecklist = ReviewChecklistManager.createDefaultChecklist();
          await (taskManager as any).saveReviewChecklist(defaultChecklist);
          checklist = await (taskManager as any).loadReviewChecklist();
          
          if (!checklist) {
            console.error(chalk.red('❌ Error: Failed to create review checklist'));
            process.exit(1);
          }
        }

        // Check if item exists
        const item = checklist.items.find((i: any) => i.id === itemId);
        if (!item) {
          console.error(chalk.red(`❌ Error: Checklist item "${itemId}" not found`));
          console.log(chalk.gray('\nAvailable items:'));
          checklist.items.forEach((i: any) => {
            console.log(chalk.gray(`  - ${i.id}: ${i.description}`));
          });
          process.exit(1);
        }

        // Warn if trying to check without executing action first (for automated items)
        if (!item.completed && item.category === 'automated' && item.verifyCommand) {
          console.log(chalk.yellow(`\n⚠️  Note: This is an automated item. Consider using:`));
          console.log(chalk.cyan(`   ${item.verifyCommand}`));
          console.log(chalk.gray(`   This will execute the action and auto-verify.\n`));
        }

        // Mark item as complete
        const updatedChecklist = ReviewChecklistManager.markItemComplete(
          checklist,
          itemId,
          options.notes || 'Marked complete manually'
        );
        
        // Verify item was marked
        const updatedItem = updatedChecklist.items.find((i: any) => i.id === itemId);
        if (!updatedItem || !updatedItem.completed) {
          console.error(chalk.red(`❌ Error: Failed to mark item as complete`));
          process.exit(1);
        }
        
        // Save checklist
        try {
          await (taskManager as any).saveReviewChecklist(updatedChecklist);
          
          // Verify save succeeded
          const savedChecklist = await (taskManager as any).loadReviewChecklist();
          const savedItem = savedChecklist?.items.find((i: any) => i.id === itemId);
          if (!savedItem || !savedItem.completed) {
            console.error(chalk.red(`❌ Error: Checklist save verification failed`));
            process.exit(1);
          }
        } catch (saveError) {
          console.error(chalk.red(`❌ Error saving checklist:`), (saveError as Error).message);
          process.exit(1);
        }
        
        console.log(chalk.green(`✅ Marked "${item.description}" as complete\n`));
        
        // Show updated status
        ReviewChecklistManager.displayChecklist(updatedChecklist);
        
        // If all complete, suggest proceeding
        if (ReviewChecklistManager.isChecklistComplete(updatedChecklist)) {
          console.log(chalk.cyan('\n💡 All checklist items complete! You can now proceed to READY_TO_COMMIT:'));
          console.log(chalk.gray('   npx ai-workflow sync --state READY_TO_COMMIT\n'));
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });

  // review list - List all checklist items
  reviewCommand
    .command('list')
    .description('List all review checklist items')
    .action(async () => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getCurrentTask();
        
        if (!task) {
          console.error(chalk.red('❌ Error: No active task'));
          process.exit(1);
        }

        const checklist = await (taskManager as any).loadReviewChecklist();
        
        if (!checklist) {
          console.log(chalk.yellow('⚠️  Review checklist not initialized'));
          console.log(chalk.gray('\n💡 Sync to REVIEWING state to initialize checklist:\n'));
          console.log(chalk.cyan('   npx ai-workflow sync --state REVIEWING\n'));
          process.exit(0);
        }

        console.log(chalk.bold('\n📋 Review Checklist Items\n'));
        
        for (const item of checklist.items) {
          const icon = item.completed ? chalk.green('✅') : chalk.yellow('⏳');
          const category = item.category === 'automated' 
            ? chalk.cyan('[AUTO]')
            : chalk.blue('[MANUAL]');
          
          console.log(`${icon} ${category} ${chalk.bold(item.id)}: ${item.description}`);
          
          if (item.completed && item.completedAt) {
            console.log(chalk.gray(`   Completed: ${new Date(item.completedAt).toLocaleString()}`));
          }
          if (item.notes) {
            console.log(chalk.gray(`   Notes: ${item.notes}`));
          }
          console.log('');
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}


