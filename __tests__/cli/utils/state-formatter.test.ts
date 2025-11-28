/**
 * Unit tests for State Formatter Utility
 * @requirement CLI-MESSAGES-REVIEW-003 - State formatting consistency
 */

import { describe, it, expect } from '@jest/globals';
import { normalizeState, formatState, isValidState, displayState, WorkflowState } from '../../../src/cli/utils/state-formatter.js';
import chalk from 'chalk';

describe('State Formatter Utility', () => {
  describe('normalizeState', () => {
    it('should normalize lowercase state to uppercase', () => {
      // Given: Lowercase state string
      const input = 'testing';
      
      // When: normalizeState() called
      const result = normalizeState(input);
      
      // Then: Returns uppercase state
      expect(result).toBe('TESTING');
    });

    it('should normalize mixed case state to uppercase', () => {
      // Given: Mixed case state string
      const input = 'Testing';
      
      // When: normalizeState() called
      const result = normalizeState(input);
      
      // Then: Returns uppercase state
      expect(result).toBe('TESTING');
    });

    it('should trim whitespace from state string', () => {
      // Given: State string with leading/trailing whitespace
      const input = '  testing  ';
      
      // When: normalizeState() called
      const result = normalizeState(input);
      
      // Then: Returns trimmed uppercase state
      expect(result).toBe('TESTING');
    });

    it('should return same value for already uppercase state', () => {
      // Given: Uppercase state string
      const input = 'TESTING';
      
      // When: normalizeState() called
      const result = normalizeState(input);
      
      // Then: Returns same uppercase state
      expect(result).toBe('TESTING');
    });
  });

  describe('formatState', () => {
    it('should apply cyan color to normalized state', () => {
      // Given: State string
      const input = 'testing';
      
      // When: formatState() called
      const result = formatState(input);
      
      // Then: Returns chalk.cyan formatted string
      expect(result).toBe(chalk.cyan('TESTING'));
    });

    it('should normalize state before formatting', () => {
      // Given: Lowercase state string
      const input = 'testing';
      
      // When: formatState() called
      const result = formatState(input);
      
      // Then: Returns normalized and formatted state
      expect(result).toBe(chalk.cyan('TESTING'));
    });
  });

  describe('isValidState', () => {
    it('should return true for valid workflow state', () => {
      // Given: Valid workflow state
      const input = 'TESTING';
      
      // When: isValidState() called
      const result = isValidState(input);
      
      // Then: Returns true
      expect(result).toBe(true);
    });

    it('should return false for invalid state string', () => {
      // Given: Invalid state string
      const input = 'INVALID';
      
      // When: isValidState() called
      const result = isValidState(input);
      
      // Then: Returns false
      expect(result).toBe(false);
    });

    it('should be case insensitive (validates after normalization)', () => {
      // Given: Valid state in lowercase
      const input = 'testing';
      
      // When: isValidState() called
      const result = isValidState(input);
      
      // Then: Returns true (normalizes first)
      expect(result).toBe(true);
    });

    it('should validate all valid WorkflowState values', () => {
      // Given: All valid WorkflowState values
      const validStates: WorkflowState[] = [
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];
      
      // When: isValidState() called for each
      const results = validStates.map(state => isValidState(state));
      
      // Then: All return true
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('displayState', () => {
    it('should return formatted state string for valid state', () => {
      // Given: Valid state string
      const input = 'testing';
      
      // When: displayState() called
      const result = displayState(input);
      
      // Then: Returns formatted state string
      expect(result).toBe(chalk.cyan('TESTING'));
    });

    it('should return red state with invalid indicator when isValid is false', () => {
      // Given: State with isValid = false
      const input = 'INVALID';
      
      // When: displayState() called with isValid = false
      const result = displayState(input, false);
      
      // Then: Returns red state with (invalid) indicator
      expect(result).toBe(chalk.red('INVALID') + chalk.gray(' (invalid)'));
    });

    it('should return cyan formatted state when isValid is true', () => {
      // Given: State with isValid = true
      const input = 'TESTING';
      
      // When: displayState() called with isValid = true
      const result = displayState(input, true);
      
      // Then: Returns cyan formatted state
      expect(result).toBe(chalk.cyan('TESTING'));
    });
  });
});

