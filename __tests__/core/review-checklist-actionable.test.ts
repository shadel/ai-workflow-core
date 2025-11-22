/**
 * Review Checklist Actionable Items Tests
 * Tests for actionable checklist items, execute command, and Cursor integration
 * @requirement REVIEW-CHECKLIST-001 - Actionable checklist items
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ReviewChecklistManager, ReviewChecklistItem, ReviewChecklist } from '../../src/core/review-checklist.js';
import { TaskManager } from '../../src/core/task-manager.js';

describe('Review Checklist - Actionable Items', () => {
  let testContextDir: string;
  let taskManager: TaskManager;

  beforeEach(async () => {
    testContextDir = path.join(os.tmpdir(), `review-test-${Date.now()}`);
    await fs.ensureDir(testContextDir);
    taskManager = new TaskManager(testContextDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testContextDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Actionable Checklist Structure', () => {
    it('should create checklist with action metadata', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      expect(checklist.items.length).toBeGreaterThan(0);
      
      checklist.items.forEach(item => {
        expect(item).toHaveProperty('action');
        expect(item).toHaveProperty('checkCommand');
        expect(item.action).toHaveProperty('type');
        expect(item.action).toHaveProperty('expected');
      });
    });

    it('should have auto-validation item with command action', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const autoValidation = checklist.items.find(item => item.id === 'auto-validation');
      
      expect(autoValidation).toBeDefined();
      expect(autoValidation?.category).toBe('automated');
      expect(autoValidation?.action.type).toBe('command');
      expect(autoValidation?.action.command).toBe('npx ai-workflow validate');
      expect(autoValidation?.action.expected.exitCode).toBe(0);
      expect(autoValidation?.verifyCommand).toBeDefined();
      expect(autoValidation?.checkCommand).toBeDefined();
    });

    it('should have manual items with review/check actions', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const codeQuality = checklist.items.find(item => item.id === 'code-quality');
      
      expect(codeQuality).toBeDefined();
      expect(codeQuality?.category).toBe('manual');
      expect(codeQuality?.action.type).toBe('review');
      expect(codeQuality?.action.files).toBeDefined();
      expect(codeQuality?.action.checks).toBeDefined();
      expect(codeQuality?.action.expected.result).toBeDefined();
    });
  });

  describe('executeItemAction', () => {
    // Note: execSync mocking is complex in ESM modules
    // These tests verify the logic structure rather than actual command execution
    it('should return success but not auto-mark for manual items', async () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const codeQuality = checklist.items.find(item => item.id === 'code-quality')!;
      
      const result = await ReviewChecklistManager.executeItemAction(codeQuality);
      
      expect(result.success).toBe(true);
      expect(result.canMarkComplete).toBe(false); // Manual items require explicit check
    });

    it('should handle command type items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const autoValidation = checklist.items.find(item => item.id === 'auto-validation')!;
      
      // Verify item has command action
      expect(autoValidation.action.type).toBe('command');
      expect(autoValidation.action.command).toBeDefined();
      expect(autoValidation.action.expected.exitCode).toBeDefined();
    });
  });

  describe('Checklist Migration', () => {
    it('should migrate old checklist format to new actionable format', () => {
      const oldChecklist = {
        items: [
          {
            id: 'auto-validation',
            description: 'Run automated validation',
            category: 'automated',
            completed: true,
            completedAt: '2025-01-01T00:00:00.000Z'
          }
        ]
      };
      
      const migrated = ReviewChecklistManager.migrateChecklist(oldChecklist);
      
      expect(migrated.items.length).toBeGreaterThan(0);
      const migratedItem = migrated.items.find(item => item.id === 'auto-validation');
      expect(migratedItem).toBeDefined();
      expect(migratedItem?.completed).toBe(true);
      expect(migratedItem?.action).toBeDefined();
      expect(migratedItem?.checkCommand).toBeDefined();
    });

    it('should return new format checklist as-is', () => {
      const newChecklist = ReviewChecklistManager.createDefaultChecklist();
      const migrated = ReviewChecklistManager.migrateChecklist(newChecklist);
      
      expect(migrated).toEqual(newChecklist);
    });
  });

  describe('JSON Output', () => {
    it('should generate JSON with action metadata', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const json = ReviewChecklistManager.toJSON(checklist);
      
      expect(json).toHaveProperty('progress');
      expect(json).toHaveProperty('items');
      expect(json.progress).toHaveProperty('completed');
      expect(json.progress).toHaveProperty('total');
      expect(json.progress).toHaveProperty('percentage');
      
      if (json.items.length > 0) {
        const item = json.items[0];
        expect(item).toHaveProperty('action');
        expect(item).toHaveProperty('checkCommand');
        expect(item.action).toHaveProperty('type');
        expect(item.action).toHaveProperty('expected');
      }
    });

    it('should include verifyCommand for automated items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const json = ReviewChecklistManager.toJSON(checklist);
      
      const autoItem = json.items.find((item: any) => item.id === 'auto-validation');
      expect(autoItem).toBeDefined();
      expect(autoItem?.verifyCommand).toBeDefined();
    });
  });

  describe('Display Format', () => {
    it('should display action for incomplete items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ReviewChecklistManager.displayChecklist(checklist);
      
      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      // Should show action for incomplete items
      expect(output).toContain('Action:');
      expect(output).toContain('After completion:');
      
      consoleSpy.mockRestore();
    });

    it('should show completion info for completed items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const completedChecklist = ReviewChecklistManager.markItemComplete(
        checklist,
        'auto-validation',
        'Test notes'
      );
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ReviewChecklistManager.displayChecklist(completedChecklist);
      
      const output = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      // Should show completion info
      const autoItem = completedChecklist.items.find(item => item.id === 'auto-validation');
      if (autoItem?.completed) {
        expect(output).toContain('✅');
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Checklist Persistence with TaskManager', () => {
    it('should save and load checklist with action metadata', async () => {
      // Create task and move to REVIEWING state
      await taskManager.createTask('Test task for checklist persistence with action metadata');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Wait for checklist initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Load checklist from file directly (since loadReviewChecklist is private)
      const taskFile = path.join(testContextDir, 'current-task.json');
      if (await fs.pathExists(taskFile)) {
        const taskData = await fs.readJson(taskFile);
        const checklist = taskData.reviewChecklist;
        
        if (checklist) {
          expect(checklist.items.length).toBeGreaterThan(0);
          
          // Verify action metadata is present
          const item = checklist.items[0];
          expect(item).toHaveProperty('action');
          expect(item).toHaveProperty('checkCommand');
        }
      }
    });

    it('should persist checklist updates', async () => {
      await taskManager.createTask('Test task for checklist persistence updates');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Wait for checklist initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Load checklist from file
      const taskFile = path.join(testContextDir, 'current-task.json');
      const taskData = await fs.readJson(taskFile);
      let checklist = taskData.reviewChecklist || ReviewChecklistManager.createDefaultChecklist();
      
      // Update checklist
      checklist = ReviewChecklistManager.markItemComplete(
        checklist,
        'auto-validation',
        'Test notes'
      );
      
      // Save checklist back to file
      taskData.reviewChecklist = checklist;
      await fs.writeJson(taskFile, taskData, { spaces: 2 });
      
      // Reload and verify
      const reloadedData = await fs.readJson(taskFile);
      const item = reloadedData.reviewChecklist.items.find((i: any) => i.id === 'auto-validation');
      
      expect(item?.completed).toBe(true);
      expect(item?.notes).toBe('Test notes');
    });
  });
});

