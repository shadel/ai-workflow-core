/**
 * CLI Error Handler Utility
 * Provides consistent error handling with context-specific guidance
 * @requirement CLI-MESSAGES-REVIEW-001 - Standardized error handling
 */

import chalk from 'chalk';

export interface ErrorContext {
  command: string;
  operation: string;
  suggestions?: string[];
  currentState?: string;
  attemptedState?: string;
}

/**
 * Handle CLI errors with context-specific messages
 */
export function handleCliError(error: unknown, context: ErrorContext): void {
  const err = error as Error;
  const message = err.message.toLowerCase();
  
  // File not found errors
  if (message.includes('not found') || message.includes('enoent')) {
    console.error(chalk.red('❌ Error: File or resource not found'));
    console.log('');
    if (context.suggestions && context.suggestions.length > 0) {
      context.suggestions.forEach(s => console.log(chalk.gray(`   💡 ${s}`)));
      console.log('');
    } else {
      console.log(chalk.gray(`   💡 Check if the file or resource exists`));
      console.log('');
    }
    if (process.env.DEBUG) {
      console.error(chalk.gray(`Debug: ${err.message}`));
      if (err.stack) {
        console.error(chalk.gray(`Stack:\n${err.stack}`));
      }
      console.log('');
    }
    process.exit(1);
    return;
  }
  
  // Invalid state errors
  if (message.includes('invalid state') || message.includes('cannot transition') || message.includes('state transition')) {
    console.error(chalk.red('❌ Error: Invalid state transition'));
    console.log('');
    if (context.currentState) {
      console.log(chalk.yellow(`   Current state: ${context.currentState}`));
    }
    if (context.attemptedState) {
      console.log(chalk.yellow(`   Attempted: ${context.attemptedState}`));
    }
    console.log(chalk.yellow('   Valid states: UNDERSTANDING, DESIGNING, IMPLEMENTING, TESTING, REVIEWING, READY_TO_COMMIT'));
    console.log('');
    if (context.suggestions && context.suggestions.length > 0) {
      context.suggestions.forEach(s => console.log(chalk.gray(`   💡 ${s}`)));
      console.log('');
    }
    process.exit(1);
    return;
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('eacces') || message.includes('eperm')) {
    console.error(chalk.red('❌ Error: Permission denied'));
    console.log('');
    console.log(chalk.gray(`   💡 Check file permissions or run with appropriate privileges`));
    console.log('');
    if (process.env.DEBUG) {
      console.error(chalk.gray(`Debug: ${err.message}`));
      console.log('');
    }
    process.exit(1);
    return;
  }
  
  // Network/timeout errors
  if (message.includes('timeout') || message.includes('econnrefused') || message.includes('enotfound')) {
    console.error(chalk.red('❌ Error: Network or connection issue'));
    console.log('');
    console.log(chalk.gray(`   💡 Check your internet connection and try again`));
    console.log('');
    if (process.env.DEBUG) {
      console.error(chalk.gray(`Debug: ${err.message}`));
      console.log('');
    }
    process.exit(1);
    return;
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    console.error(chalk.red('❌ Error: Validation failed'));
    console.log('');
    console.log(chalk.yellow(`   ${err.message}`));
    console.log('');
    if (context.suggestions && context.suggestions.length > 0) {
      context.suggestions.forEach(s => console.log(chalk.gray(`   💡 ${s}`)));
      console.log('');
    }
    process.exit(1);
    return;
  }
  
  // Generic error
  console.error(chalk.red('❌ Error:'), err.message);
  console.log('');
  if (context.suggestions && context.suggestions.length > 0) {
    context.suggestions.forEach(s => console.log(chalk.gray(`   💡 ${s}`)));
    console.log('');
  }
  if (process.env.DEBUG) {
    console.error(chalk.gray(`Debug info:\n${err.stack || 'No stack trace available'}\n`));
  }
  process.exit(1);
}

