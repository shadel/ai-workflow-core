/**
 * Unit tests for StateEnforcementGenerator
 * @requirement REFACTOR-EXTRACT-STATE-ENFORCEMENT-GENERATOR - Phase 7 tests
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { StateEnforcementGenerator } from '../../src/core/state-enforcement-generator.js';
import { WorkflowState } from '@shadel/workflow-core';
import { cleanupWithRetry } from '../test-helpers.js';

describe('StateEnforcementGenerator', () => {
  let generator: StateEnforcementGenerator;
  let testRulesDir: string;
  let originalCwd: string;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(() => {
    generator = new StateEnforcementGenerator();
    // Use unique directory per test to avoid conflicts in parallel execution
    testRulesDir = path.join(os.tmpdir(), `test-rules-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    testDirs.push(testRulesDir); // Track for cleanup
    originalCwd = process.cwd();
    process.chdir(os.tmpdir());
  });

  afterEach(async () => {
    process.chdir(originalCwd);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
    await fs.remove(path.join(os.tmpdir(), '.cursor')).catch(() => {});
  });

  describe('generateStateEnforcementMDC()', () => {
    it('should generate MDC file with correct content', async () => {
      const state: WorkflowState = 'IMPLEMENTING';
      const taskId = 'task-123';
      const taskGoal = 'Test task goal';

      await generator.generateStateEnforcementMDC(state, taskId, taskGoal);

      const mdcFile = path.join(process.cwd(), '.cursor', 'rules', '000-current-state-enforcement.mdc');
      expect(await fs.pathExists(mdcFile)).toBe(true);

      const content = await fs.readFile(mdcFile, 'utf-8');
      expect(content).toContain(`currentState: ${state}`);
      expect(content).toContain(`taskId: ${taskId}`);
      expect(content).toContain(`Task: ${taskGoal}`);
      expect(content).toContain('alwaysApply: true');
      expect(content).toContain('priority: 0');
    });

    it('should include state summary in generated content', async () => {
      const state: WorkflowState = 'TESTING';
      await generator.generateStateEnforcementMDC(state, 'task-1', 'Test');

      const mdcFile = path.join(process.cwd(), '.cursor', 'rules', '000-current-state-enforcement.mdc');
      const content = await fs.readFile(mdcFile, 'utf-8');
      
      expect(content).toContain('Allowed: Write tests');
      expect(content).toContain('Forbidden: Modify production code');
    });

    it('should handle all workflow states', async () => {
      const states: WorkflowState[] = [
        'UNDERSTANDING',
        'DESIGNING',
        'IMPLEMENTING',
        'TESTING',
        'REVIEWING',
        'READY_TO_COMMIT'
      ];

      for (const state of states) {
        await generator.generateStateEnforcementMDC(state, 'task-1', 'Test');
        const mdcFile = path.join(process.cwd(), '.cursor', 'rules', '000-current-state-enforcement.mdc');
        const content = await fs.readFile(mdcFile, 'utf-8');
        expect(content).toContain(`currentState: ${state}`);
      }
    });

    it('should create .cursor/rules directory if it does not exist', async () => {
      const rulesDir = path.join(process.cwd(), '.cursor', 'rules');
      await fs.remove(rulesDir).catch(() => {});

      await generator.generateStateEnforcementMDC('UNDERSTANDING', 'task-1', 'Test');

      expect(await fs.pathExists(rulesDir)).toBe(true);
    });
  });

  describe('getStateSummary()', () => {
    it('should return summary for UNDERSTANDING state', () => {
      const summary = generator.getStateSummary('UNDERSTANDING');
      expect(summary).toContain('Allowed: Ask questions');
      expect(summary).toContain('Forbidden: Write code');
    });

    it('should return summary for DESIGNING state', () => {
      const summary = generator.getStateSummary('DESIGNING');
      expect(summary).toContain('Allowed: Design solution');
      expect(summary).toContain('Forbidden: Write production code');
    });

    it('should return summary for IMPLEMENTING state', () => {
      const summary = generator.getStateSummary('IMPLEMENTING');
      expect(summary).toContain('Allowed: Write code');
      expect(summary).toContain('Forbidden: Write tests');
    });

    it('should return summary for TESTING state', () => {
      const summary = generator.getStateSummary('TESTING');
      expect(summary).toContain('Allowed: Write tests');
      expect(summary).toContain('Forbidden: Modify production code');
    });

    it('should return summary for REVIEWING state', () => {
      const summary = generator.getStateSummary('REVIEWING');
      expect(summary).toContain('Allowed: Review code');
      expect(summary).toContain('Forbidden: Major changes');
    });

    it('should return summary for READY_TO_COMMIT state', () => {
      const summary = generator.getStateSummary('READY_TO_COMMIT');
      expect(summary).toContain('Allowed: Make commit');
      expect(summary).toContain('TASK COMPLETION REMINDER');
      expect(summary).toContain('npx ai-workflow task complete');
    });

    it('should return empty string for invalid state', () => {
      const summary = generator.getStateSummary('INVALID' as WorkflowState);
      expect(summary).toBe('');
    });
  });
});


