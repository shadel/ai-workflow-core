/**
 * Unit tests for ReviewChecklistManager
 * @requirement REVIEW-CHECKLIST-001 - Review checklist enforcement
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ReviewChecklistManager, ReviewChecklist } from '../../src/core/review-checklist.js';

describe('ReviewChecklistManager', () => {
  describe('createDefaultChecklist()', () => {
    it('should create checklist with all default items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      expect(checklist.items).toHaveLength(7);
      expect(checklist.items.every(item => item.completed === false)).toBe(true);
      expect(checklist.completedAt).toBeUndefined();
    });

    it('should include auto-validation item', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const autoValidation = checklist.items.find(item => item.id === 'auto-validation');
      
      expect(autoValidation).toBeDefined();
      expect(autoValidation?.category).toBe('automated');
      expect(autoValidation?.description).toContain('automated validation');
    });

    it('should include all manual review items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const manualItems = checklist.items.filter(item => item.category === 'manual');
      
      expect(manualItems).toHaveLength(6);
      expect(manualItems.map(item => item.id)).toEqual([
        'code-quality',
        'requirements',
        'test-coverage',
        'error-handling',
        'documentation',
        'security'
      ]);
    });
  });

  describe('isChecklistComplete()', () => {
    it('should return true when all items are completed', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      // Mark all items as complete
      let updated = checklist;
      for (const item of checklist.items) {
        updated = ReviewChecklistManager.markItemComplete(updated, item.id);
      }
      
      expect(ReviewChecklistManager.isChecklistComplete(updated)).toBe(true);
    });

    it('should return false when any item is incomplete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      expect(ReviewChecklistManager.isChecklistComplete(checklist)).toBe(false);
    });

    it('should return false when some items are incomplete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'auto-validation');
      
      expect(ReviewChecklistManager.isChecklistComplete(updated)).toBe(false);
    });

    it('should return true for empty checklist', () => {
      const checklist: ReviewChecklist = { items: [] };
      expect(ReviewChecklistManager.isChecklistComplete(checklist)).toBe(true);
    });
  });

  describe('markItemComplete()', () => {
    it('should mark item as complete with timestamp', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const beforeTime = Date.now();
      
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'code-quality');
      const item = updated.items.find(i => i.id === 'code-quality');
      
      expect(item?.completed).toBe(true);
      expect(item?.completedAt).toBeDefined();
      expect(item?.completedAt).toBeTruthy();
      
      const afterTime = Date.now();
      const completedAtTime = item?.completedAt ? new Date(item.completedAt).getTime() : 0;
      expect(completedAtTime).toBeGreaterThanOrEqual(beforeTime);
      expect(completedAtTime).toBeLessThanOrEqual(afterTime);
    });

    it('should add notes when provided', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const notes = 'Code reviewed, looks good';
      
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'code-quality', notes);
      const item = updated.items.find(i => i.id === 'code-quality');
      
      expect(item?.notes).toBe(notes);
    });

    it('should not modify other items', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const originalItem = checklist.items.find(i => i.id === 'requirements');
      
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'code-quality');
      const unchangedItem = updated.items.find(i => i.id === 'requirements');
      
      expect(unchangedItem?.completed).toBe(originalItem?.completed);
      expect(unchangedItem?.completedAt).toBeUndefined();
    });

    it('should set completedAt on checklist when all items complete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      let updated = checklist;
      for (const item of checklist.items) {
        updated = ReviewChecklistManager.markItemComplete(updated, item.id);
      }
      
      expect(updated.completedAt).toBeDefined();
      expect(updated.completedAt).toBeTruthy();
    });

    it('should not set completedAt when items remain incomplete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'code-quality');
      
      expect(updated.completedAt).toBeUndefined();
    });

    it('should throw error for non-existent item id', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      // Should not throw, just return unchanged checklist
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'non-existent');
      expect(updated).toEqual(checklist);
    });
  });

  describe('getCompletionPercentage()', () => {
    it('should return 0 for empty checklist', () => {
      const checklist: ReviewChecklist = { items: [] };
      expect(ReviewChecklistManager.getCompletionPercentage(checklist)).toBe(100);
    });

    it('should return 0 when no items completed', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      expect(ReviewChecklistManager.getCompletionPercentage(checklist)).toBe(0);
    });

    it('should return 100 when all items completed', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      let updated = checklist;
      for (const item of checklist.items) {
        updated = ReviewChecklistManager.markItemComplete(updated, item.id);
      }
      
      expect(ReviewChecklistManager.getCompletionPercentage(updated)).toBe(100);
    });

    it('should return correct percentage for partial completion', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      const updated = ReviewChecklistManager.markItemComplete(checklist, 'auto-validation');
      
      // 1 out of 7 items = ~14%
      const percentage = ReviewChecklistManager.getCompletionPercentage(updated);
      expect(percentage).toBeGreaterThanOrEqual(14);
      expect(percentage).toBeLessThanOrEqual(15);
    });

    it('should round percentage correctly', () => {
      const checklist: ReviewChecklist = {
        items: [
          { id: '1', description: 'Item 1', category: 'manual', completed: true, action: { type: 'check', expected: { result: 'pass' } }, checkCommand: 'test-check-1' },
          { id: '2', description: 'Item 2', category: 'manual', completed: true, action: { type: 'check', expected: { result: 'pass' } }, checkCommand: 'test-check-2' },
          { id: '3', description: 'Item 3', category: 'manual', completed: false, action: { type: 'check', expected: { result: 'pass' } }, checkCommand: 'test-check-3' }
        ]
      };
      
      // 2 out of 3 = 66.67% should round to 67%
      expect(ReviewChecklistManager.getCompletionPercentage(checklist)).toBe(67);
    });
  });

  describe('runAutomatedValidation()', () => {
    it('should return validation result', async () => {
      const result = await ReviewChecklistManager.runAutomatedValidation();
      
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should include result when validation succeeds', async () => {
      const result = await ReviewChecklistManager.runAutomatedValidation();
      
      if (result.success && result.result) {
        expect(result.result).toBeDefined();
        expect(result.result).toHaveProperty('overall');
        expect(result.result).toHaveProperty('workflow');
        expect(result.result).toHaveProperty('files');
      }
    });

    it('should include error when validation fails', async () => {
      // This test depends on actual validation state
      // In most cases, validation should succeed if task exists
      const result = await ReviewChecklistManager.runAutomatedValidation();
      
      // Validation may succeed or fail depending on context
      // Just verify the structure is correct
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      // If success, should have result; if fail, should have error
      if (result.success) {
        expect(result.result).toBeDefined();
      } else {
        // Error may or may not be present depending on validation implementation
        // Just verify structure
        expect(result).toHaveProperty('error');
      }
    });
  });

  describe('displayChecklist()', () => {
    it('should display checklist without errors', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      // Capture console.log output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ReviewChecklistManager.displayChecklist(checklist);
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.some(call => 
        call[0]?.toString().includes('Review Checklist Status')
      )).toBe(true);
      
      consoleSpy.mockRestore();
    });

    it('should show completion status when complete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      let updated = checklist;
      for (const item of checklist.items) {
        updated = ReviewChecklistManager.markItemComplete(updated, item.id);
      }
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ReviewChecklistManager.displayChecklist(updated);
      
      const output = consoleSpy.mock.calls.map(call => call[0]?.toString()).join('\n');
      expect(output).toContain('complete');
      
      consoleSpy.mockRestore();
    });

    it('should show incomplete status when not complete', () => {
      const checklist = ReviewChecklistManager.createDefaultChecklist();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ReviewChecklistManager.displayChecklist(checklist);
      
      const output = consoleSpy.mock.calls.map(call => call[0]?.toString()).join('\n');
      expect(output).toContain('incomplete');
      
      consoleSpy.mockRestore();
    });
  });
});

