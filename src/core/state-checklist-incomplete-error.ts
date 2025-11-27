/**
 * State Checklist Incomplete Error
 * 
 * Custom error thrown when attempting to transition states with incomplete checklists
 * 
 * Phase 3.1: Error for blocking state transitions
 */

import chalk from 'chalk';

/**
 * Error thrown when state checklist is incomplete and blocks state transition
 */
export class StateChecklistIncompleteError extends Error {
  public readonly state: string;
  public readonly incompleteItems: Array<{
    id: string;
    title: string;
    description: string;
  }>;

  constructor(
    state: string,
    incompleteItems: Array<{
      id: string;
      title: string;
      description: string;
    }>
  ) {
    const itemList = incompleteItems.map(item => `  - ${item.title}: ${item.description}`).join('\n');
    
    const message = `
${chalk.red('❌ State Checklist Incomplete!')}

Cannot progress from ${chalk.yellow(state)} state. The following required checklist items are incomplete:

${itemList}

${chalk.gray('Please complete all required checklist items before progressing.')}
${chalk.gray('Use: npx ai-workflow checklist check <item-id> to mark items complete.')}
`.trim();

    super(message);
    this.name = 'StateChecklistIncompleteError';
    this.state = state;
    this.incompleteItems = incompleteItems;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StateChecklistIncompleteError);
    }
  }

  /**
   * Get user-friendly error message
   */
  getFriendlyMessage(): string {
    return this.message;
  }

  /**
   * Get list of incomplete item IDs
   */
  getIncompleteItemIds(): string[] {
    return this.incompleteItems.map(item => item.id);
  }
}

