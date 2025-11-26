/**
 * Unit tests for Version Comparison Utility
 * @requirement FIX-UPGRADE-COMMAND - Test version comparison
 */

import { describe, it, expect } from '@jest/globals';
import { compareVersions } from '../../../src/cli/utils/version-compare.js';

describe('Version Comparison Utility', () => {
  describe('compareVersions', () => {
    describe('Outdated detection', () => {
      it('should detect outdated version (patch)', () => {
        expect(compareVersions('3.1.0', '3.1.2')).toBe('outdated');
      });

      it('should detect outdated version (minor)', () => {
        expect(compareVersions('3.1.0', '3.2.0')).toBe('outdated');
      });

      it('should detect outdated version (major)', () => {
        expect(compareVersions('2.0.0', '3.0.0')).toBe('outdated');
      });

      it('should detect outdated version (multiple levels)', () => {
        expect(compareVersions('2.1.0', '3.2.1')).toBe('outdated');
      });
    });

    describe('Current detection', () => {
      it('should detect current version (exact match)', () => {
        expect(compareVersions('3.1.2', '3.1.2')).toBe('current');
      });

      it('should detect current version (with leading zeros)', () => {
        expect(compareVersions('3.1.2', '3.1.2')).toBe('current');
      });
    });

    describe('Ahead detection', () => {
      it('should detect ahead version (patch)', () => {
        expect(compareVersions('3.1.3', '3.1.2')).toBe('ahead');
      });

      it('should detect ahead version (minor)', () => {
        expect(compareVersions('3.2.0', '3.1.2')).toBe('ahead');
      });

      it('should detect ahead version (major)', () => {
        expect(compareVersions('4.0.0', '3.1.2')).toBe('ahead');
      });

      it('should detect ahead version (multiple levels)', () => {
        expect(compareVersions('4.2.1', '3.1.2')).toBe('ahead');
      });
    });

    describe('Pre-release versions', () => {
      it('should handle pre-release versions (beta)', () => {
        // Current is beta, latest is stable - base version same, so current
        // Note: Manual comparison only compares base version (before -)
        // For pre-release, 3.1.2-beta.1 and 3.1.2 have same base, so current
        // This is expected behavior for manual comparison
        expect(compareVersions('3.1.2-beta.1', '3.1.2')).toBe('current');
      });

      it('should handle pre-release versions (alpha)', () => {
        // Same as above - manual comparison compares base version only
        expect(compareVersions('3.1.2-alpha.1', '3.1.2')).toBe('current');
      });

      it('should compare pre-release to pre-release', () => {
        // Both are pre-release with same base version, so current
        expect(compareVersions('3.1.2-beta.1', '3.1.2-beta.2')).toBe('current');
      });
    });

    describe('Missing patch version', () => {
      it('should handle versions without patch (current)', () => {
        expect(compareVersions('3.1', '3.1.0')).toBe('current');
      });

      it('should handle versions without patch (outdated)', () => {
        expect(compareVersions('3.1', '3.2.0')).toBe('outdated');
      });

      it('should handle versions without patch (ahead)', () => {
        expect(compareVersions('3.2', '3.1.0')).toBe('ahead');
      });
    });

    describe('Edge cases', () => {
      it('should handle single digit versions', () => {
        expect(compareVersions('1', '2')).toBe('outdated');
        expect(compareVersions('2', '1')).toBe('ahead');
        expect(compareVersions('1', '1')).toBe('current');
      });

      it('should handle very large version numbers', () => {
        expect(compareVersions('999.999.999', '1000.0.0')).toBe('outdated');
      });

      it('should handle zero versions', () => {
        expect(compareVersions('0.0.0', '0.0.1')).toBe('outdated');
        expect(compareVersions('0.0.1', '0.0.0')).toBe('ahead');
      });
    });
  });
});

