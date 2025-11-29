/**
 * Dashboard Renderer - Render dashboard data as rich CLI output
 * @requirement FREE-TIER-003 - CLI Dashboard
 */

import boxen from 'boxen';
import chalk from 'chalk';
import { table } from 'table';
import { DashboardData } from '../core/dashboard-generator.js';
import { Priority } from '../core/task-queue.js';
import { TimeTracker } from '../core/time-tracker.js';

export class DashboardRenderer {
  /**
   * Render complete dashboard
   */
  render(data: DashboardData): string {
    const sections: string[] = [];

    // Active Task
    if (data.activeTask) {
      sections.push(this.renderActiveTask(data.activeTask));
    }

    // Queue
    sections.push(this.renderQueue(data.queue));

    // Recent Completed
    if (data.recentCompleted.length > 0) {
      sections.push(this.renderRecentCompleted(data.recentCompleted));
    }

    // Statistics
    sections.push(this.renderStatistics(data.statistics));

    // State Distribution
    sections.push(this.renderStateDistribution(data.stateDistribution));

    return sections.join('\n\n');
  }

  private renderActiveTask(task: any): string {
    const priorityColor = this.getPriorityColor(task.priority);
    const priorityIcon = this.getPriorityIcon(task.priority);

    return boxen(
      `${chalk.bold('ACTIVE TASK')}\n\n` +
      `${priorityIcon} ${chalk.bold(task.goal)}\n` +
      `ID: ${task.id}\n` +
      `Priority: ${priorityColor(task.priority || 'MEDIUM')}\n` +
      `State: ${task.workflow?.currentState || 'N/A'}\n` +
      (task.estimatedTime ? `Estimate: ${task.estimatedTime}\n` : ''),
      { title: 'Current Work', borderColor: 'cyan', padding: 1 }
    );
  }

  private renderQueue(queue: any[]): string {
    if (queue.length === 0) {
      return boxen(
        chalk.gray('No queued tasks'),
        { title: 'Task Queue', borderColor: 'yellow', padding: 1 }
      );
    }

    const rows = queue.map(task => [
      this.getPriorityIcon(task.priority),
      task.id.substring(0, 12),
      task.goal.substring(0, 40),
      this.getPriorityColor(task.priority)(task.priority || 'MEDIUM')
    ]);

    const tableOutput = table([
      ['', 'ID', 'Goal', 'Priority'],
      ...rows
    ]);

    return boxen(
      tableOutput,
      { title: 'Task Queue (Top 5)', borderColor: 'yellow', padding: 1 }
    );
  }

  private renderRecentCompleted(completed: any[]): string {
    if (completed.length === 0) {
      return '';
    }

    const rows = completed.map(task => [
      task.id.substring(0, 12),
      task.goal.substring(0, 40),
      task.actualTime ? TimeTracker.formatTime(task.actualTime) : 'N/A'
    ]);

    const tableOutput = table([
      ['ID', 'Goal', 'Time'],
      ...rows
    ]);

    return boxen(
      tableOutput,
      { title: 'Recently Completed (Last 5)', borderColor: 'green', padding: 1 }
    );
  }

  private renderStatistics(stats: any): string {
    return boxen(
      `${chalk.bold('Statistics')}\n\n` +
      `Total Tasks: ${stats.total}\n` +
      `Queued: ${stats.queued} | Active: ${stats.active} | Completed: ${stats.completed}\n` +
      `Completed This Week: ${stats.completionThisWeek}\n` +
      `Completed This Month: ${stats.completionThisMonth}\n` +
      `Avg Completion Time: ${TimeTracker.formatTime(stats.avgCompletionTime)}\n\n` +
      `${chalk.bold('By Priority:')}\n` +
      `  🔴 CRITICAL: ${stats.tasksByPriority.CRITICAL}\n` +
      `  🟠 HIGH: ${stats.tasksByPriority.HIGH}\n` +
      `  🟡 MEDIUM: ${stats.tasksByPriority.MEDIUM}\n` +
      `  🟢 LOW: ${stats.tasksByPriority.LOW}`,
      { title: 'Project Statistics', borderColor: 'blue', padding: 1 }
    );
  }

  private renderStateDistribution(dist: any): string {
    const rows = Object.entries(dist)
      .filter(([_, count]) => (count as number) > 0)
      .map(([state, count]) => [
        state,
        String(count)
      ]);

    if (rows.length === 0) {
      return boxen(
        chalk.gray('No tasks in workflow states'),
        { title: 'Workflow State Distribution', borderColor: 'magenta', padding: 1 }
      );
    }

    const tableOutput = table([
      ['State', 'Count'],
      ...rows
    ]);

    return boxen(
      tableOutput,
      { title: 'Workflow State Distribution', borderColor: 'magenta', padding: 1 }
    );
  }

  private getPriorityColor(priority?: Priority): (text: string) => string {
    switch (priority) {
      case 'CRITICAL': return chalk.red;
      case 'HIGH': return chalk.yellow;
      case 'MEDIUM': return chalk.blue;
      case 'LOW': return chalk.green;
      default: return chalk.gray;
    }
  }

  private getPriorityIcon(priority?: Priority): string {
    switch (priority) {
      case 'CRITICAL': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  }
}

