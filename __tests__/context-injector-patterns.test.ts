/**
 * Integration tests for Context Injector with State-Based Patterns
 * Tests state-filtered pattern injection in NEXT_STEPS.md
 * @requirement State-Based Pattern System Testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { ContextInjector, ContextInjectionContext } from '../src/core/context-injector.js';
import { Task, WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs } from './test-helpers';

describe('ContextInjector - State-Based Patterns', () => {
  const testContextDir = '.test-context-injector-patterns';
  const patternsFile = path.join(testContextDir, 'patterns.json');
  let injector: ContextInjector;
  let originalPatternsFile: string;

  beforeEach(async () => {
    await cleanupAllTestDirs();
    await fs.ensureDir(testContextDir);
    injector = new ContextInjector(testContextDir);
    
    // Override PatternProvider's RuleManager file paths for testing
    const patternProvider = (injector as any).patternProvider;
    const ruleManager = patternProvider.ruleManager;
    originalPatternsFile = ruleManager.patternsFile;
    ruleManager.patternsFile = patternsFile;
    ruleManager.rulesFile = path.join(testContextDir, 'rules.json');
  });

  afterEach(async () => {
    // Restore original paths
    const patternProvider = (injector as any).patternProvider;
    if (patternProvider && originalPatternsFile) {
      patternProvider.ruleManager.patternsFile = originalPatternsFile;
    }
    await cleanupAllTestDirs();
  });

  describe('State-based pattern injection', () => {
    it('should inject state-filtered patterns into NEXT_STEPS.md', async () => {
      // Create state-based patterns
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Test Plan Required',
          content: 'Test plan must exist before coding',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Test plan must exist before coding',
          action: 'Create test plan: npx ai-workflow generate test-plan <file>',
          validation: {
            type: 'file_exists',
            rule: 'docs/test-plans/${task.id}-test-plan.md',
            message: 'Test plan missing! Create it before coding.',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-2',
          title: 'Code Review',
          content: 'Review code before committing',
          applicableStates: ['REVIEWING'],
          description: 'Review code before committing',
          action: 'Run code review checklist',
          validation: {
            type: 'custom',
            rule: 'Check code quality',
            message: 'Code review needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ContextInjectionContext = {
        task: {
          id: 'test-task-123',
          goal: 'Implement feature X',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should contain IMPLEMENTING pattern
      expect(nextStepsContent).toContain('Patterns for IMPLEMENTING State');
      expect(nextStepsContent).toContain('Test Plan Required');
      expect(nextStepsContent).toContain('MANDATORY');
      expect(nextStepsContent).toContain('Create test plan: npx ai-workflow generate test-plan <file>');

      // Should NOT contain REVIEWING pattern
      expect(nextStepsContent).not.toContain('Code Review');
    });

    it('should show mandatory patterns before recommended', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Recommended Pattern',
          content: 'Recommended but not mandatory',
          applicableStates: ['IMPLEMENTING'],
          description: 'Recommended pattern',
          action: 'Follow recommendation',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Recommended',
            severity: 'info'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-2',
          title: 'Mandatory Pattern',
          content: 'This is mandatory',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Mandatory pattern',
          action: 'Must do this',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Mandatory',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Find positions
      const mandatoryPos = nextStepsContent.indexOf('Mandatory Pattern');
      const recommendedPos = nextStepsContent.indexOf('Recommended Pattern');

      // Mandatory should be present
      expect(mandatoryPos).toBeGreaterThan(-1);
      
      // Recommended should be shown even when MANDATORY exists (after our fix)
      // @see packages/workflow-core/src/core/pattern-provider.ts line 303
      // Recommended patterns now always show if they exist
      expect(recommendedPos).toBeGreaterThan(-1);
      
      // Mandatory should appear before recommended
      expect(mandatoryPos).toBeLessThan(recommendedPos);
      
      // Verify MANDATORY section exists
      expect(nextStepsContent).toContain('⚠️ MANDATORY');
      
      // Verify RECOMMENDED section exists
      expect(nextStepsContent).toContain('💡 RECOMMENDED');
    });

    it('should filter patterns by current state', async () => {
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

      // Test with IMPLEMENTING state
      const context1: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context1);
      const content1 = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      expect(content1).toContain('Implementing Pattern');
      expect(content1).not.toContain('Testing Pattern');

      // Clean and test with TESTING state
      await fs.remove(path.join(testContextDir, 'NEXT_STEPS.md'));

      const context2: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'TESTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context2);
      const content2 = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      expect(content2).toContain('Testing Pattern');
      expect(content2).not.toContain('Implementing Pattern');
    });

    it('should maintain backward compatibility with legacy patterns', async () => {
      // Legacy pattern without state fields
      const patterns: any[] = [
        {
          id: 'PATTERN-LEGACY',
          title: 'Legacy Pattern',
          content: 'This is a legacy pattern without state fields',
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        },
        localRules: patterns // Simulate old behavior
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should show pattern (either state-based or fallback)
      expect(nextStepsContent).toContain('Pattern');
    });

    it('should handle empty patterns gracefully', async () => {
      await fs.writeJson(patternsFile, { patterns: [] }, { spaces: 2 });

      const context: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should not crash, file should exist
      expect(nextStepsContent).toBeTruthy();
      // Should not contain pattern section if no patterns
      expect(nextStepsContent).not.toContain('Patterns for IMPLEMENTING State');
    });

    it('should include validation details in pattern display', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-1',
          title: 'Test Plan Required',
          content: 'Test plan must exist',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Test plan must exist before coding',
          action: 'Create test plan',
          validation: {
            type: 'file_exists',
            rule: 'docs/test-plans/${task.id}-test-plan.md',
            message: 'Test plan missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      const context: ContextInjectionContext = {
        task: {
          id: 'test-task',
          goal: 'Test task',
          status: 'IMPLEMENTING' as WorkflowState,
          startedAt: new Date().toISOString(),
          roleApprovals: []
        }
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should include validation details
      expect(nextStepsContent).toContain('Validation:');
      expect(nextStepsContent).toContain('Type: file_exists');
      expect(nextStepsContent).toContain('Severity: error');
      expect(nextStepsContent).toContain('docs/test-plans/${task.id}-test-plan.md');
    });
  });
});

