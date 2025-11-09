/**
 * Unit tests for Context Injector
 * @requirement REQ-V2-010 - Context Injection System
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { ContextInjector, ContextInjectionContext } from '../src/core/context-injector.js';
import { Task } from '@workflow/core';

describe('ContextInjector', () => {
  const testContextDir = '.test-ai-context';
  let injector: ContextInjector;
  let mockTask: Task;

  beforeEach(async () => {
    injector = new ContextInjector(testContextDir);
    mockTask = {
      id: 'test-task-123',
      goal: 'Test task for context injection',
      status: 'UNDERSTANDING',
      startedAt: new Date().toISOString(),
      roleApprovals: []
    };

    // Clean up test directory
    await fs.remove(testContextDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testContextDir);
  });

  describe('updateAfterCommand', () => {
    it('should create all context files after command', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      // Check files exist
      expect(await fs.pathExists(`${testContextDir}/STATUS.txt`)).toBe(true);
      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(true);
    });

    it('should create warnings file when warnings exist', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: ['Test warning 1', 'Test warning 2'],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      expect(await fs.pathExists(`${testContextDir}/WARNINGS.md`)).toBe(true);
    });

    it('should clear warnings file when no warnings', async () => {
      // Create warnings file first
      await fs.ensureDir('.ai-context');
      await fs.writeFile(`${testContextDir}/WARNINGS.md`, 'test', 'utf-8');

      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      expect(await fs.pathExists(`${testContextDir}/WARNINGS.md`)).toBe(false);
    });
  });

  describe('STATUS.txt generation', () => {
    it('should include task ID and goal', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toContain(mockTask.id);
      expect(content).toContain(mockTask.goal);
    });

    it('should include workflow state', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toContain('UNDERSTANDING');
    });

    it('should display warnings when present', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: ['Test warning'],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toContain('Test warning');
    });

    it('should display blockers when present', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: ['Test blocker']
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toContain('Test blocker');
    });

    it('should have rich visual formatting', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toContain('╔');  // Box drawing
      expect(content).toContain('🤖'); // Emoji
      expect(content).toContain('⚠️');  // Warning emoji
    });
  });

  describe('NEXT_STEPS.md generation', () => {
    it('should create next steps file', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      expect(await fs.pathExists(`${testContextDir}/NEXT_STEPS.md`)).toBe(true);
    });

    it('should recommend correct actions after task.create', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/NEXT_STEPS.md`, 'utf-8');
      expect(content).toContain('Start working on your task');
      expect(content).toContain('npx ai-workflow sync');
    });

    it('should recommend testing after IMPLEMENTATION_COMPLETE', async () => {
      const context: ContextInjectionContext = {
        task: { ...mockTask, status: 'IMPLEMENTATION_COMPLETE' },
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('sync', context);

      const content = await fs.readFile(`${testContextDir}/NEXT_STEPS.md`, 'utf-8');
      expect(content).toContain('Add tests');
    });

    it('should recommend commit when validation passes', async () => {
      const context: ContextInjectionContext = {
        task: { ...mockTask, status: 'COMMIT_READY' },
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('validate', context);

      const content = await fs.readFile(`${testContextDir}/NEXT_STEPS.md`, 'utf-8');
      expect(content).toContain('Commit your changes');
      expect(content).toContain('git commit');
    });

    it('should show workflow progress visualization', async () => {
      const context: ContextInjectionContext = {
        task: { ...mockTask, status: 'DESIGN_COMPLETE' },
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('sync', context);

      const content = await fs.readFile(`${testContextDir}/NEXT_STEPS.md`, 'utf-8');
      expect(content).toContain('✅'); // Completed
      expect(content).toContain('⏳'); // Current
      expect(content).toContain('⏸️'); // Pending
    });
  });

  describe('WARNINGS.md generation', () => {
    it('should create warnings file with warnings', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: ['Warning 1', 'Warning 2'],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/WARNINGS.md`, 'utf-8');
      expect(content).toContain('Warning 1');
      expect(content).toContain('Warning 2');
    });

    it('should include blockers in warnings file', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: ['Warning'],
        blockers: ['Blocker 1']
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/WARNINGS.md`, 'utf-8');
      expect(content).toContain('Blocker 1');
    });
  });

  describe('clearWarnings', () => {
    it('should remove warnings file', async () => {
      // Create warnings file
      await fs.ensureDir('.ai-context');
      await fs.writeFile(`${testContextDir}/WARNINGS.md`, 'test', 'utf-8');

      await injector.clearWarnings();

      expect(await fs.pathExists(`${testContextDir}/WARNINGS.md`)).toBe(false);
    });

    it('should not error if warnings file does not exist', async () => {
      await expect(injector.clearWarnings()).resolves.not.toThrow();
    });
  });

  describe('timestamps', () => {
    it('should include timestamps in STATUS.txt', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/STATUS.txt`, 'utf-8');
      expect(content).toMatch(/Last Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include timestamps in NEXT_STEPS.md', async () => {
      const context: ContextInjectionContext = {
        task: mockTask,
        warnings: [],
        blockers: []
      };

      await injector.updateAfterCommand('task.create', context);

      const content = await fs.readFile(`${testContextDir}/NEXT_STEPS.md`, 'utf-8');
      expect(content).toMatch(/\*\*Updated:\*\* \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});

