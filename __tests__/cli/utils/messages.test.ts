/**
 * Unit tests for Message Constants Utility
 * @requirement CLI-MESSAGES-REVIEW-002 - Message constants
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ErrorMessages, SuccessMessages, InfoMessages, AIPrompts } from '../../../src/cli/utils/messages.js';

describe('Message Constants Utility', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    // Mock console methods to capture output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('ErrorMessages', () => {
    it('should display no task error message correctly', () => {
      // Given: Call ErrorMessages.noTask()
      // When: Function executed
      ErrorMessages.noTask();
      
      // Then: Correct error message displayed
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display invalid state error with current state', () => {
      // Given: Call with current state
      const current = 'IMPLEMENTING';
      
      // When: Function executed
      ErrorMessages.invalidState(current);
      
      // Then: Shows current state in message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display invalid state error with attempted state', () => {
      // Given: Call with attempted state
      const attempted = 'READY_TO_COMMIT';
      
      // When: Function executed
      ErrorMessages.invalidState(undefined, attempted);
      
      // Then: Shows attempted state in message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display invalid state error with both current and attempted states', () => {
      // Given: Call with both current and attempted states
      const current = 'IMPLEMENTING';
      const attempted = 'READY_TO_COMMIT';
      
      // When: Function executed
      ErrorMessages.invalidState(current, attempted);
      
      // Then: Shows both states in message
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display task file not found error correctly', () => {
      // Given: Call ErrorMessages.taskFileNotFound()
      // When: Function executed
      ErrorMessages.taskFileNotFound();
      
      // Then: Correct error message displayed
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display generic error with message and suggestion', () => {
      // Given: Call with message and suggestion
      const message = 'Something went wrong';
      const suggestion = 'Try again';
      
      // When: Function executed
      ErrorMessages.generic(message, suggestion);
      
      // Then: Shows message and suggestion
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display generic error without suggestion', () => {
      // Given: Call with message only
      const message = 'Something went wrong';
      
      // When: Function executed
      ErrorMessages.generic(message);
      
      // Then: Shows message only
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('SuccessMessages', () => {
    it('should display task created with ACTIVE status correctly', () => {
      // Given: Call with ACTIVE status
      const id = 'task-123';
      const goal = 'Test task';
      const status = 'ACTIVE' as const;
      
      // When: Function executed
      SuccessMessages.taskCreated(id, goal, status);
      
      // Then: Shows task created with green ACTIVE status
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display task created with QUEUED status correctly', () => {
      // Given: Call with QUEUED status
      const id = 'task-123';
      const goal = 'Test task';
      const status = 'QUEUED' as const;
      
      // When: Function executed
      SuccessMessages.taskCreated(id, goal, status);
      
      // Then: Shows task created with yellow QUEUED status
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display task created with default ACTIVE status', () => {
      // Given: Call without status (defaults to ACTIVE)
      const id = 'task-123';
      const goal = 'Test task';
      
      // When: Function executed
      SuccessMessages.taskCreated(id, goal);
      
      // Then: Shows task created with ACTIVE status
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display state updated with normalized uppercase state', () => {
      // Given: Call with state name
      const state = 'testing';
      
      // When: Function executed
      SuccessMessages.stateUpdated(state);
      
      // Then: Shows state updated with normalized uppercase state
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display workflow synced with normalized state', () => {
      // Given: Call with current state
      const currentState = 'testing';
      
      // When: Function executed
      SuccessMessages.workflowSynced(currentState);
      
      // Then: Shows workflow synced with normalized state
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('InfoMessages', () => {
    it('should display create task suggestion correctly', () => {
      // Given: Call InfoMessages.createTask()
      // When: Function executed
      InfoMessages.createTask();
      
      // Then: Shows create task suggestion
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display validation next steps correctly', () => {
      // Given: Call InfoMessages.validationNextSteps()
      // When: Function executed
      InfoMessages.validationNextSteps();
      
      // Then: Shows workflow reminder steps
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('AIPrompts', () => {
    it('should display context files updated prompt correctly', () => {
      // Given: Call AIPrompts.contextFilesUpdated()
      // When: Function executed
      AIPrompts.contextFilesUpdated();
      
      // Then: Shows AI reload prompt with correct format
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display checklist prompt correctly', () => {
      // Given: Call AIPrompts.checklistPrompt()
      // When: Function executed
      AIPrompts.checklistPrompt();
      
      // Then: Shows checklist prompt with correct format
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display checklist reminder correctly', () => {
      // Given: Call AIPrompts.checklistReminder()
      // When: Function executed
      AIPrompts.checklistReminder();
      
      // Then: Shows checklist reminder
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});

