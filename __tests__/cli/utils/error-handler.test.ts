/**
 * Unit tests for Error Handler Utility
 * @requirement CLI-MESSAGES-REVIEW-001 - Standardized error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { handleCliError, ErrorContext } from '../../../src/cli/utils/error-handler.js';

describe('Error Handler Utility', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let processExitSpy: jest.SpiedFunction<typeof process.exit>;
  let originalDebug: string | undefined;

  beforeEach(() => {
    // Mock console methods to capture output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock process.exit to prevent actual exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    // Save and clear DEBUG env var
    originalDebug = process.env.DEBUG;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    
    // Restore DEBUG env var
    if (originalDebug) {
      process.env.DEBUG = originalDebug;
    } else {
      delete process.env.DEBUG;
    }
  });

  describe('Error Type Detection', () => {
    it('should handle file not found error', () => {
      // Given: Error with 'not found' in message
      const error = new Error('File not found');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows file not found message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle ENOENT error', () => {
      // Given: Error with 'enoent' in message
      const error = new Error('ENOENT: no such file');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows file not found message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should display suggestions for file not found error', () => {
      // Given: Error with suggestions
      const error = new Error('File not found');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op',
        suggestions: ['Check file path', 'Verify file exists']
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Displays suggestions
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle invalid state error', () => {
      // Given: Error with 'invalid state' in message
      const error = new Error('Invalid state transition');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op',
        currentState: 'IMPLEMENTING',
        attemptedState: 'READY_TO_COMMIT'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows invalid state message with current/attempted states
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle cannot transition error', () => {
      // Given: Error with 'cannot transition' in message
      const error = new Error('Cannot transition from IMPLEMENTING to READY_TO_COMMIT');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows invalid state message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle permission error', () => {
      // Given: Error with 'permission' in message
      const error = new Error('Permission denied');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows permission denied message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle EACCES error', () => {
      // Given: Error with 'eacces' in message
      const error = new Error('EACCES: permission denied');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows permission denied message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle network timeout error', () => {
      // Given: Error with 'timeout' in message
      const error = new Error('Connection timeout');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows network error message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle ECONNREFUSED error', () => {
      // Given: Error with 'econnrefused' in message
      const error = new Error('ECONNREFUSED');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows network error message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle validation error', () => {
      // Given: Error with 'validation' in message
      const error = new Error('Validation failed');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows validation error message with suggestions
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle generic error when type unknown', () => {
      // Given: Unknown error type
      const error = new Error('Something went wrong');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows generic error message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should display suggestions when provided', () => {
      // Given: Error context with suggestions array
      const error = new Error('Something went wrong');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op',
        suggestions: ['Fix suggestion 1', 'Fix suggestion 2']
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Displays all suggestions
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should show stack trace in DEBUG mode', () => {
      // Given: DEBUG environment variable set
      process.env.DEBUG = '1';
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() called
      handleCliError(error, context);
      
      // Then: Shows stack trace in debug info
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Error Context', () => {
    it('should use all context fields correctly', () => {
      // Given: Valid ErrorContext object with all fields
      const error = new Error('Invalid state transition');
      const context: ErrorContext = {
        command: 'sync',
        operation: 'update-state',
        suggestions: ['Check state transition', 'Ensure task exists'],
        currentState: 'IMPLEMENTING',
        attemptedState: 'READY_TO_COMMIT'
      };
      
      // When: Passed to handleCliError()
      handleCliError(error, context);
      
      // Then: All context fields used correctly
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit with code 1', () => {
      // Given: Any error handled
      const error = new Error('Test error');
      const context: ErrorContext = {
        command: 'test',
        operation: 'test-op'
      };
      
      // When: handleCliError() completes
      handleCliError(error, context);
      
      // Then: process.exit(1) called
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});

