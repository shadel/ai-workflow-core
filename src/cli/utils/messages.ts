/**
 * CLI Message Constants
 * Standardized messages for consistent UX across all commands
 * @requirement CLI-MESSAGES-REVIEW-002 - Message constants
 */

import chalk from 'chalk';

/**
 * Standardized error messages
 */
export const ErrorMessages = {
  /**
   * No active task error
   */
  noTask: (): void => {
    console.error(chalk.red('❌ Error: No active task to sync'));
    console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
  },

  /**
   * Invalid state transition error
   */
  invalidState: (current?: string, attempted?: string): void => {
    console.error(chalk.red('❌ Error: Invalid state transition'));
    if (current) {
      console.log(chalk.yellow(`   Current state: ${current}`));
    }
    if (attempted) {
      console.log(chalk.yellow(`   Attempted: ${attempted}`));
    }
    console.log(chalk.yellow('   Valid states: UNDERSTANDING, DESIGNING, IMPLEMENTING, TESTING, REVIEWING, READY_TO_COMMIT'));
    console.log('');
  },

  /**
   * Task file not found
   */
  taskFileNotFound: (): void => {
    console.error(chalk.red('❌ Error: No active task found'));
    console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
  },

  /**
   * Generic error with suggestion
   */
  generic: (message: string, suggestion?: string): void => {
    console.error(chalk.red('❌ Error:'), message);
    if (suggestion) {
      console.log(chalk.gray(`\n💡 ${suggestion}\n`));
    }
  }
};

/**
 * Standardized success messages
 */
export const SuccessMessages = {
  /**
   * Task created successfully
   */
  taskCreated: (id: string, goal: string, status: 'ACTIVE' | 'QUEUED' = 'ACTIVE'): void => {
    console.log(chalk.green('✅ Task created!'));
    console.log('');
    console.log(`  ID: ${id}`);
    console.log(`  Goal: ${goal}`);
    console.log(`  Status: ${status === 'QUEUED' ? chalk.yellow('QUEUED') : chalk.green('ACTIVE')}`);
    console.log('');
  },

  /**
   * Workflow state updated
   */
  stateUpdated: (state: string): void => {
    const normalizedState = state.toUpperCase();
    console.log(chalk.green('✅ Workflow state updated!'));
    console.log('');
    console.log(`  New state: ${chalk.cyan(normalizedState)}`);
    console.log('');
    console.log(chalk.gray('  📝 Context files updated'));
    console.log('');
  },

  /**
   * Workflow synchronized
   */
  workflowSynced: (currentState: string): void => {
    console.log(chalk.green('✅ Workflow complete and synchronized!'));
    console.log('');
    console.log(`  Current: ${chalk.cyan(currentState.toUpperCase())}`);
    console.log('');
    console.log(chalk.gray('  📝 Context files are up-to-date\n'));
  }
};

/**
 * Standardized info/tip messages
 */
export const InfoMessages = {
  /**
   * Create task suggestion
   */
  createTask: (): void => {
    console.log(chalk.gray('\n💡 Create a task first: npx ai-workflow task create "<goal>"\n'));
  },

  /**
   * Next steps after validation
   */
  validationNextSteps: (): void => {
    console.log(chalk.bold.cyan('📝 Workflow reminder:'));
    console.log(chalk.gray('  1. git commit -m "your message"'));
    console.log(chalk.gray('  2. npx ai-workflow task complete  ← Complete your task!'));
    console.log(chalk.gray('  3. npx ai-workflow task create "<next goal>"'));
    console.log('');
  }
};

/**
 * AI Assistant prompts (for Cursor integration)
 */
export const AIPrompts = {
  /**
   * Context files updated prompt
   */
  contextFilesUpdated: (): void => {
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
  },

  /**
   * Checklist prompt (before display)
   */
  checklistPrompt: (): void => {
    console.log(chalk.bold.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.cyan('📋 CHECKLIST FOR CURRENT STATE:'));
    console.log('');
    console.log(chalk.white('⚠️  MANDATORY: Complete all required items below before progressing.'));
    console.log(chalk.bold.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  },

  /**
   * Checklist reminder (after display)
   */
  checklistReminder: (): void => {
    console.log(chalk.gray('\n💡 Mark items complete: npx ai-workflow checklist check <item-id> --evidence <type>\n'));
  }
};

