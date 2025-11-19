/**
 * Unit tests for Rules→Patterns Migration (v3.1.0)
 * @requirement v3.1.0 - Migration tool testing
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { RulesToPatternsMigration } from '../src/migrations/rules-to-patterns.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('RulesToPatternsMigration', () => {
  let testDir: string;
  let migration: RulesToPatternsMigration;

  const originalCwd = process.cwd();

  beforeEach(async () => {
    // Create temp test directory using OS temp
    testDir = path.join(os.tmpdir(), `ai-workflow-migration-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, '.ai-context'));
    
    // Change working directory for tests
    process.chdir(testDir);
    migration = new RulesToPatternsMigration();
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

  describe('migrate()', () => {
    test('should migrate rules.json to patterns.json', async () => {
      // Setup: Create rules.json
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'RULE-001', title: 'Test Rule', content: 'Content', createdAt: '2025-11-12T20:00:00.000Z' },
          { id: 'RULE-002', title: 'Another Rule', content: 'Content 2', createdAt: '2025-11-12T20:01:00.000Z' }
        ],
        lastUpdated: '2025-11-12T20:01:00.000Z'
      });

      // Migrate
      const result = await migration.migrate();

      // Verify
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
      expect(result.backupPath).toBeDefined();
      
      // Check patterns.json created
      expect(await fs.pathExists('.ai-context/patterns.json')).toBe(true);
      
      // Check content
      const patternsData = await fs.readJson('.ai-context/patterns.json');
      expect(patternsData.patterns).toHaveLength(2);
      expect(patternsData.patterns[0].id).toBe('PATTERN-001'); // ID updated
      expect(patternsData.patterns[0].title).toBe('Test Rule'); // Content preserved
    });

    test('should create backup automatically', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });

      await migration.migrate({ backup: true });

      expect(await fs.pathExists('.ai-context/rules.json.backup')).toBe(true);
    });

    test('should rename rules.json to rules.json.old', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });

      await migration.migrate();

      expect(await fs.pathExists('.ai-context/rules.json.old')).toBe(true);
      expect(await fs.pathExists('.ai-context/rules.json')).toBe(false); // Original moved
    });

    test('should fail if rules.json does not exist', async () => {
      const result = await migration.migrate();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No rules.json file found - nothing to migrate');
    });

    test('should fail if patterns.json already exists (without force)', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'C', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });
      await fs.writeJson('.ai-context/patterns.json', {
        patterns: [],
        lastUpdated: new Date().toISOString()
      });

      const result = await migration.migrate({ force: false });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('patterns.json already exists - use --force to overwrite');
    });

    test('should succeed with --force when patterns.json exists', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });
      await fs.writeJson('.ai-context/patterns.json', {
        patterns: [],
        lastUpdated: new Date().toISOString()
      });

      const result = await migration.migrate({ force: true });

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
    });

    test('should work in dry-run mode without changes', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });

      const result = await migration.migrate({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      
      // Verify no files changed
      expect(await fs.pathExists('.ai-context/patterns.json')).toBe(false);
      expect(await fs.pathExists('.ai-context/rules.json')).toBe(true);
      expect(await fs.pathExists('.ai-context/rules.json.old')).toBe(false);
    });
  });

  describe('rollback()', () => {
    test('should rollback migration successfully', async () => {
      // Setup: Migrate first
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });
      await migration.migrate();

      // Rollback
      const result = await migration.rollback();

      expect(result.success).toBe(true);
      
      // Verify restored
      expect(await fs.pathExists('.ai-context/rules.json')).toBe(true);
      expect(await fs.pathExists('.ai-context/patterns.json')).toBe(false);
      expect(await fs.pathExists('.ai-context/rules.json.old')).toBe(false);
    });

    test('should fail rollback if no backup exists', async () => {
      const result = await migration.rollback();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No backup found - cannot rollback');
    });
  });

  describe('checkStatus()', () => {
    test('should detect migration status correctly', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'C', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });

      const status = await migration.checkStatus();

      expect(status.hasRules).toBe(true);
      expect(status.hasPatterns).toBe(false);
      expect(status.hasMigrated).toBe(false);
    });

    test('should detect completed migration', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [{ id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() }],
        lastUpdated: new Date().toISOString()
      });
      await migration.migrate();

      const status = await migration.checkStatus();

      expect(status.hasRules).toBe(false); // Renamed to .old
      expect(status.hasPatterns).toBe(true);
      expect(status.hasMigrated).toBe(true); // rules.json.old exists
    });
  });

  describe('Data integrity', () => {
    test('should preserve all rule data during migration', async () => {
      const originalRule = {
        id: 'RULE-123',
        title: 'Test Rule',
        content: 'Important content that must not be lost',
        source: 'project-x',
        score: 5,
        createdAt: '2025-11-12T20:00:00.000Z'
      };

      await fs.writeJson('.ai-context/rules.json', {
        rules: [originalRule],
        lastUpdated: '2025-11-12T20:00:00.000Z'
      });

      await migration.migrate();

      const patternsData = await fs.readJson('.ai-context/patterns.json');
      const migratedPattern = patternsData.patterns[0];

      // Verify all data preserved
      expect(migratedPattern.title).toBe(originalRule.title);
      expect(migratedPattern.content).toBe(originalRule.content);
      expect(migratedPattern.source).toBe(originalRule.source);
      expect(migratedPattern.score).toBe(originalRule.score);
      expect(migratedPattern.createdAt).toBe(originalRule.createdAt);
    });

    test('should update RULE- prefix to PATTERN- in IDs', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'RULE-001', title: 'Test', content: 'Content', createdAt: new Date().toISOString() },
          { id: 'RULE-002', title: 'Test 2', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      await migration.migrate();

      const patternsData = await fs.readJson('.ai-context/patterns.json');
      expect(patternsData.patterns[0].id).toBe('PATTERN-001');
      expect(patternsData.patterns[1].id).toBe('PATTERN-002');
    });

    test('should preserve non-RULE IDs unchanged', async () => {
      await fs.writeJson('.ai-context/rules.json', {
        rules: [
          { id: 'CUSTOM-123', title: 'Custom ID', content: 'Content', createdAt: new Date().toISOString() }
        ],
        lastUpdated: new Date().toISOString()
      });

      await migration.migrate();

      const patternsData = await fs.readJson('.ai-context/patterns.json');
      expect(patternsData.patterns[0].id).toBe('CUSTOM-123'); // Not changed
    });
  });
});

