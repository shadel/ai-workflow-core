/**
 * Output Formatter Utility Tests
 * Tests output formatter with nextActions
 * @requirement REQ-MDC-OPTIMIZATION-002
 */

import { describe, it, expect } from '@jest/globals';
import { formatCommandOutput, formatErrorOutput, type NextAction } from '../../../src/cli/utils/output-formatter.js';

describe('Output Formatter Utility', () => {
  describe('formatCommandOutput', () => {
    it('should format JSON output with nextActions', () => {
      // Given: Result data and nextActions array
      const result = { id: 'task-123', state: 'IMPLEMENTING' };
      const nextActions: NextAction[] = [
        {
          type: 'command',
          action: 'npx ai-workflow checklist status --json --silent',
          reason: 'Get checklist for current state',
          required: true
        }
      ];
      
      // When: formatCommandOutput(result, nextActions, { json: true })
      const output = formatCommandOutput(result, nextActions, { json: true });
      
      // Then: Returns JSON with status, data, nextActions
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('status', 'success');
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('nextActions');
      expect(parsed.nextActions).toHaveLength(1);
    });
    
    it('should suppress formatting when --silent used', () => {
      // Given: Options with silent: true
      const result = { id: 'task-123' };
      const nextActions: NextAction[] = [];
      
      // When: formatCommandOutput(result, nextActions, { json: true, silent: true })
      const output = formatCommandOutput(result, nextActions, { json: true, silent: true });
      
      // Then: Returns compact JSON (no pretty printing)
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('status', 'success');
      // Compact JSON should not have newlines/indentation
      expect(output).not.toContain('\n');
    });
    
    it('should handle empty nextActions', () => {
      // Given: Result data, no nextActions
      const result = { id: 'task-123' };
      
      // When: formatCommandOutput(result, undefined, { json: true })
      const output = formatCommandOutput(result, undefined, { json: true });
      
      // Then: Returns JSON with nextActions: []
      const parsed = JSON.parse(output);
      expect(parsed.nextActions).toEqual([]);
    });
  });
  
  describe('NextAction interface', () => {
    it('should validate NextAction type', () => {
      // Verify: type is 'command' | 'read_file' | 'check_state'
      const action: NextAction = {
        type: 'command',
        action: 'test',
        reason: 'test reason'
      };
      expect(action.type).toBe('command');
    });
    
    it('should require action and reason fields', () => {
      // Verify: Interface validation
      const action: NextAction = {
        type: 'command',
        action: 'npx ai-workflow task status',
        reason: 'Get current task status',
        required: true
      };
      expect(action.action).toBeTruthy();
      expect(action.reason).toBeTruthy();
    });
  });
  
  describe('formatErrorOutput', () => {
    it('should format error with nextActions', () => {
      // Given: Error and nextActions
      const error = new Error('Test error');
      const nextActions: NextAction[] = [
        {
          type: 'check_state',
          action: 'Check system state',
          reason: 'Investigate error',
          required: true
        }
      ];
      
      // When: formatErrorOutput(error, nextActions, { json: true })
      const output = formatErrorOutput(error, nextActions, { json: true });
      
      // Then: Returns JSON with error and nextActions
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('status', 'error');
      expect(parsed).toHaveProperty('error', 'Test error');
      expect(parsed).toHaveProperty('exitCode', 1);
      expect(parsed).toHaveProperty('nextActions');
    });
  });
});

