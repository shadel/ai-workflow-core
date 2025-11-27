/**
 * Unit tests for PatternChecklistGenerator
 * @requirement Dynamic State Checklists - Phase 2.1
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PatternChecklistGenerator } from '../../src/core/pattern-checklist-generator.js';
import { StateBasedPattern } from '../../src/core/pattern-provider.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('PatternChecklistGenerator', () => {
  let generator: PatternChecklistGenerator;

  beforeEach(() => {
    generator = new PatternChecklistGenerator();
  });

  describe('generateChecklistItems()', () => {
    it('should generate checklist items from patterns', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-1',
          title: 'No Interactive Commands',
          description: 'Never use interactive flags',
          action: 'Use --yes flag',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'No --interactive flags',
            message: 'Avoid interactive prompts'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('pattern-PATTERN-1');
      expect(items[0].title).toBe('No Interactive Commands');
      expect(items[0].description).toBe('Never use interactive flags');
      expect(items[0].patternId).toBe('PATTERN-1');
      expect(items[0].applicableStates).toEqual(['IMPLEMENTING']);
    });

    it('should create required items for patterns with requiredStates', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-REQUIRED',
          title: 'Required Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          requiredStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Must follow pattern'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);

      expect(items[0].required).toBe(true);
      expect(items[0].priority).toBe('high');
    });

    it('should create optional items for patterns without requiredStates', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-OPTIONAL',
          title: 'Optional Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 3,
          validation: {
            type: 'code_check',
            rule: 'Should follow pattern'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);

      expect(items[0].required).toBe(false);
      expect(items[0].priority).toBe('medium');
    });

    it('should generate multiple items from multiple patterns', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-1',
          title: 'Pattern 1',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Rule 1'
          }
        },
        {
          id: 'PATTERN-2',
          title: 'Pattern 2',
          applicableStates: ['TESTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Rule 2'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);

      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('pattern-PATTERN-1');
      expect(items[1].id).toBe('pattern-PATTERN-2');
    });
  });

  describe('patternToChecklistItem()', () => {
    it('should create condition function for pattern', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-1',
          title: 'Test Pattern',
          applicableStates: ['IMPLEMENTING', 'TESTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Test rule'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);

      expect(items[0].condition).toBeDefined();
      expect(typeof items[0].condition).toBe('function');

      // Test condition function
      expect(items[0].condition!({ state: 'IMPLEMENTING' } as any)).toBe(true);
      expect(items[0].condition!({ state: 'TESTING' } as any)).toBe(true);
      expect(items[0].condition!({ state: 'REVIEWING' } as any)).toBe(false);
    });

    it('should use description or action as description', () => {
      const patterns1: StateBasedPattern[] = [
        {
          id: 'PATTERN-1',
          title: 'Pattern 1',
          description: 'Pattern description',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Rule'
          }
        }
      ];

      const items1 = generator.generateChecklistItems(patterns1);
      expect(items1[0].description).toBe('Pattern description');

      const patterns2: StateBasedPattern[] = [
        {
          id: 'PATTERN-2',
          title: 'Pattern 2',
          action: 'Pattern action',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'Rule'
          }
        }
      ];

      const items2 = generator.generateChecklistItems(patterns2);
      expect(items2[0].description).toBe('Pattern action');
    });
  });

  describe('mapPatternValidationToChecklist()', () => {
    it('should map file_exists validation to file_check', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-FILE',
          title: 'File Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'file_exists',
            rule: 'src/test.ts',
            message: 'File must exist'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);
      expect(items).toHaveLength(1);

      // Verify validation mapping
      const mapping = generator.mapPatternValidationToChecklist(patterns[0].validation);
      expect(mapping.verificationType).toBe('file_check');
      expect(mapping.rule).toBe('src/test.ts');
    });

    it('should map command_run validation to command_check', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-CMD',
          title: 'Command Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'command_run',
            rule: 'npm test',
            message: 'Run tests'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);
      expect(items).toHaveLength(1);

      const mapping = generator.mapPatternValidationToChecklist(patterns[0].validation);
      expect(mapping.verificationType).toBe('command_check');
      expect(mapping.rule).toBe('npm test');
    });

    it('should map code_check validation to code_check', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-CODE',
          title: 'Code Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'code_check',
            rule: 'No console.log',
            message: 'Avoid console.log'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);
      expect(items).toHaveLength(1);

      const mapping = generator.mapPatternValidationToChecklist(patterns[0].validation);
      expect(mapping.verificationType).toBe('code_check');
      expect(mapping.rule).toBe('No console.log');
    });

    it('should map custom validation to response_check', () => {
      const patterns: StateBasedPattern[] = [
        {
          id: 'PATTERN-CUSTOM',
          title: 'Custom Pattern',
          applicableStates: ['IMPLEMENTING'] as WorkflowState[],
          score: 5,
          validation: {
            type: 'custom',
            rule: 'custom-rule',
            message: 'Custom validation'
          }
        }
      ];

      const items = generator.generateChecklistItems(patterns);
      expect(items).toHaveLength(1);

      const mapping = generator.mapPatternValidationToChecklist(patterns[0].validation);
      expect(mapping.verificationType).toBe('response_check');
      // Implementation uses validation.rule || validation.message, so rule comes first
      expect(mapping.rule).toBe('custom-rule');
    });
  });
});

