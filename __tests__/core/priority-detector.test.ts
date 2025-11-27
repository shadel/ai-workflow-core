/**
 * Unit tests for PriorityDetector
 * @requirement FREE-TIER-002 - Priority System
 */

import { PriorityDetector } from '../../src/core/priority-detector.js';
import { Priority } from '../../src/core/task-queue.js';

describe('PriorityDetector', () => {
  describe('detect()', () => {
    it('should detect CRITICAL priority', () => {
      expect(PriorityDetector.detect('Fix critical bug in authentication')).toBe('CRITICAL');
      expect(PriorityDetector.detect('Security vulnerability found')).toBe('CRITICAL');
      expect(PriorityDetector.detect('System is down')).toBe('CRITICAL');
      expect(PriorityDetector.detect('Hotfix for production crash')).toBe('CRITICAL');
      expect(PriorityDetector.detect('Blocking issue preventing deployment')).toBe('CRITICAL');
    });

    it('should detect HIGH priority', () => {
      expect(PriorityDetector.detect('Implement user authentication')).toBe('HIGH');
      expect(PriorityDetector.detect('Payment integration needed')).toBe('HIGH');
      expect(PriorityDetector.detect('Important feature for customer')).toBe('HIGH');
      expect(PriorityDetector.detect('API endpoint for production')).toBe('HIGH');
      expect(PriorityDetector.detect('Database migration required')).toBe('HIGH');
    });

    it('should detect LOW priority', () => {
      expect(PriorityDetector.detect('Refactor old code')).toBe('LOW');
      expect(PriorityDetector.detect('Cleanup unused files')).toBe('LOW');
      expect(PriorityDetector.detect('Nice-to-have improvement')).toBe('LOW');
      expect(PriorityDetector.detect('Tech debt cleanup')).toBe('LOW');
      expect(PriorityDetector.detect('Documentation update')).toBe('LOW');
    });

    it('should default to MEDIUM priority', () => {
      expect(PriorityDetector.detect('Add user profile page')).toBe('MEDIUM');
      expect(PriorityDetector.detect('Create dashboard component')).toBe('MEDIUM');
      expect(PriorityDetector.detect('Update configuration settings')).toBe('MEDIUM');
      expect(PriorityDetector.detect('Build new component')).toBe('MEDIUM');
    });

    it('should be case-insensitive', () => {
      expect(PriorityDetector.detect('FIX BUG')).toBe('CRITICAL');
      expect(PriorityDetector.detect('Fix Bug')).toBe('CRITICAL');
      expect(PriorityDetector.detect('fix bug')).toBe('CRITICAL');
    });

    it('should handle empty or invalid input', () => {
      expect(PriorityDetector.detect('')).toBe('MEDIUM');
      expect(PriorityDetector.detect('   ')).toBe('MEDIUM');
      // @ts-expect-error - Testing invalid input
      expect(PriorityDetector.detect(null)).toBe('MEDIUM');
      // @ts-expect-error - Testing invalid input
      expect(PriorityDetector.detect(undefined)).toBe('MEDIUM');
    });

    it('should prioritize CRITICAL over HIGH', () => {
      expect(PriorityDetector.detect('Fix critical authentication bug')).toBe('CRITICAL');
      expect(PriorityDetector.detect('Security issue in payment system')).toBe('CRITICAL');
    });

    it('should prioritize HIGH over LOW', () => {
      expect(PriorityDetector.detect('Important refactoring needed')).toBe('HIGH');
      expect(PriorityDetector.detect('Customer-facing improvement')).toBe('HIGH');
    });
  });

  describe('getKeywords()', () => {
    it('should return keywords for CRITICAL', () => {
      const keywords = PriorityDetector.getKeywords('CRITICAL');
      expect(keywords).toContain('fix');
      expect(keywords).toContain('bug');
      expect(keywords).toContain('security');
    });

    it('should return keywords for HIGH', () => {
      const keywords = PriorityDetector.getKeywords('HIGH');
      expect(keywords).toContain('auth');
      expect(keywords).toContain('payment');
      expect(keywords).toContain('deadline');
    });

    it('should return keywords for LOW', () => {
      const keywords = PriorityDetector.getKeywords('LOW');
      expect(keywords).toContain('refactor');
      expect(keywords).toContain('cleanup');
      expect(keywords).toContain('tech-debt');
    });

    it('should return empty array for MEDIUM', () => {
      const keywords = PriorityDetector.getKeywords('MEDIUM');
      expect(keywords).toEqual([]);
    });
  });

  describe('getAllKeywords()', () => {
    it('should return all priority keywords', () => {
      const allKeywords = PriorityDetector.getAllKeywords();
      expect(allKeywords).toHaveProperty('CRITICAL');
      expect(allKeywords).toHaveProperty('HIGH');
      expect(allKeywords).toHaveProperty('MEDIUM');
      expect(allKeywords).toHaveProperty('LOW');
      expect(Array.isArray(allKeywords.CRITICAL)).toBe(true);
      expect(Array.isArray(allKeywords.HIGH)).toBe(true);
      expect(Array.isArray(allKeywords.MEDIUM)).toBe(true);
      expect(Array.isArray(allKeywords.LOW)).toBe(true);
    });
  });
});

