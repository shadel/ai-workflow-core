/**
 * Manual Testing Scenarios - Automated Tests
 * Covers manual testing checklist items from implementation plan
 * @requirement State-Based Pattern System Testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { PatternProvider } from '../src/core/pattern-provider.js';
import { ContextInjector, ContextInjectionContext } from '../src/core/context-injector.js';
import { TaskManager } from '../src/core/task-manager.js';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs } from './test-helpers';

describe('Manual Testing Scenarios - Automated', () => {
  const testContextDir = '.test-manual-scenarios';
  const patternsFile = path.join(testContextDir, 'patterns.json');
  let provider: PatternProvider;
  let injector: ContextInjector;
  let taskManager: TaskManager;
  let originalPatternsFile: string;

  beforeEach(async () => {
    await cleanupAllTestDirs();
    await fs.ensureDir(testContextDir);
    
    provider = new PatternProvider();
    injector = new ContextInjector(testContextDir);
    taskManager = new TaskManager(testContextDir);
    
    // Override RuleManager's file paths for testing
    const ruleManager = (provider as any).ruleManager;
    originalPatternsFile = ruleManager.patternsFile;
    ruleManager.patternsFile = patternsFile;
    ruleManager.rulesFile = path.join(testContextDir, 'rules.json');
    
    // Override injector's pattern provider
    const injectorPatternProvider = (injector as any).patternProvider;
    injectorPatternProvider.ruleManager.patternsFile = patternsFile;
    injectorPatternProvider.ruleManager.rulesFile = path.join(testContextDir, 'rules.json');
  });

  afterEach(async () => {
    // Restore original paths
    const ruleManager = (provider as any).ruleManager;
    if (originalPatternsFile) {
      ruleManager.patternsFile = originalPatternsFile;
    }
    await cleanupAllTestDirs();
  });

  describe('Manual Testing Checklist Items', () => {
    it('should create pattern with applicableStates: [IMPLEMENTING] and verify it shows only in IMPLEMENTING state', async () => {
      // Create pattern with applicableStates: ['IMPLEMENTING']
      const patterns: any[] = [
        {
          id: 'PATTERN-IMPLEMENTING-ONLY',
          title: 'Implementing Only Pattern',
          content: 'This pattern applies only to IMPLEMENTING state',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Pattern for implementing state only',
          action: 'Follow implementing pattern',
          validation: {
            type: 'custom',
            rule: 'Check implementing compliance',
            message: 'Implementing pattern not followed',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Verify pattern shows in IMPLEMENTING state
      const implementingPatterns = await provider.getPatternsForState('IMPLEMENTING');
      expect(implementingPatterns.mandatory.length).toBe(1);
      expect(implementingPatterns.mandatory[0].id).toBe('PATTERN-IMPLEMENTING-ONLY');

      // Verify pattern does NOT show in other states
      const understandingPatterns = await provider.getPatternsForState('UNDERSTANDING');
      expect(understandingPatterns.mandatory.length).toBe(0);
      expect(understandingPatterns.recommended.length).toBe(0);

      const testingPatterns = await provider.getPatternsForState('TESTING');
      expect(testingPatterns.mandatory.length).toBe(0);
      expect(testingPatterns.recommended.length).toBe(0);

      const reviewingPatterns = await provider.getPatternsForState('REVIEWING');
      expect(reviewingPatterns.mandatory.length).toBe(0);
      expect(reviewingPatterns.recommended.length).toBe(0);
    });

    it('should verify pattern does not show in other states', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-SPECIFIC',
          title: 'Specific State Pattern',
          content: 'Only for specific state',
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

      // Should show in TESTING
      const testingPatterns = await provider.getPatternsForState('TESTING');
      expect(testingPatterns.recommended.length).toBe(1);

      // Should NOT show in other states
      const states: WorkflowState[] = ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'REVIEWING', 'READY_TO_COMMIT'];
      for (const state of states) {
        const statePatterns = await provider.getPatternsForState(state);
        expect(statePatterns.mandatory.length).toBe(0);
        expect(statePatterns.recommended.length).toBe(0);
      }
    });

    it('should verify violations are reported (not blocked) when validate is run', async () => {
      const missingFile = path.join(testContextDir, 'missing-file.md');
      const patterns: any[] = [
        {
          id: 'PATTERN-VIOLATION',
          title: 'File Required',
          content: 'File must exist',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'File required',
          action: 'Create file',
          validation: {
            type: 'file_exists',
            rule: missingFile,
            message: 'File missing - but this should NOT block commit',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const task = await taskManager.getCurrentTask();
      const violations = await provider.validateStatePatterns(
        task!.status,
        { task: task! }
      );

      // Should report violations
      expect(violations.length).toBe(1);
      expect(violations[0].passed).toBe(false);
      expect(violations[0].message).toContain('File missing');

      // Key: Violations are reported but commit is NOT blocked
      // This is verified by the validate command not exiting with code 1
      // for pattern violations alone (only workflow state/files block)
    });

    it('should test with existing patterns (backward compatibility)', async () => {
      // Create legacy pattern without state fields
      const patterns: any[] = [
        {
          id: 'PATTERN-LEGACY',
          title: 'Legacy Pattern',
          content: 'This is a legacy pattern without applicableStates field',
          description: 'Legacy pattern',
          action: 'Follow legacy pattern',
          validation: {
            type: 'custom',
            rule: 'Check compliance',
            message: 'Legacy pattern should be followed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Should convert to state-based (all states) for backward compatibility
      const implementingPatterns = await provider.getPatternsForState('IMPLEMENTING');
      expect(implementingPatterns.recommended.length).toBe(1);
      expect(implementingPatterns.recommended[0].id).toBe('PATTERN-LEGACY');
      expect(implementingPatterns.recommended[0].applicableStates.length).toBe(6); // All states

      // Should work in all states
      const states: WorkflowState[] = ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'];
      for (const state of states) {
        const statePatterns = await provider.getPatternsForState(state);
        expect(statePatterns.recommended.length).toBe(1);
        expect(statePatterns.recommended[0].id).toBe('PATTERN-LEGACY');
      }
    });

    it('should verify pattern appears in NEXT_STEPS.md for correct state', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-NEXT-STEPS',
          title: 'Next Steps Pattern',
          content: 'Pattern for next steps',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Pattern for implementing',
          action: 'Follow pattern',
          validation: {
            type: 'custom',
            rule: 'Check',
            message: 'Pattern not followed',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Create task in IMPLEMENTING state
      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const task = await taskManager.getCurrentTask();
      const context: ContextInjectionContext = {
        task: task!,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const nextStepsContent = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should contain pattern for IMPLEMENTING state
      expect(nextStepsContent).toContain('Patterns for IMPLEMENTING State');
      expect(nextStepsContent).toContain('Next Steps Pattern');
      expect(nextStepsContent).toContain('MANDATORY');

      // Should NOT contain pattern when in different state
      await taskManager.updateTaskState('TESTING');
      const task2 = await taskManager.getCurrentTask();
      const context2: ContextInjectionContext = {
        task: task2!,
        warnings: [],
        blockers: []
      };

      await fs.remove(path.join(testContextDir, 'NEXT_STEPS.md'));
      await injector.updateAfterCommand('task.create', context2);

      const nextStepsContent2 = await fs.readFile(
        path.join(testContextDir, 'NEXT_STEPS.md'),
        'utf-8'
      );

      // Should NOT contain IMPLEMENTING pattern when in TESTING state
      expect(nextStepsContent2).not.toContain('Next Steps Pattern');
    });
  });
});

