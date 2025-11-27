/**
 * Unit tests for StateChecklistIncompleteError
 * @requirement Dynamic State Checklists - Phase 3.1
 */

import { describe, it, expect } from '@jest/globals';
import { StateChecklistIncompleteError } from '../../src/core/state-checklist-incomplete-error.js';

describe('StateChecklistIncompleteError', () => {
  it('should create error with state and incomplete items', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' },
      { id: 'item-2', title: 'Item 2', description: 'Description 2' }
    ];

    const error = new StateChecklistIncompleteError('TESTING', incompleteItems);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StateChecklistIncompleteError);
    expect(error.state).toBe('TESTING');
    expect(error.incompleteItems).toEqual(incompleteItems);
    expect(error.name).toBe('StateChecklistIncompleteError');
  });

  it('should include state in error message', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' }
    ];

    const error = new StateChecklistIncompleteError('DESIGNING', incompleteItems);

    expect(error.message).toContain('DESIGNING');
    expect(error.message).toContain('Cannot progress from');
  });

  it('should include incomplete items in error message', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' },
      { id: 'item-2', title: 'Item 2', description: 'Description 2' }
    ];

    const error = new StateChecklistIncompleteError('IMPLEMENTING', incompleteItems);

    expect(error.message).toContain('Item 1');
    expect(error.message).toContain('Description 1');
    expect(error.message).toContain('Item 2');
    expect(error.message).toContain('Description 2');
  });

  it('should include CLI command suggestion in error message', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' }
    ];

    const error = new StateChecklistIncompleteError('TESTING', incompleteItems);

    expect(error.message).toContain('npx ai-workflow checklist check');
  });

  it('should have friendly message method', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' }
    ];

    const error = new StateChecklistIncompleteError('REVIEWING', incompleteItems);
    const friendlyMessage = error.getFriendlyMessage();

    expect(friendlyMessage).toBe(error.message);
    expect(typeof friendlyMessage).toBe('string');
    expect(friendlyMessage.length).toBeGreaterThan(0);
  });

  it('should return incomplete item IDs', () => {
    const incompleteItems = [
      { id: 'item-1', title: 'Item 1', description: 'Description 1' },
      { id: 'item-2', title: 'Item 2', description: 'Description 2' },
      { id: 'item-3', title: 'Item 3', description: 'Description 3' }
    ];

    const error = new StateChecklistIncompleteError('UNDERSTANDING', incompleteItems);
    const itemIds = error.getIncompleteItemIds();

    expect(itemIds).toEqual(['item-1', 'item-2', 'item-3']);
    expect(itemIds.length).toBe(3);
  });

  it('should handle empty incomplete items list', () => {
    const error = new StateChecklistIncompleteError('READY_TO_COMMIT', []);

    expect(error.state).toBe('READY_TO_COMMIT');
    expect(error.incompleteItems).toEqual([]);
    expect(error.getIncompleteItemIds()).toEqual([]);
  });

  it('should format error message correctly', () => {
    const incompleteItems = [
      { id: 'understand-requirements', title: 'Understand Requirements', description: 'Read all requirements' }
    ];

    const error = new StateChecklistIncompleteError('UNDERSTANDING', incompleteItems);

    expect(error.message).toContain('State Checklist Incomplete');
    expect(error.message).toContain('Understand Requirements');
    expect(error.message).toContain('Read all requirements');
  });
});

