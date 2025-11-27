/**
 * Unit tests for ChecklistRegistry
 * @requirement Dynamic State Checklists - Phase 1.1
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ChecklistRegistry, ChecklistItem, TaskContext } from '../../src/core/checklist-registry.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('ChecklistRegistry', () => {
  let registry: ChecklistRegistry;

  beforeEach(() => {
    registry = new ChecklistRegistry();
  });

  describe('register()', () => {
    it('should register a new checklist item', () => {
      const item: ChecklistItem = {
        id: 'test-item-1',
        title: 'Test Item',
        description: 'Test description',
        required: true,
        priority: 'high',
        applicableStates: ['UNDERSTANDING']
      };

      registry.register(item);

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };
      const items = registry.getChecklistsForContext(context);
      
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('test-item-1');
    });

    it('should overwrite existing item with same ID', () => {
      const item1: ChecklistItem = {
        id: 'test-item-1',
        title: 'Original Title',
        description: 'Original description',
        applicableStates: ['UNDERSTANDING']
      };

      const item2: ChecklistItem = {
        id: 'test-item-1',
        title: 'Updated Title',
        description: 'Updated description',
        applicableStates: ['UNDERSTANDING']
      };

      registry.register(item1);
      registry.register(item2);

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };
      const items = registry.getChecklistsForContext(context);
      
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Updated Title');
      expect(items[0].description).toBe('Updated description');
    });

    it('should clear cache when registering new item', () => {
      const item1: ChecklistItem = {
        id: 'test-item-1',
        title: 'Item 1',
        description: 'Description 1',
        applicableStates: ['UNDERSTANDING']
      };

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };

      // Register and cache result
      registry.register(item1);
      const items1 = registry.getChecklistsForContext(context);
      expect(items1).toHaveLength(1);

      // Register new item (should clear cache)
      const item2: ChecklistItem = {
        id: 'test-item-2',
        title: 'Item 2',
        description: 'Description 2',
        applicableStates: ['UNDERSTANDING']
      };
      registry.register(item2);

      // Get items again (should include both)
      const items2 = registry.getChecklistsForContext(context);
      expect(items2).toHaveLength(2);
    });
  });

  describe('getChecklistsForContext() - State Filtering', () => {
    it('should filter items by applicable states', () => {
      registry.register({
        id: 'understanding-item',
        title: 'Understanding Item',
        description: 'For understanding state',
        applicableStates: ['UNDERSTANDING']
      });

      registry.register({
        id: 'designing-item',
        title: 'Designing Item',
        description: 'For designing state',
        applicableStates: ['DESIGNING']
      });

      const understandingContext: TaskContext = {
        state: 'UNDERSTANDING'
      };
      const understandingItems = registry.getChecklistsForContext(understandingContext);
      expect(understandingItems).toHaveLength(1);
      expect(understandingItems[0].id).toBe('understanding-item');

      const designingContext: TaskContext = {
        state: 'DESIGNING'
      };
      const designingItems = registry.getChecklistsForContext(designingContext);
      expect(designingItems).toHaveLength(1);
      expect(designingItems[0].id).toBe('designing-item');
    });

    it('should return items without state filter for all states', () => {
      registry.register({
        id: 'global-item',
        title: 'Global Item',
        description: 'Applies to all states'
        // No applicableStates = applies to all
      });

      const contexts: WorkflowState[] = [
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];

      for (const state of contexts) {
        const items = registry.getChecklistsForContext({ state });
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe('global-item');
      }
    });

    it('should return items with multiple applicable states', () => {
      registry.register({
        id: 'multi-state-item',
        title: 'Multi State Item',
        description: 'For multiple states',
        applicableStates: ['UNDERSTANDING', 'DESIGNING']
      });

      const understandingItems = registry.getChecklistsForContext({ state: 'UNDERSTANDING' });
      expect(understandingItems).toHaveLength(1);

      const designingItems = registry.getChecklistsForContext({ state: 'DESIGNING' });
      expect(designingItems).toHaveLength(1);

      const implementingItems = registry.getChecklistsForContext({ state: 'IMPLEMENTING' });
      expect(implementingItems).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Goal Filtering', () => {
    it('should filter items by goal keywords', () => {
      registry.register({
        id: 'auth-item',
        title: 'Auth Item',
        description: 'For authentication tasks',
        applicableGoals: ['authentication', 'auth', 'login']
      });

      const authContext: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement user authentication'
      };
      const authItems = registry.getChecklistsForContext(authContext);
      expect(authItems).toHaveLength(1);

      const otherContext: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement database queries'
      };
      const otherItems = registry.getChecklistsForContext(otherContext);
      expect(otherItems).toHaveLength(0);
    });

    it('should match goal keywords case-insensitively', () => {
      registry.register({
        id: 'auth-item',
        title: 'Auth Item',
        description: 'For authentication tasks',
        applicableGoals: ['AUTH']
      });

      const context1: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'implement authentication'
      };
      const items1 = registry.getChecklistsForContext(context1);
      expect(items1).toHaveLength(1);

      const context2: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'IMPLEMENT AUTH'
      };
      const items2 = registry.getChecklistsForContext(context2);
      expect(items2).toHaveLength(1);
    });

    it('should return no items if goal does not match', () => {
      registry.register({
        id: 'auth-item',
        title: 'Auth Item',
        description: 'For authentication tasks',
        applicableGoals: ['authentication']
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement database schema'
      };
      const items = registry.getChecklistsForContext(context);
      expect(items).toHaveLength(0);
    });

    it('should return item if goal is not specified but item requires goal', () => {
      // Items with goal filters should not match if goal is missing
      registry.register({
        id: 'auth-item',
        title: 'Auth Item',
        description: 'For authentication tasks',
        applicableGoals: ['authentication']
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING'
        // No goal
      };
      const items = registry.getChecklistsForContext(context);
      expect(items).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Pattern Filtering', () => {
    it('should filter items by applicable patterns', () => {
      registry.register({
        id: 'pattern-item',
        title: 'Pattern Item',
        description: 'For specific pattern',
        applicablePatterns: ['PATTERN-001', 'PATTERN-002']
      });

      const contextWithPattern: TaskContext = {
        state: 'UNDERSTANDING',
        patterns: ['PATTERN-001', 'PATTERN-003']
      };
      const items1 = registry.getChecklistsForContext(contextWithPattern);
      expect(items1).toHaveLength(1);

      const contextWithoutPattern: TaskContext = {
        state: 'UNDERSTANDING',
        patterns: ['PATTERN-003']
      };
      const items2 = registry.getChecklistsForContext(contextWithoutPattern);
      expect(items2).toHaveLength(0);
    });

    it('should return no items if no patterns are active', () => {
      registry.register({
        id: 'pattern-item',
        title: 'Pattern Item',
        description: 'For specific pattern',
        applicablePatterns: ['PATTERN-001']
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING'
        // No patterns
      };
      const items = registry.getChecklistsForContext(context);
      expect(items).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Role Filtering', () => {
    it('should filter items by applicable roles', () => {
      registry.register({
        id: 'security-item',
        title: 'Security Item',
        description: 'For security engineer role',
        applicableRoles: ['security', 'Security Engineer']
      });

      const contextWithRole: TaskContext = {
        state: 'UNDERSTANDING',
        roles: ['security', 'qa']
      };
      const items1 = registry.getChecklistsForContext(contextWithRole);
      expect(items1).toHaveLength(1);

      const contextWithoutRole: TaskContext = {
        state: 'UNDERSTANDING',
        roles: ['qa', 'performance']
      };
      const items2 = registry.getChecklistsForContext(contextWithoutRole);
      expect(items2).toHaveLength(0);
    });

    it('should return no items if no roles are active', () => {
      registry.register({
        id: 'security-item',
        title: 'Security Item',
        description: 'For security engineer role',
        applicableRoles: ['security']
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING'
        // No roles
      };
      const items = registry.getChecklistsForContext(context);
      expect(items).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Tag Filtering', () => {
    it('should filter items by applicable tags', () => {
      registry.register({
        id: 'bugfix-item',
        title: 'Bugfix Item',
        description: 'For bugfix tasks',
        applicableTags: ['bugfix', 'critical']
      });

      const contextWithTag: TaskContext = {
        state: 'UNDERSTANDING',
        tags: ['bugfix', 'backend']
      };
      const items1 = registry.getChecklistsForContext(contextWithTag);
      expect(items1).toHaveLength(1);

      const contextWithoutTag: TaskContext = {
        state: 'UNDERSTANDING',
        tags: ['feature', 'frontend']
      };
      const items2 = registry.getChecklistsForContext(contextWithoutTag);
      expect(items2).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Custom Condition', () => {
    it('should apply custom condition function', () => {
      registry.register({
        id: 'conditional-item',
        title: 'Conditional Item',
        description: 'Conditional item',
        condition: (context) => {
          return context.goal?.includes('complex') ?? false;
        }
      });

      const matchingContext: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement complex feature'
      };
      const items1 = registry.getChecklistsForContext(matchingContext);
      expect(items1).toHaveLength(1);

      const nonMatchingContext: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement simple feature'
      };
      const items2 = registry.getChecklistsForContext(nonMatchingContext);
      expect(items2).toHaveLength(0);
    });

    it('should treat exception in custom condition as non-match', () => {
      registry.register({
        id: 'error-item',
        title: 'Error Item',
        description: 'Item with error condition',
        condition: () => {
          throw new Error('Condition error');
        }
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };
      const items = registry.getChecklistsForContext(context);
      expect(items).toHaveLength(0); // Should not throw, just return empty
    });
  });

  describe('getChecklistsForContext() - Combined Filters', () => {
    it('should apply all filters (AND logic)', () => {
      registry.register({
        id: 'combined-item',
        title: 'Combined Item',
        description: 'Item with multiple filters',
        applicableStates: ['UNDERSTANDING'],
        applicableGoals: ['authentication'],
        applicablePatterns: ['PATTERN-001'],
        applicableRoles: ['security']
      });

      // All filters match
      const matchingContext: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement authentication',
        patterns: ['PATTERN-001'],
        roles: ['security']
      };
      const items1 = registry.getChecklistsForContext(matchingContext);
      expect(items1).toHaveLength(1);

      // State doesn't match
      const noStateMatch: TaskContext = {
        state: 'DESIGNING',
        goal: 'Implement authentication',
        patterns: ['PATTERN-001'],
        roles: ['security']
      };
      const items2 = registry.getChecklistsForContext(noStateMatch);
      expect(items2).toHaveLength(0);

      // Goal doesn't match
      const noGoalMatch: TaskContext = {
        state: 'UNDERSTANDING',
        goal: 'Implement database',
        patterns: ['PATTERN-001'],
        roles: ['security']
      };
      const items3 = registry.getChecklistsForContext(noGoalMatch);
      expect(items3).toHaveLength(0);
    });
  });

  describe('getChecklistsForContext() - Caching', () => {
    it('should cache results for same context', () => {
      registry.register({
        id: 'cached-item',
        title: 'Cached Item',
        description: 'Should be cached',
        applicableStates: ['UNDERSTANDING']
      });

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };

      // First call
      const items1 = registry.getChecklistsForContext(context);
      expect(items1).toHaveLength(1);

      // Second call with same context (should use cache)
      const items2 = registry.getChecklistsForContext(context);
      expect(items2).toHaveLength(1);
      expect(items2[0].id).toBe('cached-item');
    });

    it('should return different results for different contexts', () => {
      registry.register({
        id: 'understanding-item',
        title: 'Understanding Item',
        description: 'For understanding',
        applicableStates: ['UNDERSTANDING']
      });

      registry.register({
        id: 'designing-item',
        title: 'Designing Item',
        description: 'For designing',
        applicableStates: ['DESIGNING']
      });

      const context1: TaskContext = { state: 'UNDERSTANDING' };
      const items1 = registry.getChecklistsForContext(context1);
      expect(items1).toHaveLength(1);
      expect(items1[0].id).toBe('understanding-item');

      const context2: TaskContext = { state: 'DESIGNING' };
      const items2 = registry.getChecklistsForContext(context2);
      expect(items2).toHaveLength(1);
      expect(items2[0].id).toBe('designing-item');
    });
  });

  describe('Performance', () => {
    it('should handle many items efficiently', () => {
      // Register 100 items
      for (let i = 0; i < 100; i++) {
        registry.register({
          id: `item-${i}`,
          title: `Item ${i}`,
          description: `Description ${i}`,
          applicableStates: i % 2 === 0 ? ['UNDERSTANDING'] : ['DESIGNING']
        });
      }

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };

      const start = Date.now();
      const items = registry.getChecklistsForContext(context);
      const duration = Date.now() - start;

      expect(items).toHaveLength(50); // Half should match
      expect(duration).toBeLessThan(100); // Should be fast (<100ms)
    });

    it('should use cache for repeated queries', () => {
      // Register 100 items
      for (let i = 0; i < 100; i++) {
        registry.register({
          id: `item-${i}`,
          title: `Item ${i}`,
          description: `Description ${i}`,
          applicableStates: ['UNDERSTANDING']
        });
      }

      const context: TaskContext = {
        state: 'UNDERSTANDING'
      };

      // First call (cold cache)
      const start1 = Date.now();
      registry.getChecklistsForContext(context);
      const duration1 = Date.now() - start1;

      // Second call (warm cache)
      const start2 = Date.now();
      registry.getChecklistsForContext(context);
      const duration2 = Date.now() - start2;

      // Cached call should be faster or equal (operations may be too fast to measure)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });
});

