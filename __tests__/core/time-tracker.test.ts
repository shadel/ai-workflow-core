/**
 * Unit tests for TimeTracker
 * @requirement FREE-TIER-004 - Time Tracking
 */

import { TimeTracker } from '../../src/core/time-tracker.js';

describe('TimeTracker', () => {
  describe('parseEstimate()', () => {
    it('should parse days', () => {
      expect(TimeTracker.parseEstimate('2 days')).toBe(16); // 2 * 8 hours
      expect(TimeTracker.parseEstimate('1 day')).toBe(8);
      expect(TimeTracker.parseEstimate('5 Days')).toBe(40);
    });

    it('should parse hours', () => {
      expect(TimeTracker.parseEstimate('4 hours')).toBe(4);
      expect(TimeTracker.parseEstimate('1 hour')).toBe(1);
      expect(TimeTracker.parseEstimate('12 Hours')).toBe(12);
    });

    it('should parse weeks', () => {
      expect(TimeTracker.parseEstimate('1 week')).toBe(40); // 1 * 40 hours
      expect(TimeTracker.parseEstimate('2 weeks')).toBe(80);
    });

    it('should parse minutes', () => {
      expect(TimeTracker.parseEstimate('30 minutes')).toBe(0.5);
      expect(TimeTracker.parseEstimate('60 minutes')).toBe(1);
      expect(TimeTracker.parseEstimate('30m')).toBe(0.5);
    });

    it('should parse plain numbers as hours', () => {
      expect(TimeTracker.parseEstimate('8')).toBe(8);
      expect(TimeTracker.parseEstimate('24')).toBe(24);
    });

    it('should return 0 for invalid input', () => {
      expect(TimeTracker.parseEstimate('invalid')).toBe(0);
      expect(TimeTracker.parseEstimate('')).toBe(0);
      // @ts-expect-error - Testing invalid input
      expect(TimeTracker.parseEstimate(null)).toBe(0);
      // @ts-expect-error - Testing invalid input
      expect(TimeTracker.parseEstimate(undefined)).toBe(0);
    });
  });

  describe('calculateActualTime()', () => {
    it('should calculate time difference in hours', () => {
      const start = '2025-01-01T10:00:00Z';
      const end = '2025-01-01T12:00:00Z';
      expect(TimeTracker.calculateActualTime(start, end)).toBe(2);
    });

    it('should handle fractional hours', () => {
      const start = '2025-01-01T10:00:00Z';
      const end = '2025-01-01T10:30:00Z';
      expect(TimeTracker.calculateActualTime(start, end)).toBe(0.5);
    });

    it('should handle multiple days', () => {
      const start = '2025-01-01T10:00:00Z';
      const end = '2025-01-03T10:00:00Z';
      expect(TimeTracker.calculateActualTime(start, end)).toBe(48);
    });
  });

  describe('formatTime()', () => {
    it('should format minutes for < 1 hour', () => {
      expect(TimeTracker.formatTime(0.5)).toBe('30m');
      expect(TimeTracker.formatTime(0.25)).toBe('15m');
      expect(TimeTracker.formatTime(0.1)).toBe('6m');
    });

    it('should format hours for < 24 hours', () => {
      expect(TimeTracker.formatTime(1)).toBe('1.0h');
      expect(TimeTracker.formatTime(2.5)).toBe('2.5h');
      expect(TimeTracker.formatTime(8)).toBe('8.0h');
    });

    it('should format days for >= 24 hours', () => {
      expect(TimeTracker.formatTime(24)).toBe('3d'); // 24 hours = 3 days (8h/day)
      expect(TimeTracker.formatTime(32)).toBe('4d');
    });

    it('should format days with remaining hours', () => {
      expect(TimeTracker.formatTime(26)).toBe('3d 2.0h'); // 3 days + 2 hours
      expect(TimeTracker.formatTime(40)).toBe('5d');
    });

    it('should handle negative time', () => {
      expect(TimeTracker.formatTime(-1)).toBe('0m');
    });
  });

  describe('compareTime()', () => {
    it('should detect under-estimate', () => {
      const result = TimeTracker.compareTime(8, 4); // Estimated 8h, actual 4h
      expect(result.status).toBe('under');
      expect(result.ratio).toBe(0.5);
      expect(result.message).toContain('faster');
    });

    it('should detect on-track', () => {
      const result1 = TimeTracker.compareTime(8, 8); // Exact match
      expect(result1.status).toBe('on-track');

      const result2 = TimeTracker.compareTime(8, 7); // 87.5% (within 80-120%)
      expect(result2.status).toBe('on-track');

      const result3 = TimeTracker.compareTime(8, 9.5); // 118.75% (within 80-120%)
      expect(result3.status).toBe('on-track');
    });

    it('should detect over-estimate', () => {
      const result = TimeTracker.compareTime(8, 12); // Estimated 8h, actual 12h
      expect(result.status).toBe('over');
      expect(result.ratio).toBe(1.5);
      expect(result.message).toContain('longer');
    });

    it('should handle no estimate', () => {
      const result = TimeTracker.compareTime(0, 4);
      expect(result.status).toBe('on-track');
      expect(result.message).toBe('No estimate provided');
    });
  });
});

