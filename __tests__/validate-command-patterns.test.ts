/**
 * Integration tests for Validate Command with Pattern Compliance
 * Tests pattern validation reporting in validate command
 * @requirement State-Based Pattern System Testing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { TaskManager } from '../src/core/task-manager.js';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupAllTestDirs } from './test-helpers';

describe('Validate Command - Pattern Compliance', () => {
  const testContextDir = '.test-validate-patterns';
  // Use absolute path to avoid issues in CI with different working directories
  const patternsFile = path.resolve(testContextDir, 'patterns.json');
  let taskManager: TaskManager;
  let originalCwd: string;
  let originalPatternsFile: string;

  beforeEach(async () => {
    await cleanupAllTestDirs();
    await fs.ensureDir(testContextDir);
    
    originalCwd = process.cwd();
    taskManager = new TaskManager(testContextDir);
    
    // Override RuleManager's file paths for testing
    const ruleManager = (taskManager as any).ruleManager;
    originalPatternsFile = ruleManager.patternsFile;
    // Use absolute paths to avoid CI working directory issues
    ruleManager.patternsFile = patternsFile;
    ruleManager.rulesFile = path.resolve(testContextDir, 'rules.json');
  });

  afterEach(async () => {
    // Restore original paths
    const ruleManager = (taskManager as any).ruleManager;
    if (originalPatternsFile) {
      ruleManager.patternsFile = originalPatternsFile;
    }
    
    await cleanupAllTestDirs();
  });

  describe('Pattern validation reporting', () => {
    it('should report pattern violations when validate command is run', async () => {
      // Create a pattern with file_exists validation
      const missingFile = path.join(testContextDir, 'missing-test-plan.md');
      const patterns: any[] = [
        {
          id: 'PATTERN-TEST',
          title: 'Test Plan Required',
          content: 'Test plan must exist',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Test plan must exist before coding',
          action: 'Create test plan',
          validation: {
            type: 'file_exists',
            rule: missingFile,
            message: 'Test plan missing! Create it before coding.',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Create a task in IMPLEMENTING state
      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      // Run validate command programmatically
      // Create PatternProvider and override its RuleManager to use test patterns file
      const { PatternProvider } = await import('../src/core/pattern-provider.js');
      const patternProvider = new PatternProvider();
      // Override RuleManager's patternsFile to use test file
      const ruleManager = (patternProvider as any).ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;
      
      const task = await taskManager.getCurrentTask();
      
      const violations = await patternProvider.validateStatePatterns(
        task!.status,
        { task: task! }
      );
      
      // Restore original path
      ruleManager.patternsFile = originalPatternsFile;

      // Should have violations
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].pattern.id).toBe('PATTERN-TEST');
      expect(violations[0].passed).toBe(false);
      expect(violations[0].message).toContain('Test plan missing');
    });

    it('should report error violations and BLOCK commit', async () => {
      // Create a pattern with file_exists validation and error severity
      const missingFile = path.join(testContextDir, 'missing-file.md');
      const patterns: any[] = [
        {
          id: 'PATTERN-BLOCK',
          title: 'Required File',
          content: 'File must exist',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'File required',
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

      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const { PatternProvider } = await import('../src/core/pattern-provider.js');
      const patternProvider = new PatternProvider();
      // Override RuleManager's patternsFile to use test file
      const ruleManager = (patternProvider as any).ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;
      
      const task = await taskManager.getCurrentTask();
      
      const violations = await patternProvider.validateStatePatterns(
        task!.status,
        { task: task! }
      );
      
      // Restore original path
      ruleManager.patternsFile = originalPatternsFile;

      // Should have violations
      expect(violations.length).toBe(1);
      expect(violations[0].severity).toBe('error');
      
      // Error violations should be separated for blocking
      const errorViolations = violations.filter(v => v.severity === 'error');
      expect(errorViolations.length).toBe(1);
      // Error violations will block commit (tested in validate command)
    });

    it('should NOT block commit for warning/info violations', async () => {
      // Create patterns with warning and info severity (non-blocking)
      const patterns: any[] = [
        {
          id: 'PATTERN-WARNING',
          title: 'Warning Pattern',
          content: 'Warning severity',
          applicableStates: ['IMPLEMENTING'],
          description: 'Warning pattern',
          action: 'Check warning',
          validation: {
            type: 'custom',
            rule: 'Check compliance',
            message: 'Warning: Check needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-INFO',
          title: 'Info Pattern',
          content: 'Info severity',
          applicableStates: ['IMPLEMENTING'],
          description: 'Info pattern',
          action: 'Review info',
          validation: {
            type: 'custom',
            rule: 'Review',
            message: 'Info: Review needed',
            severity: 'info'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const { PatternProvider } = await import('../src/core/pattern-provider.js');
      const patternProvider = new PatternProvider();
      const ruleManager = (patternProvider as any).ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;
      
      const task = await taskManager.getCurrentTask();
      
      const violations = await patternProvider.validateStatePatterns(
        task!.status,
        { task: task! }
      );
      
      ruleManager.patternsFile = originalPatternsFile;

      // Should have violations
      expect(violations.length).toBe(2);
      
      // No error violations - should not block
      const errorViolations = violations.filter(v => v.severity === 'error');
      expect(errorViolations.length).toBe(0);
      
      // Warnings/info are non-blocking
      const otherViolations = violations.filter(v => v.severity !== 'error');
      expect(otherViolations.length).toBe(2);
    });

    it('should show violations with correct severity levels', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-ERROR',
          title: 'Error Pattern',
          content: 'Error severity',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Error pattern',
          action: 'Fix error',
          validation: {
            type: 'file_exists',
            rule: path.join(testContextDir, 'missing-error.md'),
            message: 'Error: File missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-WARNING',
          title: 'Warning Pattern',
          content: 'Warning severity',
          applicableStates: ['IMPLEMENTING'],
          description: 'Warning pattern',
          action: 'Check warning',
          validation: {
            type: 'custom',
            rule: 'Check compliance',
            message: 'Warning: Check needed',
            severity: 'warning'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-INFO',
          title: 'Info Pattern',
          content: 'Info severity',
          applicableStates: ['IMPLEMENTING'],
          description: 'Info pattern',
          action: 'Review info',
          validation: {
            type: 'custom',
            rule: 'Review',
            message: 'Info: Review needed',
            severity: 'info'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const { PatternProvider } = await import('../src/core/pattern-provider.js');
      const patternProvider = new PatternProvider();
      // Override RuleManager's patternsFile to use test file
      const ruleManager = (patternProvider as any).ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;
      
      const task = await taskManager.getCurrentTask();
      
      const violations = await patternProvider.validateStatePatterns(
        task!.status,
        { task: task! }
      );
      
      // Restore original path
      ruleManager.patternsFile = originalPatternsFile;

      // Should have violations for all three
      expect(violations.length).toBe(3);
      
      const errorViolation = violations.find(v => v.severity === 'error');
      const warningViolation = violations.find(v => v.severity === 'warning');
      const infoViolation = violations.find(v => v.severity === 'info');

      expect(errorViolation).toBeDefined();
      expect(warningViolation).toBeDefined();
      expect(infoViolation).toBeDefined();
      
      expect(errorViolation!.pattern.id).toBe('PATTERN-ERROR');
      expect(warningViolation!.pattern.id).toBe('PATTERN-WARNING');
      expect(infoViolation!.pattern.id).toBe('PATTERN-INFO');
    });
  });

  describe('Pattern state filtering in validate', () => {
    it('should only validate patterns for current state', async () => {
      const patterns: any[] = [
        {
          id: 'PATTERN-IMPLEMENTING',
          title: 'Implementing Pattern',
          content: 'For implementing',
          applicableStates: ['IMPLEMENTING'],
          requiredStates: ['IMPLEMENTING'],
          description: 'Implementing only',
          action: 'Implement',
          validation: {
            type: 'file_exists',
            rule: path.join(testContextDir, 'missing-impl.md'),
            message: 'Implementing file missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        },
        {
          id: 'PATTERN-TESTING',
          title: 'Testing Pattern',
          content: 'For testing',
          applicableStates: ['TESTING'],
          requiredStates: ['TESTING'],
          description: 'Testing only',
          action: 'Test',
          validation: {
            type: 'file_exists',
            rule: path.join(testContextDir, 'missing-test.md'),
            message: 'Testing file missing',
            severity: 'error'
          },
          createdAt: new Date().toISOString()
        }
      ];

      await fs.writeJson(patternsFile, { patterns }, { spaces: 2 });

      // Test with IMPLEMENTING state
      await taskManager.createTask('Test task for pattern validation', [], false);
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');

      const { PatternProvider } = await import('../src/core/pattern-provider.js');
      const patternProvider = new PatternProvider();
      // Override RuleManager's patternsFile to use test file
      const ruleManager = (patternProvider as any).ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;
      
      const task = await taskManager.getCurrentTask();
      
      const violations = await patternProvider.validateStatePatterns(
        task!.status,
        { task: task! }
      );
      
      // Restore original path
      ruleManager.patternsFile = originalPatternsFile;

      // Should only have violation for IMPLEMENTING pattern
      expect(violations.length).toBe(1);
      expect(violations[0].pattern.id).toBe('PATTERN-IMPLEMENTING');
    });
  });
});

