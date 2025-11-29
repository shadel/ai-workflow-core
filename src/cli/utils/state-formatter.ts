/**
 * State Formatting Utilities
 * Standardized state display formatting across CLI commands
 * @requirement CLI-MESSAGES-REVIEW-003 - State formatting consistency
 */

import chalk from 'chalk';

/**
 * Valid workflow states
 */
export type WorkflowState = 
  | 'UNDERSTANDING'
  | 'DESIGNING'
  | 'IMPLEMENTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'READY_TO_COMMIT';

/**
 * Normalize state string to uppercase and trim whitespace
 */
export function normalizeState(state: string): string {
  return state.toUpperCase().trim();
}

/**
 * Format state with consistent styling
 */
export function formatState(state: string): string {
  return chalk.cyan(normalizeState(state));
}

/**
 * Validate if state is a valid workflow state
 */
export function isValidState(state: string): boolean {
  const normalized = normalizeState(state);
  const validStates: WorkflowState[] = [
    'UNDERSTANDING',
    'DESIGNING',
    'IMPLEMENTING',
    'TESTING',
    'REVIEWING',
    'READY_TO_COMMIT'
  ];
  return validStates.includes(normalized as WorkflowState);
}

/**
 * Get state display with validation indicator
 */
export function displayState(state: string, isValid?: boolean): string {
  const normalized = normalizeState(state);
  const formatted = formatState(normalized);
  
  if (isValid !== undefined && !isValid) {
    return chalk.red(normalized) + chalk.gray(' (invalid)');
  }
  
  return formatted;
}

