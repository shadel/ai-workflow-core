import fs from 'fs-extra';
import path from 'path';
import { RuleManager } from '../src/utils/rule-manager.js';
import { getUniqueAIContextDir, cleanupWithRetry } from './test-helpers.js';

describe('Pattern CLI - State-Based Fields (RuleManager passthrough)', () => {
  let aiContextDir: string;
  let patternsFile: string;
  let ruleManager: RuleManager;
  let originalPatternsFile: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    aiContextDir = getUniqueAIContextDir();
    testDirs.push(aiContextDir); // Track for cleanup
    patternsFile = path.join(aiContextDir, 'patterns.json');
    await fs.ensureDir(aiContextDir);
    await fs.writeJson(patternsFile, { patterns: [], lastUpdated: new Date().toISOString() }, { spaces: 2 });
    
    // Override RuleManager's file paths for testing
    ruleManager = new RuleManager();
    originalPatternsFile = (ruleManager as any).patternsFile;
    (ruleManager as any).patternsFile = patternsFile;
    (ruleManager as any).rulesFile = path.join(aiContextDir, 'rules.json');
  });

  afterEach(async () => {
    // Restore original paths
    if (ruleManager && originalPatternsFile) {
      (ruleManager as any).patternsFile = originalPatternsFile;
    }
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
    // Each test uses unique directory, no need for global cleanup
  });

  test('addRule preserves applicableStates/requiredStates/validation in patterns.json', async () => {
    const pattern = await ruleManager.addRule({
      title: 'Test Plan Required',
      content: 'Ensure test plan exists',
      source: 'tests',
      score: 5,
      applicableStates: ['IMPLEMENTING', 'TESTING'] as any,
      requiredStates: ['IMPLEMENTING', 'TESTING'] as any,
      validation: {
        type: 'file_exists',
        rule: 'docs/test-plans/${task.id}-test-plan.md',
        message: 'Missing test plan',
        severity: 'error'
      }
    } as any);

    expect(pattern.id).toBeDefined();

    const saved = await fs.readJson(patternsFile);
    const savedPattern = saved.patterns.find((p: any) => p.id === pattern.id);

    expect(savedPattern).toBeTruthy();
    expect(savedPattern.applicableStates).toEqual(['IMPLEMENTING', 'TESTING']);
    expect(savedPattern.requiredStates).toEqual(['IMPLEMENTING', 'TESTING']);
    expect(savedPattern.validation).toEqual({
      type: 'file_exists',
      rule: 'docs/test-plans/${task.id}-test-plan.md',
      message: 'Missing test plan',
      severity: 'error'
    });
  });

  test('getRuleInfo returns state-based fields along with parsed info', async () => {
    const pattern = await ruleManager.addRule({
      title: 'State-Based Coding',
      content: '## Rule\nDo not code in UNDERSTANDING/DESIGNING\n\n## Rationale\nProcess discipline\n\n## Examples\nGood: Ask questions\nBad: Write code',
      score: 5,
      applicableStates: ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING'] as any,
      requiredStates: ['UNDERSTANDING', 'DESIGNING'] as any,
      validation: {
        type: 'code_check',
        rule: 'no_code_changes_when_state_is_UNDERSTANDING_or_DESIGNING',
        message: 'Coding not allowed in early states',
        severity: 'error'
      }
    } as any);

    const info = await ruleManager.getRuleInfo(pattern.id);
    expect(info).toBeTruthy();
    expect((info as any).applicableStates).toEqual(['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING']);
    expect((info as any).requiredStates).toEqual(['UNDERSTANDING', 'DESIGNING']);
    expect((info as any).validation.type).toBe('code_check');
    expect(info?.description).toContain('Do not code');
    expect(info?.rationale).toContain('Process discipline');
    expect(info?.examples?.length).toBeGreaterThan(0);
  });
});








