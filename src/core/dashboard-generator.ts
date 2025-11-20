/**
 * Dashboard Generator - Generate dashboard data for CLI display
 * @requirement FREE-TIER-003 - CLI Dashboard
 * 
 * Cursor Integration: Provides comprehensive project overview that Cursor can read
 */

import { TaskQueueManager, Task, Priority } from './task-queue.js';
import { WorkflowState } from '@shadel/workflow-core';

export interface DashboardData {
  activeTask: Task | null;
  queue: Task[];              // Top 5 by priority
  recentCompleted: Task[];     // Last 5
  statistics: {
    total: number;
    queued: number;
    active: number;
    completed: number;
    archived: number;
    completionThisWeek: number;
    completionThisMonth: number;
    avgCompletionTime: number;
    tasksByPriority: Record<Priority, number>;
  };
  stateDistribution: Record<WorkflowState, number>;
}

export class DashboardGenerator {
  constructor(private queueManager: TaskQueueManager) {}

  /**
   * Generate complete dashboard data
   * Cursor Integration: Provides comprehensive project state for Cursor context
   */
  async generate(): Promise<DashboardData> {
    const activeTask = await this.queueManager.getActiveTask();
    const queue = await this.queueManager.listTasks({
      status: ['QUEUED'],
      limit: 5
    });
    const recentCompleted = await this.queueManager.listTasks({
      status: ['DONE'],
      limit: 5,
      includeArchived: false
    });

    const allTasks = await this.queueManager.listTasks({
      includeArchived: false
    });

    const statistics = this.calculateStatistics(allTasks);
    const stateDistribution = this.calculateStateDistribution(allTasks);

    return {
      activeTask,
      queue,
      recentCompleted,
      statistics,
      stateDistribution
    };
  }

  /**
   * Calculate task statistics
   */
  private calculateStatistics(tasks: Task[]): DashboardData['statistics'] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completed = tasks.filter(t => t.status === 'DONE');
    const completedThisWeek = completed.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= weekAgo;
    });
    const completedThisMonth = completed.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt) >= monthAgo;
    });

    const tasksWithTime = completed.filter(t => t.actualTime !== undefined);
    const avgCompletionTime = tasksWithTime.length > 0
      ? tasksWithTime.reduce((sum, t) => sum + (t.actualTime || 0), 0) / tasksWithTime.length
      : 0;

    const tasksByPriority: Record<Priority, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    tasks.forEach(t => {
      const priority = t.priority || 'MEDIUM';
      tasksByPriority[priority]++;
    });

    return {
      total: tasks.length,
      queued: tasks.filter(t => t.status === 'QUEUED').length,
      active: tasks.filter(t => t.status === 'ACTIVE').length,
      completed: completed.length,
      archived: tasks.filter(t => t.status === 'ARCHIVED').length,
      completionThisWeek: completedThisWeek.length,
      completionThisMonth: completedThisMonth.length,
      avgCompletionTime,
      tasksByPriority
    };
  }

  /**
   * Calculate workflow state distribution
   */
  private calculateStateDistribution(tasks: Task[]): Record<WorkflowState, number> {
    const distribution: Record<string, number> = {
      'UNDERSTANDING': 0,
      'DESIGNING': 0,
      'IMPLEMENTING': 0,
      'TESTING': 0,
      'REVIEWING': 0,
      'READY_TO_COMMIT': 0
    };
    
    tasks.forEach(t => {
      if (t.workflow?.currentState) {
        const state = t.workflow.currentState;
        if (distribution[state] !== undefined) {
          distribution[state] = (distribution[state] || 0) + 1;
        }
      }
    });
    
    return distribution as Record<WorkflowState, number>;
  }
}

