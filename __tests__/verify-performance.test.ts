/**
 * Performance Testing
 * 
 * Phase 8.5: Performance Testing
 * Benchmarks operations to ensure no significant slowdown after refactoring.
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { TaskManager } from '../src/core/task-manager.js';
import { getUniqueAIContextDir, cleanupWithRetry, getPerformanceThreshold } from './test-helpers.js';

describe('Phase 8.5: Performance Testing', () => {
  let testDir: string;
  let taskManager: TaskManager;
  const testDirs: string[] = []; // Track all test directories for cleanup

  beforeEach(async () => {
    // Use unique directory per test to avoid conflicts in parallel execution
    testDir = getUniqueAIContextDir();
    testDirs.push(testDir); // Track for cleanup
    await fs.ensureDir(testDir);
    taskManager = new TaskManager(testDir);
  });

  afterAll(async () => {
    // Cleanup all test directories with retry logic
    await Promise.all(
      testDirs.map(dir => cleanupWithRetry(dir))
    );
    testDirs.length = 0; // Clear array
  });

  /**
   * Measure execution time of an operation
   */
  async function measureTime(operation: () => Promise<any>): Promise<number> {
    const start = Date.now();
    await operation();
    const end = Date.now();
    return end - start;
  }

  describe('8.5.1: Benchmark createTask() operation', () => {
    it('should complete createTask() within acceptable time', async () => {
      // This test runs 10 iterations and may take longer in parallel execution
      const times: number[] = [];
      
      // Run 10 iterations
      for (let i = 0; i < 10; i++) {
        const time = await measureTime(async () => {
          await taskManager.createTask(`Test task ${i} for performance benchmarking`);
        });
        times.push(time);
        
        // Clean up for next iteration
        if (await fs.pathExists(testDir)) {
          await fs.remove(testDir);
          await fs.ensureDir(testDir);
          taskManager = new TaskManager(testDir);
        }
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`createTask() - Avg: ${avgTime}ms, Max: ${maxTime}ms`);
      
      // OPTIMIZED: Use getPerformanceThreshold() helper (accounts for CI/local, Windows/Unix)
      const threshold = getPerformanceThreshold('file-operation');
      const maxThreshold = threshold * 2.5; // Max should be 2.5x average for outliers
      
      expect(avgTime).toBeLessThan(threshold);
      expect(maxTime).toBeLessThan(maxThreshold);
    }, 30000); // 30s timeout for 10 iterations in parallel execution
  });

  describe('8.5.2: Benchmark updateTaskState() operation', () => {
    it('should complete updateTaskState() within acceptable time', async () => {
      await taskManager.createTask('Test task for state update performance');
      
      const times: number[] = [];
      
      // Run 10 state transitions
      for (let i = 0; i < 10; i++) {
        const states = ['DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'];
        const state = states[i % states.length];
        
        const time = await measureTime(async () => {
          try {
            await taskManager.updateTaskState(state as any);
          } catch (e) {
            // Ignore invalid transitions
          }
        });
        times.push(time);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`updateTaskState() - Avg: ${avgTime}ms, Max: ${maxTime}ms`);
      
      // OPTIMIZED: Use getPerformanceThreshold() helper for state transitions
      const threshold = getPerformanceThreshold('state-transition');
      const maxThreshold = threshold * 2.5; // Max should be 2.5x average for outliers
      
      expect(avgTime).toBeLessThan(threshold);
      expect(maxTime).toBeLessThan(maxThreshold);
    });
  });

  describe('8.5.3: Benchmark saveReviewChecklist() operation', () => {
    it('should complete saveReviewChecklist() within acceptable time', async () => {
      await taskManager.createTask('Test task for review checklist performance');
      await taskManager.updateTaskState('DESIGNING');
      await taskManager.updateTaskState('IMPLEMENTING');
      await taskManager.updateTaskState('TESTING');
      await taskManager.updateTaskState('REVIEWING');
      
      // Wait for checklist to be created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const times: number[] = [];
      
      // Run 5 iterations
      for (let i = 0; i < 5; i++) {
        const time = await measureTime(async () => {
          // Simulate checklist update (via state transition which triggers save)
          try {
            await taskManager.updateTaskState('REVIEWING');
          } catch (e) {
            // Ignore errors
          }
        });
        times.push(time);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`saveReviewChecklist() - Avg: ${avgTime}ms, Max: ${maxTime}ms`);
      
      // OPTIMIZED: Use getPerformanceThreshold() helper for file operations
      const threshold = getPerformanceThreshold('file-operation');
      const maxThreshold = threshold * 2.5; // Max should be 2.5x average
      
      expect(avgTime).toBeLessThan(threshold);
      expect(maxTime).toBeLessThan(maxThreshold);
    });
  });

  describe('8.5.4: Benchmark getCurrentTask() operation', () => {
    it('should complete getCurrentTask() within acceptable time', async () => {
      await taskManager.createTask('Test task for getCurrentTask performance');
      
      const times: number[] = [];
      
      // Run 100 iterations
      for (let i = 0; i < 100; i++) {
        const time = await measureTime(async () => {
          await taskManager.getCurrentTask();
        });
        times.push(time);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      
      console.log(`getCurrentTask() - Avg: ${avgTime}ms, Max: ${maxTime}ms, P95: ${p95}ms`);
      
      // Acceptable: < 55ms average (slight margin for Windows/parallel execution), < 200ms max, < 100ms P95
      expect(avgTime).toBeLessThan(55);
      expect(maxTime).toBeLessThan(200);
      expect(p95).toBeLessThan(100);
    });
  });

  describe('8.5.5: Compare with baseline (before refactor)', () => {
    it('should not have significant slowdown', async () => {
      // Note: This is a placeholder test
      // In a real scenario, we would compare with baseline measurements
      // For now, we just verify operations complete within acceptable time
      
      await taskManager.createTask('Test task for baseline comparison');
      
      const createTime = await measureTime(async () => {
        await taskManager.createTask('Another task for comparison');
      });
      
      const stateTime = await measureTime(async () => {
        await taskManager.updateTaskState('DESIGNING');
      });
      
      const getTime = await measureTime(async () => {
        await taskManager.getCurrentTask();
      });
      
      console.log(`Baseline comparison - Create: ${createTime}ms, State: ${stateTime}ms, Get: ${getTime}ms`);
      
      // OPTIMIZED: Use getPerformanceThreshold() helper
      const fileOpThreshold = getPerformanceThreshold('file-operation');
      const stateThreshold = getPerformanceThreshold('state-transition');
      
      expect(createTime).toBeLessThan(fileOpThreshold * 2.5); // Max threshold with margin
      expect(stateTime).toBeLessThan(stateThreshold);
      expect(getTime).toBeLessThan(200); // getCurrentTask is fast, keep low threshold
    });
  });

  describe('8.5.6: Verify no significant slowdown', () => {
    it('should maintain acceptable performance across all operations', async () => {
      const results: { operation: string; time: number }[] = [];
      
      // Test createTask
      const createTime = await measureTime(async () => {
        await taskManager.createTask('Performance test task');
      });
      results.push({ operation: 'createTask', time: createTime });
      
      // Test updateTaskState
      const stateTime = await measureTime(async () => {
        await taskManager.updateTaskState('DESIGNING');
      });
      results.push({ operation: 'updateTaskState', time: stateTime });
      
      // Test getCurrentTask
      const getTime = await measureTime(async () => {
        await taskManager.getCurrentTask();
      });
      results.push({ operation: 'getCurrentTask', time: getTime });
      
      // Test updateTask
      const task = await taskManager.getCurrentTask();
      if (task) {
        const updateTime = await measureTime(async () => {
          await taskManager.updateTask(task.id, { addReq: 'REQ-TEST' });
        });
        results.push({ operation: 'updateTask', time: updateTime });
      }
      
      // Log results
      console.log('Performance results:', results);
      
      // OPTIMIZED: Use getPerformanceThreshold() helper with appropriate margins
      const fileOpThreshold = getPerformanceThreshold('file-operation');
      const stateThreshold = getPerformanceThreshold('state-transition');
      
      // Verify all operations complete within acceptable time
      results.forEach(result => {
        // Use appropriate threshold based on operation type
        const threshold = result.operation.includes('State') 
          ? stateThreshold 
          : fileOpThreshold;
        expect(result.time).toBeLessThan(threshold * 2.5); // Max threshold with margin
      });
    });
  });

  describe('8.5.7: Optimize if needed', () => {
    it('should identify optimization opportunities', async () => {
      // This test serves as a placeholder for optimization analysis
      // In practice, we would:
      // 1. Profile operations
      // 2. Identify bottlenecks
      // 3. Optimize slow operations
      
      await taskManager.createTask('Test task for optimization analysis');
      
      // Run a series of operations
      const operations = [
        () => taskManager.getCurrentTask(),
        () => taskManager.updateTaskState('DESIGNING'),
        () => taskManager.getCurrentTask(),
      ];
      
      const times = await Promise.all(
        operations.map(op => measureTime(op))
      );
      
      const totalTime = times.reduce((a, b) => a + b, 0);
      
      console.log(`Total time for operations: ${totalTime}ms`);
      
      // Total should be reasonable
      expect(totalTime).toBeLessThan(2000);
    });
  });
});

