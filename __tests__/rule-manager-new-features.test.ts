/**
 * Rule Manager New Features Tests
 * Tests for checkMissingRules(), getRuleTemplate(), getRuleInfo()
 * @requirement REQ-V2-003
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { RuleManager } from '../src/utils/rule-manager.js';

describe('RuleManager - New Features', () => {
  let ruleManager: RuleManager;
  let originalCwd: string;
  let testDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `rule-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
    
    ruleManager = new RuleManager();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('checkMissingRules()', () => {
    it('should return all rules as missing when none exist', async () => {
      const result = await ruleManager.checkMissingRules();
      
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.present.length).toBe(0);
      expect(result.missing).toContain('RULE-001');
      expect(result.missing).toContain('RULE-002');
    });

    it('should detect present rules', async () => {
      // Add a rule
      await ruleManager.addRule({
        title: 'Test Rule',
        content: 'Test content',
        source: 'test'
      });
      
      const result = await ruleManager.checkMissingRules();
      
      expect(result.present.length).toBeGreaterThan(0);
    });
  });

  describe('getRuleTemplate()', () => {
    it('should return template for RULE-001', async () => {
      const template = await ruleManager.getRuleTemplate('RULE-001');
      
      expect(template).toBeTruthy();
      expect(template).toContain('RULE-001');
      expect(template).toContain('No Interactive Terminal Commands');
    });

    it('should return template for RULE-002', async () => {
      const template = await ruleManager.getRuleTemplate('RULE-002');
      
      expect(template).toBeTruthy();
      expect(template).toContain('RULE-002');
      expect(template).toContain('Document Organization');
    });

    it('should return generic template for unknown rule', async () => {
      const template = await ruleManager.getRuleTemplate('RULE-999');
      
      expect(template).toBeTruthy();
      expect(template).toContain('RULE-999');
      expect(template).toContain('Custom Rule');
    });
  });

  describe('getRuleInfo()', () => {
    it('should return null for non-existent rule', async () => {
      const info = await ruleManager.getRuleInfo('RULE-999');
      
      expect(info).toBeNull();
    });

    it('should return rule info with parsed sections', async () => {
      // Add a rule with markdown sections
      await ruleManager.addRule({
        title: 'Test Rule',
        content: `# RULE-001: Test

## Rule
This is the rule description.

## Rationale
This is why it matters.

## Examples
- Example 1
- Example 2`,
        source: 'test'
      });
      
      const info = await ruleManager.getRuleInfo('RULE-001');
      
      expect(info).toBeTruthy();
      expect(info?.id).toBe('RULE-001');
      expect(info?.title).toBe('Test Rule');
      expect(info?.description).toContain('rule description');
      expect(info?.rationale).toContain('why it matters');
      expect(info?.examples).toBeDefined();
    });
  });
});

