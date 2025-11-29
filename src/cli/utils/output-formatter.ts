/**
 * Output Formatter Utility
 * Standardizes command output with nextActions array
 * @requirement REQ-MDC-OPTIMIZATION-002
 */

export interface NextAction {
  type: 'command' | 'read_file' | 'check_state';
  action: string;
  reason: string;
  required?: boolean;
}

export interface CommandOutput {
  status: 'success' | 'error';
  data?: any;  // Optional for error cases
  nextActions?: NextAction[];
  error?: string;
  exitCode?: number;
}

/**
 * Format command output with nextActions
 */
export function formatCommandOutput(
  result: any,
  nextActions?: NextAction[],
  options?: { json?: boolean; silent?: boolean }
): string {
  if (options?.json) {
    const output: CommandOutput = {
      status: 'success',
      data: result,
      nextActions: nextActions || []
    };
    
    if (options.silent) {
      // Compact JSON for programmatic use
      return JSON.stringify(output);
    } else {
      // Pretty-printed JSON
      return JSON.stringify(output, null, 2);
    }
  }
  
  // Human-readable format (fallback)
  // This would be used if json is false
  // For now, return empty string (commands handle their own formatting)
  return '';
}

/**
 * Format error output
 */
export function formatErrorOutput(
  error: Error,
  nextActions?: NextAction[],
  options?: { json?: boolean; silent?: boolean }
): string {
  if (options?.json) {
    const output: CommandOutput = {
      status: 'error',
      data: null,
      error: error.message,
      exitCode: 1,
      nextActions: nextActions || []
    };
    
    if (options.silent) {
      return JSON.stringify(output);
    } else {
      return JSON.stringify(output, null, 2);
    }
  }
  
  // Human-readable error (fallback)
  return error.message;
}

