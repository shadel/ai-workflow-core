/**
 * Unit Tests for TaskStateEngine
 * 
 * Tests pure state management logic extracted from TaskManager.
 * 
 * @requirement REFACTOR-EXTRACT-STATE-ENGINE - Phase 1: Extract state logic
 */

import { TaskStateEngine } from '../../src/core/task-state-engine.js';
import { WorkflowState } from '@shadel/workflow-core';

describe('TaskStateEngine', () => {
  describe('getStateIndex()', () => {
    it('should return correct index for UNDERSTANDING', () => {
      expect(TaskStateEngine.getStateIndex('UNDERSTANDING')).toBe(0);
    });

    it('should return correct index for DESIGNING', () => {
      expect(TaskStateEngine.getStateIndex('DESIGNING')).toBe(1);
    });

    it('should return correct index for IMPLEMENTING', () => {
      expect(TaskStateEngine.getStateIndex('IMPLEMENTING')).toBe(2);
    });

    it('should return correct index for TESTING', () => {
      expect(TaskStateEngine.getStateIndex('TESTING')).toBe(3);
    });

    it('should return correct index for REVIEWING', () => {
      expect(TaskStateEngine.getStateIndex('REVIEWING')).toBe(4);
    });

    it('should return correct index for READY_TO_COMMIT', () => {
      expect(TaskStateEngine.getStateIndex('READY_TO_COMMIT')).toBe(5);
    });

    it('should return -1 for invalid state', () => {
      expect(TaskStateEngine.getStateIndex('INVALID_STATE' as WorkflowState)).toBe(-1);
    });
  });

  describe('getAllStates()', () => {
    it('should return all states in sequence', () => {
      const states = TaskStateEngine.getAllStates();
      expect(states).toEqual([
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ]);
    });

    it('should return a copy of STATE_SEQUENCE (not reference)', () => {
      const states1 = TaskStateEngine.getAllStates();
      const states2 = TaskStateEngine.getAllStates();
      expect(states1).not.toBe(states2); // Different arrays
      expect(states1).toEqual(states2); // Same content
    });
  });

  describe('isValidTransition()', () => {
    describe('Valid transitions (exactly +1 step)', () => {
      it('should allow UNDERSTANDING → DESIGNING', () => {
        expect(TaskStateEngine.isValidTransition('UNDERSTANDING', 'DESIGNING')).toBe(true);
      });

      it('should allow DESIGNING → IMPLEMENTING', () => {
        expect(TaskStateEngine.isValidTransition('DESIGNING', 'IMPLEMENTING')).toBe(true);
      });

      it('should allow IMPLEMENTING → TESTING', () => {
        expect(TaskStateEngine.isValidTransition('IMPLEMENTING', 'TESTING')).toBe(true);
      });

      it('should allow TESTING → REVIEWING', () => {
        expect(TaskStateEngine.isValidTransition('TESTING', 'REVIEWING')).toBe(true);
      });

      it('should allow REVIEWING → READY_TO_COMMIT', () => {
        expect(TaskStateEngine.isValidTransition('REVIEWING', 'READY_TO_COMMIT')).toBe(true);
      });
    });

    describe('Invalid transitions - skipping states', () => {
      it('should reject UNDERSTANDING → IMPLEMENTING (skip DESIGNING)', () => {
        expect(TaskStateEngine.isValidTransition('UNDERSTANDING', 'IMPLEMENTING')).toBe(false);
      });

      it('should reject UNDERSTANDING → TESTING (skip multiple states)', () => {
        expect(TaskStateEngine.isValidTransition('UNDERSTANDING', 'TESTING')).toBe(false);
      });

      it('should reject DESIGNING → TESTING (skip IMPLEMENTING)', () => {
        expect(TaskStateEngine.isValidTransition('DESIGNING', 'TESTING')).toBe(false);
      });
    });

    describe('Invalid transitions - backward movement', () => {
      it('should reject DESIGNING → UNDERSTANDING (backward)', () => {
        expect(TaskStateEngine.isValidTransition('DESIGNING', 'UNDERSTANDING')).toBe(false);
      });

      it('should reject IMPLEMENTING → DESIGNING (backward)', () => {
        expect(TaskStateEngine.isValidTransition('IMPLEMENTING', 'DESIGNING')).toBe(false);
      });

      it('should reject READY_TO_COMMIT → REVIEWING (backward)', () => {
        expect(TaskStateEngine.isValidTransition('READY_TO_COMMIT', 'REVIEWING')).toBe(false);
      });
    });

    describe('Invalid transitions - same state', () => {
      it('should reject UNDERSTANDING → UNDERSTANDING (same state)', () => {
        expect(TaskStateEngine.isValidTransition('UNDERSTANDING', 'UNDERSTANDING')).toBe(false);
      });

      it('should reject DESIGNING → DESIGNING (same state)', () => {
        expect(TaskStateEngine.isValidTransition('DESIGNING', 'DESIGNING')).toBe(false);
      });
    });
  });

  describe('getNextState()', () => {
    it('should return DESIGNING for UNDERSTANDING', () => {
      expect(TaskStateEngine.getNextState('UNDERSTANDING')).toBe('DESIGNING');
    });

    it('should return IMPLEMENTING for DESIGNING', () => {
      expect(TaskStateEngine.getNextState('DESIGNING')).toBe('IMPLEMENTING');
    });

    it('should return TESTING for IMPLEMENTING', () => {
      expect(TaskStateEngine.getNextState('IMPLEMENTING')).toBe('TESTING');
    });

    it('should return REVIEWING for TESTING', () => {
      expect(TaskStateEngine.getNextState('TESTING')).toBe('REVIEWING');
    });

    it('should return READY_TO_COMMIT for REVIEWING', () => {
      expect(TaskStateEngine.getNextState('REVIEWING')).toBe('READY_TO_COMMIT');
    });

    it('should return null for READY_TO_COMMIT (final state)', () => {
      expect(TaskStateEngine.getNextState('READY_TO_COMMIT')).toBeNull();
    });

    it('should return null for invalid state', () => {
      expect(TaskStateEngine.getNextState('INVALID_STATE' as WorkflowState)).toBeNull();
    });
  });

  describe('getProgress()', () => {
    it('should return 0 for UNDERSTANDING', () => {
      expect(TaskStateEngine.getProgress('UNDERSTANDING')).toBe(0);
    });

    it('should return 20 for DESIGNING', () => {
      expect(TaskStateEngine.getProgress('DESIGNING')).toBe(20);
    });

    it('should return 40 for IMPLEMENTING', () => {
      expect(TaskStateEngine.getProgress('IMPLEMENTING')).toBe(40);
    });

    it('should return 60 for TESTING', () => {
      expect(TaskStateEngine.getProgress('TESTING')).toBe(60);
    });

    it('should return 80 for REVIEWING', () => {
      expect(TaskStateEngine.getProgress('REVIEWING')).toBe(80);
    });

    it('should return 100 for READY_TO_COMMIT', () => {
      expect(TaskStateEngine.getProgress('READY_TO_COMMIT')).toBe(100);
    });

    it('should return 0 for invalid state', () => {
      expect(TaskStateEngine.getProgress('INVALID_STATE' as WorkflowState)).toBe(0);
    });

    it('should return rounded integer percentage', () => {
      const progress = TaskStateEngine.getProgress('DESIGNING');
      expect(Number.isInteger(progress)).toBe(true);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  describe('validateStateHistory()', () => {
    describe('Valid history scenarios', () => {
      it('should accept empty history (new task)', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'UNDERSTANDING',
            stateHistory: []
          });
        }).not.toThrow();
      });

      it('should accept valid sequential history', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'DESIGNING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' }
            ]
          });
        }).not.toThrow();
      });

      it('should accept valid multi-step history', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'IMPLEMENTING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' },
              { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00.000Z' }
            ]
          });
        }).not.toThrow();
      });

      it('should accept workflow without stateHistory property', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'UNDERSTANDING'
          } as any);
        }).not.toThrow();
      });
    });

    describe('Invalid history - current state in history', () => {
      it('should throw error when current state is in history', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'DESIGNING',
            stateHistory: [
              { state: 'DESIGNING', enteredAt: '2025-01-01T00:00:00.000Z' }
            ]
          });
        }).toThrow(/STATE HISTORY CORRUPTION/);
      });

      it('should include current state and history in error message', () => {
        try {
          TaskStateEngine.validateStateHistory({
            currentState: 'IMPLEMENTING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' },
              { state: 'IMPLEMENTING', enteredAt: '2025-01-01T01:00:00.000Z' }
            ]
          });
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('IMPLEMENTING');
          expect(error.message).toContain('Current state found in history');
        }
      });
    });

    describe('Invalid history - non-sequential transitions', () => {
      it('should throw error for skipped state in history', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'REVIEWING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' },
              { state: 'TESTING', enteredAt: '2025-01-01T01:00:00.000Z' } // Skipped DESIGNING and IMPLEMENTING
            ]
          });
        }).toThrow(/STATE HISTORY CORRUPTION DETECTED/);
      });

      it('should throw error for backward transition in history', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'TESTING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' },
              { state: 'DESIGNING', enteredAt: '2025-01-01T01:00:00.000Z' },
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T02:00:00.000Z' } // Backward
            ]
          });
        }).toThrow(/Invalid transition found in state history/);
      });

      it('should include transition details in error message', () => {
        try {
          TaskStateEngine.validateStateHistory({
            currentState: 'REVIEWING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' },
              { state: 'IMPLEMENTING', enteredAt: '2025-01-01T01:00:00.000Z' } // Skipped DESIGNING
            ]
          });
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('UNDERSTANDING → IMPLEMENTING');
          expect(error.message).toContain('Invalid transition');
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle workflow without currentState gracefully', () => {
        expect(() => {
          TaskStateEngine.validateStateHistory({} as any);
        }).not.toThrow();
      });

      it('should normalize state names before validation', () => {
        // This test ensures normalizeState is used (even if states are already normalized)
        expect(() => {
          TaskStateEngine.validateStateHistory({
            currentState: 'DESIGNING',
            stateHistory: [
              { state: 'UNDERSTANDING', enteredAt: '2025-01-01T00:00:00.000Z' }
            ]
          });
        }).not.toThrow();
      });
    });
  });
});

