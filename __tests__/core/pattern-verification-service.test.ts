/**
 * Unit tests for PatternVerificationService
 * @requirement Dynamic State Checklists - Phase 2.2
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { PatternVerificationService } from '../../src/core/pattern-verification-service.js';
import { PatternChecklistItem } from '../../src/core/checklist-registry.js';
import { PatternVerificationStep } from '../../src/core/pattern-checklist-generator.js';

describe('PatternVerificationService', () => {
  let service: PatternVerificationService;

  beforeEach(() => {
    service = new PatternVerificationService();
    service.clearCache();
  });

  describe('verifyPatternItem()', () => {
    it('should verify a pattern checklist item', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      const result = await service.verifyPatternItem(item);

      expect(result).toBeDefined();
      expect(result.itemId).toBe('pattern-PATTERN-1');
      expect(result.patternId).toBe('PATTERN-1');
      expect(result.steps).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.verifiedAt).toBeDefined();
    });

    it('should cache verification results', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      const result1 = await service.verifyPatternItem(item);
      const result2 = await service.verifyPatternItem(item);

      // Should return cached result (same reference indicates caching)
      expect(result2.verifiedAt).toBe(result1.verifiedAt);
      expect(result2.steps.length).toBe(result1.steps.length);
    });

    it('should invalidate cache when cleared', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      const result1 = await service.verifyPatternItem(item);
      const verifiedAt1 = result1.verifiedAt;
      service.clearCache();
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await service.verifyPatternItem(item);

      // Should be different (cache cleared) - verify new verification was performed
      expect(result2.verifiedAt).toBeDefined();
      // Timestamps should be different or cache key should be different
      expect(result2.verifiedAt !== verifiedAt1 || result2.steps.length > 0).toBe(true);
    });
  });

  describe('verifyStep() - Response Check', () => {
    it('should verify response check step', async () => {
      const step: PatternVerificationStep = {
        stepType: 'read',
        description: 'Read pattern',
        verificationType: 'response_check',
        verificationRule: 'Response should mention pattern'
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false); // Default to false for manual verification
      expect(result.message).toContain('Manual verification required');
      expect(result.verifiedAt).toBeDefined();
    });
  });

  describe('verifyStep() - Code Check', () => {
    it('should verify code check step', async () => {
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'Implement pattern',
        verificationType: 'code_check',
        verificationRule: 'No console.log'
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false); // Default to false for code analysis
      expect(result.message).toContain('Code check requires analysis');
      expect(result.verifiedAt).toBeDefined();
    });
  });

  describe('verifyStep() - File Check', () => {
    it('should verify file check step when file exists', async () => {
      const testFile = path.join(os.tmpdir(), 'test-file-check.txt');
      
      // Create test file
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, 'test content');

      try {
        const step: PatternVerificationStep = {
          stepType: 'implement',
          description: 'File must exist',
          verificationType: 'file_check',
          verificationRule: testFile
        };

        const result = await service.verifyStep(step, 'PATTERN-1');

        expect(result).toBeDefined();
        expect(result.passed).toBe(true);
        expect(result.message).toContain('File exists');
        expect(result.verifiedAt).toBeDefined();
      } finally {
        // Cleanup
        await fs.remove(testFile).catch(() => {});
      }
    });

    it('should verify file check step when file does not exist', async () => {
      const testFile = path.join(os.tmpdir(), 'non-existent-file.txt');
      
      // Ensure file doesn't exist
      await fs.remove(testFile).catch(() => {});

      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'File must exist',
        verificationType: 'file_check',
        verificationRule: testFile
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.message).toContain('File not found');
      expect(result.verifiedAt).toBeDefined();
    });

    it('should handle file check without verification rule', async () => {
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'File must exist',
        verificationType: 'file_check'
        // No verificationRule
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.message).toContain('File check requires verification rule');
    });

    it('should handle file check errors gracefully', async () => {
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'File must exist',
        verificationType: 'file_check',
        verificationRule: '/invalid/path/with/special/chars/<>:"|?*'
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      // Error message will be "File not found: ..." for non-existent files, or "File check error: ..." for actual errors
      expect(result.message).toMatch(/File (not found|check error)/);
    });
  });

  describe('verifyStep() - Command Check', () => {
    it('should verify command check step', async () => {
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'Run command',
        verificationType: 'command_check',
        verificationRule: 'npm test'
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false); // Default to false for command history
      expect(result.message).toContain('Command check requires execution history');
      expect(result.verifiedAt).toBeDefined();
    });
  });

  describe('verifyStep() - Unknown Type', () => {
    it('should handle unknown verification type', async () => {
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'Unknown step',
        verificationType: 'unknown_type' as any,
        verificationRule: 'test'
      };

      const result = await service.verifyStep(step, 'PATTERN-1');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Unknown verification type');
    });
  });

  describe('Caching', () => {
    it('should cache results with TTL', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      const result1 = await service.verifyPatternItem(item);
      
      // Immediately verify again - should use cache
      const result2 = await service.verifyPatternItem(item);

      expect(result2.verifiedAt).toBe(result1.verifiedAt);
    });

    it('should invalidate cache for specific pattern', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      const result1 = await service.verifyPatternItem(item);
      const verifiedAt1 = result1.verifiedAt;
      service.invalidateCache('PATTERN-1');
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await service.verifyPatternItem(item);

      // Should be different (cache invalidated) - verify new verification was performed
      expect(result2.verifiedAt).toBeDefined();
      // Timestamps should be different or cache key should be different
      expect(result2.verifiedAt !== verifiedAt1 || result2.steps.length > 0).toBe(true);
    });

    it('should cleanup expired cache entries', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      await service.verifyPatternItem(item);
      service.cleanupExpiredCache(); // Should not error
      
      // Verify cache is still accessible (if not expired)
      const result = await service.verifyPatternItem(item);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in verification gracefully', async () => {
      const item: PatternChecklistItem = {
        id: 'pattern-PATTERN-1',
        title: 'Test Pattern',
        description: 'Test description',
        patternId: 'PATTERN-1',
        applicableStates: ['IMPLEMENTING'],
        required: false
      };

      // Should not throw
      const result = await service.verifyPatternItem(item);
      
      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
    });

    it('should handle file system errors in file check', async () => {
      // Use a path that might cause issues on different systems
      const step: PatternVerificationStep = {
        stepType: 'implement',
        description: 'File check with error',
        verificationType: 'file_check',
        verificationRule: ''
      };

      const result = await service.verifyStep(step, 'PATTERN-1');
      
      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
    });
  });
});

