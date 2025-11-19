/**
 * Unit tests for Pattern Commands (v3.1.0)
 * @requirement v3.1.0 - Pattern command testing
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { RuleManager } from '../src/utils/rule-manager.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Pattern Commands (v3.1.0)', () => {
  let testDir: string;
  let manager: RuleManager;

  const originalCwd = process.cwd();

  beforeEach(async () => {
    // Create temp test directory using OS temp
    testDir = path.join(os.tmpdir(), `ai-workflow-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, '.ai-context'));
    
    // Change working directory for tests
    process.chdir(testDir);
    manager = new RuleManager();
  });

  afterEach(async () => {
    // Restore working directory
    process.chdir(originalCwd);
    
    // Cleanup
    if (testDir && await fs.pathExists(testDir)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await fs.remove(testDir);
      } catch (error) {
        // Ignore cleanup errors on Windows
      }
    }
  });

  describe('Pattern vs Rule terminology', () => {
    test('should work with patterns.json (new format)', async () => {
      // Create patterns.json
      await fs.writeJson('.ai-context/patterns.json', {
        patterns: [
          { id: 'PATTERN-001', title: 'Test Pattern', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      const patterns = await manager.getRules();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].title).toBe('Test Pattern');
    });

    test('should fallback to rules.json (legacy format)', async () => {
      // Create only rules.json
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'RULE-001', title: 'Test Rule', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      const patterns = await manager.getRules();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].title).toBe('Test Rule');
    });

    test('should prioritize patterns.json over rules.json', async () => {
      // Create both files
      await fs.writeJson('.ai-context/patterns.json', {
        patterns: [
          { id: 'PATTERN-001', title: 'Pattern File', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });
      
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'RULE-001', title: 'Rules File', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      const patterns = await manager.getRules();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].title).toBe('Pattern File'); // From patterns.json, not rules.json
    });
  });

  describe('Pattern operations', () => {
    test('should add pattern to patterns.json when it exists', async () => {
      // Create empty patterns.json
      await fs.writeJson('.ai-context/patterns.json', {
        patterns: [],
        lastUpdated: new Date().toISOString()
      });

      const pattern = await manager.addRule({
        title: 'New Pattern',
        content: 'Pattern content',
        score: 5
      });

      expect(pattern.id).toMatch(/^(RULE|PATTERN)-\d+/);
      expect(pattern.title).toBe('New Pattern');
      
      // Verify saved to patterns.json
      const data = await fs.readJson('.ai-context/patterns.json');
      expect(data.patterns).toHaveLength(1);
    });

    test('should add pattern to rules.json when patterns.json does not exist', async () => {
      const pattern = await manager.addRule({
        title: 'New Pattern',
        content: 'Pattern content',
        score: 5
      });

      expect(pattern.id).toBeDefined();
      
      // Verify saved to rules.json (fallback)
      const data = await fs.readJson('.ai-context/rules.json');
      expect(data.rules).toHaveLength(1);
    });
  });

  describe('Backward compatibility', () => {
    test('should read existing rules.json without migration', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'RULE-001', title: 'Old Rule', content: 'Content', createdAt: new Date().toISOString() },
          { id: 'RULE-002', title: 'Another Rule', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      const patterns = await manager.getRules();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].id).toBe('RULE-001'); // ID unchanged
    });

    test('should continue working with rules.json format', async () => {
      // Add using old format
      const pattern = await manager.addRule({
        title: 'Test',
        content: 'Content'
      });

      // Should save to rules.json (when patterns.json doesn't exist)
      expect(await fs.pathExists('.ai-context/rules.json')).toBe(true);
      
      const patterns = await manager.getRules();
      expect(patterns).toHaveLength(1);
    });
  });
});

