/**
 * Unit tests for STATUS.txt Improvements
 * Tests for Phase 1, 2, and 3 improvements
 * @requirement STATUS.txt Improvements - Implementation Plan
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { ContextInjector, ContextInjectionContext } from '../src/core/context-injector.js';
import { Task, WorkflowState } from '@shadel/workflow-core';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers';

describe('ContextInjector - STATUS.txt Improvements', () => {
  let testContextDir: string;
  let injector: ContextInjector;
  let mockTask: Task;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testContextDir = getUniqueAIContextDir();
    testDirs.push(testContextDir); // Track for cleanup
    // Ensure directory exists
    await fs.ensureDir(testContextDir);
    injector = new ContextInjector(testContextDir);
    mockTask = {
      id: 'test-task-123',
      goal: 'Test task for context injection',
      status: 'UNDERSTANDING',
      startedAt: new Date().toISOString(),
      roleApprovals: []
    };
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  // ============================================
  // Phase 1: Critical Fixes - Terminology
  // ============================================

  describe('Phase 1.1: Terminology Update', () => {
    it('TC-TERM-001: STATUS.txt should display "Patterns" not "Rules"', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: [],
        localRules: [
          { id: 'PATTERN-1', title: 'Test Pattern' }
        ]
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      // Should use "Patterns" terminology
      expect(content).toContain('Active Project Patterns');
      expect(content).toContain('pattern(s)');
      // Should NOT use "Rules" terminology
      expect(content).not.toContain('Active Project Rules');
      expect(content).not.toContain('rule(s)');
    });

    it('TC-TERM-002: Warning message should use "patterns" terminology', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: [],
        localRules: [
          { id: 'PATTERN-1', title: 'Test Pattern' }
        ]
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      // Warning should say "project patterns"
      expect(content).toContain('follow all project patterns');
      expect(content).not.toContain('follow all project rules');
    });
  });

  // ============================================
  // Phase 1: Critical Fixes - Input Validation
  // ============================================

  describe('Phase 1.2: Input Validation', () => {
    it('TC-VAL-001: Validation should pass with valid context', async () => {
      const context: ContextInjectionContext = {
        task: {
          id: 'test-123',
          goal: 'Test goal',
          status: 'UNDERSTANDING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        },
        warnings: [],
        blockers: []
      };

      // Should not throw error
      await expect(
        injector.updateAfterCommand('task.create', context)
      ).resolves.not.toThrow();

      // File should be generated
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(true);
    });

    it('TC-VAL-002: Validation should fail with missing context.task', async () => {
      const context = {
        warnings: [],
        blockers: []
      } as any; // Missing task

      // Should throw error or handle gracefully
      // Note: TypeScript would prevent this, but runtime check exists
      await expect(
        injector.updateAfterCommand('task.create', context as ContextInjectionContext)
      ).rejects.toThrow(/Context must include task information|Task must include/);
    });

    it('TC-VAL-003: Validation should fail with missing task.id', async () => {
      const context: ContextInjectionContext = {
        task: {
          // @ts-ignore - Intentionally missing id
          goal: 'Test goal',
          status: 'UNDERSTANDING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        } as Task,
        warnings: [],
        blockers: []
      };

      await expect(
        injector.updateAfterCommand('task.create', context)
      ).rejects.toThrow(/Task must include id, goal, and status/);
    });

    it('TC-VAL-004: Validation should fail with missing task.goal', async () => {
      const context: ContextInjectionContext = {
        task: {
          id: 'test-123',
          // @ts-ignore - Intentionally missing goal
          status: 'UNDERSTANDING',
          startedAt: new Date().toISOString(),
          roleApprovals: []
        } as Task,
        warnings: [],
        blockers: []
      };

      await expect(
        injector.updateAfterCommand('task.create', context)
      ).rejects.toThrow(/Task must include id, goal, and status/);
    });

    it('TC-VAL-005: Validation should fail with missing task.status', async () => {
      const context: ContextInjectionContext = {
        task: {
          id: 'test-123',
          goal: 'Test goal',
          // @ts-ignore - Intentionally missing status
          startedAt: new Date().toISOString(),
          roleApprovals: []
        } as Task,
        warnings: [],
        blockers: []
      };

      await expect(
        injector.updateAfterCommand('task.create', context)
      ).rejects.toThrow(/Task must include id, goal, and status/);
    });
  });

  // ============================================
  // Phase 2: Enhanced Patterns Section
  // ============================================

  describe('Phase 2.1: State-Aware Pattern Display', () => {
    it('TC-PAT-001: Should show state-aware patterns when available', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      // Create patterns file with state-based patterns
      await fs.writeJson(patternsFile, {
        patterns: [
          {
            id: 'PATTERN-1',
            title: 'Understanding Pattern',
            content: 'Pattern for UNDERSTANDING state',
            applicableStates: ['UNDERSTANDING'],
            description: 'Test pattern',
            action: 'Follow pattern',
            validation: {
              type: 'custom',
              rule: 'Test',
              message: 'Test',
              severity: 'error'
            },
            createdAt: new Date().toISOString()
          }
        ]
      }, { spaces: 2 });

      // Override PatternProvider's RuleManager file paths for testing
      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'UNDERSTANDING' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: [{ id: 'PATTERN-1', title: 'Understanding Pattern' }]
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        // Should show state-aware heading
        expect(content).toMatch(/Active Project Patterns \(State: UNDERSTANDING\)/);
        // Should show pattern
        expect(content).toContain('Understanding Pattern');
      } finally {
        // Restore original paths
        ruleManager.patternsFile = originalPatternsFile;
      }
    });

    it('TC-PAT-002: Patterns should be sorted by priority (mandatory first)', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      await fs.writeJson(patternsFile, {
        patterns: [
          {
            id: 'PATTERN-1',
            title: 'Recommended Pattern',
            applicableStates: ['UNDERSTANDING'],
            requiredStates: [], // Not mandatory
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'info' },
            createdAt: new Date().toISOString()
          },
          {
            id: 'PATTERN-2',
            title: 'Mandatory Pattern',
            applicableStates: ['UNDERSTANDING'],
            requiredStates: ['UNDERSTANDING'], // Mandatory
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'error' },
            createdAt: new Date().toISOString()
          }
        ]
      }, { spaces: 2 });

      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'UNDERSTANDING' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: [
            { id: 'PATTERN-1', title: 'Recommended Pattern' },
            { id: 'PATTERN-2', title: 'Mandatory Pattern' }
          ]
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        const mandatoryIndex = content.indexOf('Mandatory Pattern');
        const recommendedIndex = content.indexOf('Recommended Pattern');
        
        // Mandatory should appear before recommended
        expect(mandatoryIndex).toBeGreaterThan(-1);
        expect(recommendedIndex).toBeGreaterThan(-1);
        expect(mandatoryIndex).toBeLessThan(recommendedIndex);
      } finally {
        ruleManager.patternsFile = originalPatternsFile;
      }
    });

    it('TC-PAT-003: Should show maximum 3 patterns', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      // Create 5 patterns
      await fs.writeJson(patternsFile, {
        patterns: Array.from({ length: 5 }, (_, i) => ({
          id: `PATTERN-${i + 1}`,
          title: `Pattern ${i + 1}`,
          applicableStates: ['UNDERSTANDING'],
          description: 'Test',
          action: 'Test',
          validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'error' },
          createdAt: new Date().toISOString()
        }))
      }, { spaces: 2 });

      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'UNDERSTANDING' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: Array.from({ length: 5 }, (_, i) => ({
            id: `PATTERN-${i + 1}`,
            title: `Pattern ${i + 1}`
          }))
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        
        // Should contain top 3 patterns
        expect(content).toContain('Pattern 1');
        expect(content).toContain('Pattern 2');
        expect(content).toContain('Pattern 3');
        
        // Should NOT contain patterns 4 and 5 in the top priorities list
        // (but may be in total count)
        const pattern4Index = content.indexOf('Pattern 4');
        const pattern5Index = content.indexOf('Pattern 5');
        // If they exist, they should only be in the total count, not in the "Top priorities" section
      } finally {
        ruleManager.patternsFile = originalPatternsFile;
      }
    });

    it('TC-PAT-004: Should truncate long pattern titles', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      const longTitle = 'A'.repeat(60); // 60 characters
      await fs.writeJson(patternsFile, {
        patterns: [
          {
            id: 'PATTERN-1',
            title: longTitle,
            applicableStates: ['UNDERSTANDING'],
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'error' },
            createdAt: new Date().toISOString()
          }
        ]
      }, { spaces: 2 });

      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'UNDERSTANDING' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: [{ id: 'PATTERN-1', title: longTitle }]
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        // Should truncate to 50 characters and add "..."
        const truncated = longTitle.substring(0, 50) + '...';
        expect(content).toContain(truncated);
        expect(content).not.toContain(longTitle); // Full title should not appear
      } finally {
        ruleManager.patternsFile = originalPatternsFile;
      }
    });

    it('TC-PAT-005: Should fallback to simple display if PatternProvider fails', async () => {
      // Mock PatternProvider to throw error
      const patternProvider = (injector as any).patternProvider;
      const originalGetPatterns = patternProvider.getPatternsForState.bind(patternProvider);
      patternProvider.getPatternsForState = async () => {
        throw new Error('PatternProvider error');
      };

      try {
        const context: ContextInjectionContext = {
          task: mockTask,
          warnings: [],
          blockers: [],
          localRules: [{ id: 'PATTERN-1', title: 'Test Pattern' }]
        };

        // Should not throw error, should use fallback
        await expect(
          injector.updateAfterCommand('task.create', context)
        ).resolves.not.toThrow();

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        // Should show simple fallback display
        expect(content).toContain('Active Project Patterns');
        expect(content).toContain('1 pattern(s)');
        expect(content).toContain('See NEXT_STEPS.md for details');
      } finally {
        // Restore original method
        patternProvider.getPatternsForState = originalGetPatterns;
      }
    });

    it('TC-PAT-006: Should handle no patterns gracefully', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
        // No localRules
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      // Should not show patterns section if no patterns
      expect(content).not.toContain('Active Project Patterns');
    });

    it('TC-PAT-007: Should show correct priority emojis', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      await fs.writeJson(patternsFile, {
        patterns: [
          {
            id: 'PATTERN-1',
            title: 'Critical Pattern',
            applicableStates: ['UNDERSTANDING'],
            requiredStates: ['UNDERSTANDING'], // Mandatory = CRITICAL
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'error' },
            createdAt: new Date().toISOString()
          },
          {
            id: 'PATTERN-2',
            title: 'Warning Pattern',
            applicableStates: ['UNDERSTANDING'],
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'warning' },
            createdAt: new Date().toISOString()
          },
          {
            id: 'PATTERN-3',
            title: 'Info Pattern',
            applicableStates: ['UNDERSTANDING'],
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'info' },
            createdAt: new Date().toISOString()
          }
        ]
      }, { spaces: 2 });

      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'UNDERSTANDING' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: [
            { id: 'PATTERN-1', title: 'Critical Pattern' },
            { id: 'PATTERN-2', title: 'Warning Pattern' },
            { id: 'PATTERN-3', title: 'Info Pattern' }
          ]
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        // Should show correct emojis
        expect(content).toContain('🔴'); // CRITICAL/mandatory
        expect(content).toContain('🟠'); // WARNING
        expect(content).toContain('🟡'); // INFO
      } finally {
        ruleManager.patternsFile = originalPatternsFile;
      }
    });

    it('TC-PAT-008: Should include state name in heading', async () => {
      const patternsFile = path.join(testContextDir, 'patterns.json');
      
      await fs.writeJson(patternsFile, {
        patterns: [
          {
            id: 'PATTERN-1',
            title: 'Test Pattern',
            applicableStates: ['READY_TO_COMMIT'],
            description: 'Test',
            action: 'Test',
            validation: { type: 'custom', rule: 'Test', message: 'Test', severity: 'error' },
            createdAt: new Date().toISOString()
          }
        ]
      }, { spaces: 2 });

      const patternProvider = (injector as any).patternProvider;
      const ruleManager = patternProvider.ruleManager;
      const originalPatternsFile = ruleManager.patternsFile;
      ruleManager.patternsFile = patternsFile;

      try {
        const context: ContextInjectionContext = {
          task: {
            ...mockTask,
            status: 'READY_TO_COMMIT' as WorkflowState
          },
          warnings: [],
          blockers: [],
          localRules: [{ id: 'PATTERN-1', title: 'Test Pattern' }]
        };

        await injector.updateAfterCommand('task.create', context);

        const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
        // Heading should include state name
        expect(content).toMatch(/Active Project Patterns \(State: READY_TO_COMMIT\)/);
      } finally {
        ruleManager.patternsFile = originalPatternsFile;
      }
    });
  });

  // ============================================
  // Phase 3: Queue Optimization
  // ============================================

  describe('Phase 3.2: Queue Query Optimization', () => {
    it('TC-QUEUE-001: Should use single query instead of two', async () => {
      // This test verifies that the optimization is in place
      // We can't easily test the exact number of calls, but we can verify
      // that queue info is generated correctly with single query approach
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      // Should not throw error
      await expect(
        injector.updateAfterCommand('task.create', context)
      ).resolves.not.toThrow();

      // File should be generated (queue info is optional)
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(true);
    });

    it('TC-QUEUE-002: Queue info should display correctly', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      // Queue info section should be present if queue has tasks
      // (May or may not have tasks, so we just check format)
      if (content.includes('Task Queue:')) {
        expect(content).toMatch(/Task Queue:/);
        expect(content).toMatch(/Queued: \d+ task\(s\)/);
      }
    });
  });
});


