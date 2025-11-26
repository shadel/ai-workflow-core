/**
 * Error Diagnostics Utilities
 * 
 * Provides utilities for diagnosing and reporting errors with context
 * 
 * @requirement TASK-2.2 - Error Handling Improvements
 */

import path from 'path';
import fs from 'fs-extra';

/**
 * Error context information
 */
export interface ErrorContext {
  operation: string;
  filePath?: string;
  directory?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Enhanced error with context
 */
export class EnhancedError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError: Error;
  public readonly timestamp: string;

  constructor(
    message: string,
    context: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'EnhancedError';
    this.context = context;
    this.originalError = originalError || new Error(message);
    this.timestamp = new Date().toISOString();
    
    // Preserve stack trace
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }

  /**
   * Get formatted error message with context
   */
  getFormattedMessage(): string {
    const lines: string[] = [];
    
    lines.push(`❌ Error: ${this.message}`);
    lines.push('');
    lines.push('Context:');
    lines.push(`  Operation: ${this.context.operation}`);
    
    if (this.context.filePath) {
      lines.push(`  File: ${this.context.filePath}`);
      lines.push(`  Directory: ${path.dirname(this.context.filePath)}`);
      
      // Check if file exists
      try {
        const exists = fs.existsSync(this.context.filePath);
        lines.push(`  File Exists: ${exists}`);
      } catch {
        // Ignore
      }
      
      // Check if directory exists
      try {
        const dirExists = fs.existsSync(path.dirname(this.context.filePath));
        lines.push(`  Directory Exists: ${dirExists}`);
      } catch {
        // Ignore
      }
    }
    
    if (this.context.directory) {
      lines.push(`  Directory: ${this.context.directory}`);
      
      // Check if directory exists
      try {
        const dirExists = fs.existsSync(this.context.directory);
        lines.push(`  Directory Exists: ${dirExists}`);
      } catch {
        // Ignore
      }
    }
    
    if (this.context.additionalInfo) {
      lines.push('');
      lines.push('Additional Info:');
      for (const [key, value] of Object.entries(this.context.additionalInfo)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    if (this.originalError && this.originalError !== this) {
      lines.push('');
      lines.push('Original Error:');
      lines.push(`  ${this.originalError.message}`);
    }
    
    lines.push('');
    lines.push(`Timestamp: ${this.timestamp}`);
    
    return lines.join('\n');
  }

  /**
   * Get structured error report
   */
  getStructuredReport(): {
    error: string;
    context: ErrorContext;
    timestamp: string;
    originalError?: {
      message: string;
      name: string;
      stack?: string;
    };
  } {
    return {
      error: this.message,
      context: this.context,
      timestamp: this.timestamp,
      originalError: this.originalError ? {
        message: this.originalError.message,
        name: this.originalError.name,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

/**
 * Create enhanced error with context
 */
export function createEnhancedError(
  message: string,
  context: ErrorContext,
  originalError?: Error
): EnhancedError {
  return new EnhancedError(message, context, originalError);
}

/**
 * Wrap error with context
 */
export function wrapError(
  error: Error,
  context: ErrorContext
): EnhancedError {
  return new EnhancedError(
    `${context.operation} failed: ${error.message}`,
    context,
    error
  );
}

/**
 * Diagnostic information for file operations
 */
export async function diagnoseFileOperation(
  operation: string,
  filePath: string
): Promise<{
  fileExists: boolean;
  directoryExists: boolean;
  directoryWritable: boolean;
  fileReadable: boolean;
  fileWritable: boolean;
  permissions?: string;
}> {
  const dirPath = path.dirname(filePath);
  
  const fileExists = await fs.pathExists(filePath);
  const directoryExists = await fs.pathExists(dirPath);
  
  let directoryWritable = false;
  let fileReadable = false;
  let fileWritable = false;
  let permissions: string | undefined;
  
  try {
    if (directoryExists) {
      // Check directory writability by attempting to create a test file
      const testFile = path.join(dirPath, `.test-${Date.now()}`);
      try {
        await fs.writeFile(testFile, 'test');
        directoryWritable = true;
        await fs.remove(testFile);
      } catch {
        directoryWritable = false;
      }
    }
    
    if (fileExists) {
      // Check file readability
      try {
        await fs.readFile(filePath, 'utf-8');
        fileReadable = true;
      } catch {
        fileReadable = false;
      }
      
      // Check file writability
      try {
        const stat = await fs.stat(filePath);
        fileWritable = true;
        permissions = stat.mode.toString(8);
      } catch {
        fileWritable = false;
      }
    }
  } catch {
    // Ignore diagnostic errors
  }
  
  return {
    fileExists,
    directoryExists,
    directoryWritable,
    fileReadable,
    fileWritable,
    permissions
  };
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: Error, context?: ErrorContext): string {
  if (error instanceof EnhancedError) {
    return error.getFormattedMessage();
  }
  
  const lines: string[] = [];
  lines.push(`❌ Error: ${error.message}`);
  
  if (context) {
    lines.push('');
    lines.push('Context:');
    lines.push(`  Operation: ${context.operation}`);
    if (context.filePath) {
      lines.push(`  File: ${context.filePath}`);
    }
    if (context.directory) {
      lines.push(`  Directory: ${context.directory}`);
    }
  }
  
  if (error.stack) {
    lines.push('');
    lines.push('Stack Trace:');
    lines.push(error.stack);
  }
  
  return lines.join('\n');
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    'ENOENT',
    'EACCES',
    'EMFILE',
    'ENFILE',
    'ETIMEDOUT',
    'ECONNRESET',
    'timeout',
    'temporary',
    'transient'
  ];
  
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
  return retryablePatterns.some(pattern => {
    const patternLower = pattern.toLowerCase();
    return errorMessage.includes(patternLower) || errorName.includes(patternLower);
  });
}

/**
 * Get error recovery suggestion
 */
export function getErrorRecoverySuggestion(error: Error, context?: ErrorContext): string[] {
  const suggestions: string[] = [];
  
  if (error.message.includes('ENOENT')) {
    suggestions.push('File or directory does not exist');
    if (context?.filePath) {
      suggestions.push(`Check if file exists: ${context.filePath}`);
      suggestions.push(`Check if directory exists: ${path.dirname(context.filePath)}`);
      suggestions.push('Ensure directory is created before file operations');
    }
  }
  
  if (error.message.includes('EACCES') || error.message.includes('permission')) {
    suggestions.push('Permission denied');
    suggestions.push('Check file/directory permissions');
    suggestions.push('Ensure process has read/write access');
  }
  
  if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
    suggestions.push('Too many open files');
    suggestions.push('Close unused file handles');
    suggestions.push('Increase system file descriptor limit');
  }
  
  if (isRetryableError(error)) {
    suggestions.push('This error may be transient - consider retrying');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Review error message and stack trace');
    suggestions.push('Check system resources and permissions');
  }
  
  return suggestions;
}

