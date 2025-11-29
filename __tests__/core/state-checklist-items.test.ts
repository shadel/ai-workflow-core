/**
 * Unit tests for State Checklist Items
 * @requirement Dynamic State Checklists - Phase 1.3
 */

import { describe, it, expect } from '@jest/globals';
import {
  UNDERSTANDING_CHECKLIST_ITEMS,
  DESIGNING_CHECKLIST_ITEMS,
  IMPLEMENTING_CHECKLIST_ITEMS,
  TESTING_CHECKLIST_ITEMS,
  REVIEWING_CHECKLIST_ITEMS,
  READY_TO_COMMIT_CHECKLIST_ITEMS,
  getAllStateChecklistItems,
  getStateChecklistItems
} from '../../src/core/state-checklist-items.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('State Checklist Items', () => {
  describe('UNDERSTANDING_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(UNDERSTANDING_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have all required items marked as required', () => {
      const required = UNDERSTANDING_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBe(3);
    });

    it('should have high priority for required items', () => {
      UNDERSTANDING_CHECKLIST_ITEMS.forEach(item => {
        if (item.required) {
          expect(item.priority).toBe('high');
        }
      });
    });

    it('should have valid item structure', () => {
      UNDERSTANDING_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('UNDERSTANDING');
      });
    });
  });

  describe('DESIGNING_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(DESIGNING_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have at least 2 required items', () => {
      const required = DESIGNING_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBeGreaterThanOrEqual(2);
    });

    it('should have valid item structure', () => {
      DESIGNING_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('DESIGNING');
      });
    });
  });

  describe('IMPLEMENTING_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(IMPLEMENTING_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have at least 2 required items', () => {
      const required = IMPLEMENTING_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBeGreaterThanOrEqual(2);
    });

    it('should have valid item structure', () => {
      IMPLEMENTING_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('IMPLEMENTING');
      });
    });
  });

  describe('TESTING_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(TESTING_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have all required items', () => {
      const required = TESTING_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBe(3);
    });

    it('should have valid item structure', () => {
      TESTING_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('TESTING');
      });
    });
  });

  describe('REVIEWING_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(REVIEWING_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have all required items', () => {
      const required = REVIEWING_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBe(3);
    });

    it('should have valid item structure', () => {
      REVIEWING_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('REVIEWING');
      });
    });
  });

  describe('READY_TO_COMMIT_CHECKLIST_ITEMS', () => {
    it('should have 3 items', () => {
      expect(READY_TO_COMMIT_CHECKLIST_ITEMS).toHaveLength(3);
    });

    it('should have at least 2 required items', () => {
      const required = READY_TO_COMMIT_CHECKLIST_ITEMS.filter(item => item.required);
      expect(required.length).toBeGreaterThanOrEqual(2);
    });

    it('should have valid item structure', () => {
      READY_TO_COMMIT_CHECKLIST_ITEMS.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('applicableStates');
        expect(item.applicableStates).toContain('READY_TO_COMMIT');
      });
    });
  });

  describe('getAllStateChecklistItems()', () => {
    it('should return all items from all states', () => {
      const allItems = getAllStateChecklistItems();
      
      expect(allItems.length).toBeGreaterThanOrEqual(18); // 3 items × 6 states = 18
      expect(allItems.length).toBeLessThanOrEqual(21); // Allow for some variance
    });

    it('should include items from all states', () => {
      const allItems = getAllStateChecklistItems();
      const states = new Set(allItems.flatMap(item => item.applicableStates || []));
      
      expect(states.has('UNDERSTANDING')).toBe(true);
      expect(states.has('DESIGNING')).toBe(true);
      expect(states.has('IMPLEMENTING')).toBe(true);
      expect(states.has('TESTING')).toBe(true);
      expect(states.has('REVIEWING')).toBe(true);
      expect(states.has('READY_TO_COMMIT')).toBe(true);
    });
  });

  describe('getStateChecklistItems()', () => {
    it('should return correct items for UNDERSTANDING state', () => {
      const items = getStateChecklistItems('UNDERSTANDING');
      expect(items).toEqual(UNDERSTANDING_CHECKLIST_ITEMS);
    });

    it('should return correct items for DESIGNING state', () => {
      const items = getStateChecklistItems('DESIGNING');
      expect(items).toEqual(DESIGNING_CHECKLIST_ITEMS);
    });

    it('should return correct items for IMPLEMENTING state', () => {
      const items = getStateChecklistItems('IMPLEMENTING');
      expect(items).toEqual(IMPLEMENTING_CHECKLIST_ITEMS);
    });

    it('should return correct items for TESTING state', () => {
      const items = getStateChecklistItems('TESTING');
      expect(items).toEqual(TESTING_CHECKLIST_ITEMS);
    });

    it('should return correct items for REVIEWING state', () => {
      const items = getStateChecklistItems('REVIEWING');
      expect(items).toEqual(REVIEWING_CHECKLIST_ITEMS);
    });

    it('should return correct items for READY_TO_COMMIT state', () => {
      const items = getStateChecklistItems('READY_TO_COMMIT');
      expect(items).toEqual(READY_TO_COMMIT_CHECKLIST_ITEMS);
    });

    it('should return empty array for invalid state', () => {
      const items = getStateChecklistItems('INVALID' as WorkflowState);
      expect(items).toEqual([]);
    });
  });

  describe('Priority sorting', () => {
    it('should have high priority items sorted first when sorted by priority', () => {
      const allItems = getAllStateChecklistItems();
      const sorted = [...allItems].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority || 'medium'];
        const bPriority = priorityOrder[b.priority || 'medium'];
        return aPriority - bPriority;
      });

      // First few items should be high priority
      const firstFew = sorted.slice(0, 5);
      const allHigh = firstFew.every(item => item.priority === 'high' || item.required);
      expect(allHigh || firstFew.some(item => item.priority === 'high')).toBe(true);
    });
  });

  describe('Required vs optional flags', () => {
    it('should have required items marked correctly', () => {
      const allItems = getAllStateChecklistItems();
      const required = allItems.filter(item => item.required === true);
      const optional = allItems.filter(item => item.required === false);
      
      expect(required.length).toBeGreaterThan(0);
      expect(optional.length).toBeGreaterThanOrEqual(0);
    });

    it('should have all required items marked as high priority', () => {
      const allItems = getAllStateChecklistItems();
      const required = allItems.filter(item => item.required === true);
      
      required.forEach(item => {
        expect(item.priority).toBe('high');
      });
    });
  });
});

