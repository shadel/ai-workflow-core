/**
 * Unit tests for Pattern Provider
 * Tests state-based pattern system
 * @requirement State-Based Pattern System Testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { PatternProvider, StateBasedPattern, ValidationContext } from '../src/core/pattern-provider.js';
import { WorkflowState, Task } from '@shadel/workflow-core';
import { RuleManager } from '../src/utils/rule-manager.js';
import { cleanupAllTestDirs } from './test-helpers';

describe('PatternProvider', () => {
  const testContextDir = '.test-pattern-provider';
  const patternsFile = path.join(testContextDir, 'patterns.json');
  let provider: PatternProvider;
  let originalPatternsFile: string;

  beforeEach(async () => {
    await cleanupAllTestDirs();
    await fs.ensureDir(testContextDir);
    
    provider = new PatternProvider();
    
    // Override RuleManager's file paths for testing
    const ruleManager = (provider as any).ruleManager;
    originalPatternsFile = ruleManager.patternsFile;
    ruleManager.patternsFile = patternsFile;
    ruleManager.rulesFile = path.join(testContextDir, 'rules.json');
  });

  afterEach(async () => {
    // Restore original paths
    const ruleManager = (provider as any).ruleManager;
    if (originalPatternsFile) {
      ruleManager.patternsFile = originalPatternsFile;
    }
    await cleanupAllTestDirs();
  });

  describe('getPatternsForState', () => {
    it('should filter patterns by applicableStates', async () => {
      // Create test patterns
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Test Plan Required',
          content: 'Test plan must exist',
          applicableStates: ['IMPLEMENTING', 'TESTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Test plan required',
          action: 'Create test plan',
          validation: {
            type: 'file_exists',
            rule: 'docs/test-plans/${task.id}-test-plan.md',
            message: 'Test plan missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-2',
          title: 'Code Review',
          content: 'Review code before commit',
          applicableStates: ['REVIEWING', 'READY_TO_COMMIT'],
          description: 'Code review required',
          action: 'Review code',
          validation: {
            type: 'custom',
            rule: 'Check code quality',
            message: 'Code review needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-3',
          title: 'All States Pattern',
          content: 'Applies to all states',
          applicableStates: ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'],
          description: 'Applies everywhere',
          action: 'Follow pattern',
          validation: {
            type: 'custom',
            rule: 'Check compliance',
            message: 'Pattern should be followed',
            severity: 'info'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Test filtering for IMPLEMENTING state
      const result = await provider.getPatternsForState('IMPLEMENTING');

      expect(result.mandatory.length).toBe(1);
      expect(result.mandatory[0].id).toBe('PATTERN-1');
      expect(result.recommended.length).toBe(1);
      expect(result.recommended[0].id).toBe('PATTERN-3');
    });

    it('should return empty arrays when no patterns match state', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Review Only',
          content: 'Only for review',
          applicableStates: ['REVIEWING'],
          description: 'Review only',
          action: 'Review',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Review needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const result = await provider.getPatternsForState('IMPLEMENTING');

      expect(result.mandatory.length).toBe(0);
      expect(result.recommended.length).toBe(0);
    });

    it('should handle backward compatibility with legacy patterns', async () => {
      // Legacy pattern without applicableStates
      const patterns: any[] = [
        {
          id: 'PATTERN-LEGACY',
          title: 'Legacy Pattern',
          content: 'This is a legacy pattern without state fields',
          description: 'Legacy pattern',
          action: 'Follow pattern',
          validation: {
            type: 'custom',
            rule: 'Check compliance',
            message: 'Pattern should be followed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Should convert to state-based (all states)
      const result = await provider.getPatternsForState('IMPLEMENTING');

      expect(result.recommended.length).toBe(1);
      expect(result.recommended[0].id).toBe('PATTERN-LEGACY');
      expect(result.recommended[0].applicableStates.length).toBe(6); // All states
    });
  });

  describe('getStatePatternMap', () => {
    it('should group patterns by state', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Implementing Pattern',
          content: 'For implementing',
          applicableStates: ['IMPLEMENTING'],
          description: 'Implementing only',
          action: 'Implement',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Implement needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-2',
          title: 'Testing Pattern',
          content: 'For testing',
          applicableStates: ['TESTING'],
          description: 'Testing only',
          action: 'Test',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Test needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const map = await provider.getStatePatternMap();

      expect(map.IMPLEMENTING.recommended.length).toBe(1);
      expect(map.IMPLEMENTING.recommended[0].id).toBe('PATTERN-1');
      expect(map.TESTING.recommended.length).toBe(1);
      expect(map.TESTING.recommended[0].id).toBe('PATTERN-2');
      expect(map.UNDERSTANDING.recommended.length).toBe(0);
    });
  });

  describe('generateContextSection', () => {
    it('should generate markdown for mandatory patterns', () => {
      const patterns = {
        mandatory: [
          {
            id: 'PATTERN-1',
            title: 'Test Plan Required',
            description: 'Test plan must exist before coding',
            action: 'Create test plan: npx ai-workflow generate test-plan <file>',
            validation: {
              type: 'file_exists' as const,
              rule: 'docs/test-plans/${task.id}-test-plan.md',
              message: 'Test plan missing! Create it before coding.',
              severity: 'error' as const
            },
            applicableStates: ['IMPLEMENTING' as WorkflowState],
            content: 'Full content',
            createdAt: new Date().toISOString()
          }
        ],
        recommended: []
      };

      const section = provider.generateContextSection(patterns, 'IMPLEMENTING' as WorkflowState);

      expect(section).toContain('Patterns for IMPLEMENTING State');
      expect(section).toContain('MANDATORY');
      expect(section).toContain('Test Plan Required');
      expect(section).toContain('Test plan must exist before coding');
      expect(section).toContain('Create test plan: npx ai-workflow generate test-plan <file>');
      expect(section).toContain('Test plan missing! Create it before coding.');
    });

    it('should generate markdown for recommended patterns', () => {
      const patterns = {
        mandatory: [],
        recommended: [
          {
            id: 'PATTERN-2',
            title: 'Code Review',
            description: 'Review code before committing',
            action: 'Run code review checklist',
            validation: {
              type: 'custom' as const,
              rule: 'Check code quality',
              message: 'Code review needed',
              severity: 'warning' as const
            },
            applicableStates: ['REVIEWING' as WorkflowState],
            content: 'Full content',
            createdAt: new Date().toISOString()
          }
        ]
      };

      const section = provider.generateContextSection(patterns, 'REVIEWING' as WorkflowState);

      expect(section).toContain('Patterns for REVIEWING State');
      expect(section).toContain('RECOMMENDED');
      expect(section).toContain('Code Review');
      expect(section).toContain('Review code before committing');
      expect(section).toContain('Run code review checklist');
    });

    it('should return empty string when no patterns', () => {
      const patterns = {
        mandatory: [],
        recommended: []
      };

      const section = provider.generateContextSection(patterns, 'IMPLEMENTING' as WorkflowState);

      expect(section).toBe('');
    });
  });

  describe('validatePatternCompliance', () => {
    it('should validate file_exists type - file exists', async () => {
      const testFile = path.join(testContextDir, 'test-file.md');
      await fs.writeFile(testFile, 'test content');

      const pattern: StateBasedPattern = {
        id: 'PATTERN-1',
        title: 'Test File Required',
        description: 'Test file must exist',
        action: 'Create test file',
        validation: {
          type: 'file_exists',
          rule: testFile,
          message: 'Test file missing',
          severity: 'error'
        },
        applicableStates: ['IMPLEMENTING'],
        content: 'Full content',
        createdAt: new Date().toISOString()
      };

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const result = await provider.validatePatternCompliance(pattern, context);

      expect(result.passed).toBe(true);
      expect(result.message).toBe('OK');
    });

    it('should validate file_exists type - file missing', async () => {
      const testFile = path.join(testContextDir, 'missing-file.md');

      const pattern: StateBasedPattern = {
        id: 'PATTERN-1',
        title: 'Test File Required',
        description: 'Test file must exist',
        action: 'Create test file',
        validation: {
          type: 'file_exists',
          rule: testFile,
          message: 'Test file missing',
          severity: 'error'
        },
        applicableStates: ['IMPLEMENTING'],
        content: 'Full content',
        createdAt: new Date().toISOString()
      };

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const result = await provider.validatePatternCompliance(pattern, context);

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Test file missing');
      expect(result.severity).toBe('error');
    });

    it('should interpolate task.id in file path', async () => {
      const taskId = 'test-task-123';
      const testFile = path.join(testContextDir, `${taskId}-test-plan.md`);
      await fs.writeFile(testFile, 'test content');

      const pattern: StateBasedPattern = {
        id: 'PATTERN-1',
        title: 'Test Plan Required',
        description: 'Test plan must exist',
        action: 'Create test plan',
        validation: {
          type: 'file_exists',
          rule: path.join(testContextDir, '${task.id}-test-plan.md'),
          message: 'Test plan missing',
          severity: 'error'
        },
        applicableStates: ['IMPLEMENTING'],
        content: 'Full content',
        createdAt: new Date().toISOString()
      };

      const context: ValidationContext = {
        task: {
          id: taskId,
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const result = await provider.validatePatternCompliance(pattern, context);

      expect(result.passed).toBe(true);
    });

    it('should return guidance for code_check type', async () => {
      const pattern: StateBasedPattern = {
        id: 'PATTERN-1',
        title: 'Code Quality',
        description: 'Check code quality',
        action: 'Review code',
        validation: {
          type: 'code_check',
          rule: 'Check code quality',
          message: 'Code quality check needed',
          severity: 'warning'
        },
        applicableStates: ['REVIEWING'],
        content: 'Full content',
        createdAt: new Date().toISOString()
      };

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'REVIEWING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const result = await provider.validatePatternCompliance(pattern, context);

      expect(result.passed).toBe(false); // Cursor needs to check
      expect(result.message).toBe('Code quality check needed');
      expect(result.severity).toBe('warning');
    });

    it('should return guidance for custom type', async () => {
      const pattern: StateBasedPattern = {
        id: 'PATTERN-1',
        title: 'Custom Pattern',
        description: 'Custom validation',
        action: 'Follow custom rule',
        validation: {
          type: 'custom',
          rule: 'Custom check',
          message: 'Custom validation needed',
          severity: 'info'
        },
        applicableStates: ['IMPLEMENTING'],
        content: 'Full content',
        createdAt: new Date().toISOString()
      };

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const result = await provider.validatePatternCompliance(pattern, context);

      expect(result.passed).toBe(false); // Cursor needs to check
      expect(result.message).toBe('Custom validation needed');
      expect(result.severity).toBe('info');
    });
  });

  describe('validateStatePatterns', () => {
    it('should return violations for non-compliant patterns', async () => {
      const testFile = path.join(testContextDir, 'missing-file.md');

      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Test File Required',
          content: 'Test file must exist',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Test file required',
          action: 'Create test file',
          validation: {
            type: 'file_exists',
            rule: testFile,
            message: 'Test file missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const violations = await provider.validateStatePatterns('IMPLEMENTING', context);

      expect(violations.length).toBe(1);
      expect(violations[0].pattern.id).toBe('PATTERN-1');
      expect(violations[0].passed).toBe(false);
      expect(violations[0].message).toBe('Test file missing');
    });

    it('should return empty array when all patterns compliant', async () => {
      const testFile = path.join(testContextDir, 'existing-file.md');
      await fs.writeFile(testFile, 'test content');

      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Test File Required',
          content: 'Test file must exist',
          applicableStates: ['IMPLEMENTING'],
          description: 'Test file required',
          action: 'Create test file',
          validation: {
            type: 'file_exists',
            rule: testFile,
            message: 'Test file missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const violations = await provider.validateStatePatterns('IMPLEMENTING', context);

      expect(violations.length).toBe(0);
    });

    it('should only return violations (not passed patterns)', async () => {
      const existingFile = path.join(testContextDir, 'existing.md');
      const missingFile = path.join(testContextDir, 'missing.md');
      await fs.writeFile(existingFile, 'content');

      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Existing File',
          content: 'File exists',
          applicableStates: ['IMPLEMENTING'],
          description: 'File exists',
          action: 'Check file',
          validation: {
            type: 'file_exists',
            rule: existingFile,
            message: 'File missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-2',
          title: 'Missing File',
          content: 'File missing',
          applicableStates: ['IMPLEMENTING'],
          description: 'File missing',
          action: 'Create file',
          validation: {
            type: 'file_exists',
            rule: missingFile,
            message: 'File missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ValidationContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      const violations = await provider.validateStatePatterns('IMPLEMENTING', context);

      expect(violations.length).toBe(1);
      expect(violations[0].pattern.id).toBe('PATTERN-2');
    });
  });

  describe('convertToStateBased (backward compatibility)', () => {
    it('should convert legacy pattern to state-based with all states', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-LEGACY',
          title: 'Legacy Pattern',
          content: 'This is a legacy pattern\n\nIt has multiple paragraphs.',
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const result = await provider.getPatternsForState('IMPLEMENTING');

      expect(result.recommended.length).toBe(1);
      const converted = result.recommended[0];
      expect(converted.applicableStates.length).toBe(6); // All states
      expect(converted.requiredStates).toBeUndefined();
      expect(converted.description).toBeTruthy();
      expect(converted.action).toBeTruthy();
      expect(converted.validation).toBeDefined();
    });
  });
});

