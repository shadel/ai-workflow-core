/**
 * Task Manager - Core task management logic
 * @requirement REQ-V2-003
 */

import { WorkflowEngine, Task, WorkflowState } from '@workflow/core';
import fs from 'fs-extra';
import path from 'path';
import { ContextInjector } from './context-injector.js';
import { RoleSystem } from './role-system.js';

export class TaskManager {
  private engine: WorkflowEngine;
  private contextDir: string;
  private taskFile: string;
  private contextInjector: ContextInjector;
  private roleSystem: RoleSystem;

  constructor(contextDir = '.ai-context') {
    this.engine = new WorkflowEngine();
    this.contextDir = contextDir;
    this.taskFile = path.join(contextDir, 'current-task.json');
    this.contextInjector = new ContextInjector();
    this.roleSystem = new RoleSystem();
  }

  /**
   * Create a new task
   * @requirement REQ-V2-003 - Task management CRUD operations
   * @requirement REQ-V2-010 - Auto-inject context after command
   */
  async createTask(goal: string, requirements?: string[]): Promise<Task> {
    await fs.ensureDir(this.contextDir);
    
    const task = await this.engine.createTask(goal);
    
    // Add requirements if provided
    const taskData = {
      taskId: task.id,
      originalGoal: goal,
      status: 'in_progress',
      startedAt: task.startedAt,
      workflow: {
        currentState: task.status,
        stateEnteredAt: new Date().toISOString(),
        stateHistory: []
      },
      requirements: requirements || []
    };

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    
    // Activate roles based on task context
    const activeRoles = this.roleSystem.getActiveRoles({
      taskGoal: goal,
      linkedRequirements: requirements?.map(id => ({ id }))
    });
    
    // Auto-inject context for AI
    await this.contextInjector.updateAfterCommand('task.create', {
      task,
      warnings: [],
      blockers: [],
      activeRoles
    });
    
    return task;
  }

  /**
   * Get current task
   * @requirement REQ-V2-003 - Task status retrieval
   */
  async getCurrentTask(): Promise<Task | null> {
    if (!await fs.pathExists(this.taskFile)) {
      return null;
    }

    try {
      const taskData = await fs.readJson(this.taskFile);
      return {
        id: taskData.taskId,
        goal: taskData.originalGoal,
        status: taskData.workflow.currentState,
        startedAt: taskData.startedAt,
        completedAt: taskData.completedAt,
        roleApprovals: []
      };
    } catch (error) {
      throw new Error(`Failed to load task: ${error}`);
    }
  }

  /**
   * Update task state
   * @requirement REQ-V2-002 - State machine integration
   * @requirement REQ-V2-010 - Auto-inject context after state change
   */
  async updateTaskState(state: WorkflowState): Promise<void> {
    const taskData = await fs.readJson(this.taskFile);
    
    taskData.workflow.currentState = state;
    taskData.workflow.stateEnteredAt = new Date().toISOString();
    taskData.workflow.stateHistory.push({
      state,
      enteredAt: new Date().toISOString()
    });

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    await this.engine.transitionTo(state);
    
    // Auto-inject context for AI
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      await this.contextInjector.updateAfterCommand('sync', {
        task: currentTask,
        warnings: [],
        blockers: []
      });
    }
  }

  /**
   * Complete task
   * @requirement REQ-V2-003 - Task lifecycle completion
   * @requirement REQ-V2-010 - Auto-inject context after completion
   */
  async completeTask(): Promise<void> {
    const taskData = await fs.readJson(this.taskFile);
    
    taskData.status = 'completed';
    taskData.completedAt = new Date().toISOString();
    taskData.workflow.currentState = 'COMMIT_READY';

    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    await this.engine.completeTask();
    
    // Auto-inject context for AI
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      await this.contextInjector.updateAfterCommand('task.complete', {
        task: currentTask,
        warnings: [],
        blockers: []
      });
    }
  }

  /**
   * Get workflow progress
   */
  getProgress(): number {
    return this.engine.getProgress();
  }

  /**
   * List tasks (current + history)
   * @requirement REQ-V2-003 - Task listing (NEW v2.0)
   */
  async listTasks(statusFilter?: string, limit = 10): Promise<Task[]> {
    const tasks: Task[] = [];
    
    // Get current task
    const currentTask = await this.getCurrentTask();
    if (currentTask) {
      if (!statusFilter || currentTask.status === statusFilter) {
        tasks.push(currentTask);
      }
    }
    
    // Get task history
    const historyDir = path.join(this.contextDir, 'task-history');
    if (await fs.pathExists(historyDir)) {
      const files = await fs.readdir(historyDir);
      const historyFiles = files.filter(f => f.endsWith('.json'));
      
      // Sort by modification time (most recent first)
      const filesWithStats = await Promise.all(
        historyFiles.map(async (file) => {
          const filePath = path.join(historyDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );
      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Read historical tasks
      for (const { file } of filesWithStats) {
        if (tasks.length >= limit) break;
        
        try {
          const taskData = await fs.readJson(path.join(historyDir, file));
          
          // Convert task data to Task format
          const historicalTask: Task = {
            id: taskData.taskId || file.replace('.json', ''),
            goal: taskData.originalGoal || '',
            status: taskData.workflow?.currentState || 'UNDERSTANDING',
            startedAt: taskData.startedAt || '',
            completedAt: taskData.completedAt,
            roleApprovals: taskData.roleApprovals || []
          };
          
          if (!statusFilter || historicalTask.status === statusFilter) {
            tasks.push(historicalTask);
          }
        } catch (error) {
          // Skip invalid task files
          continue;
        }
      }
    }
    
    return tasks.slice(0, limit);
  }

  /**
   * Update task details
   * @requirement REQ-V2-003 - Task update (NEW v2.0)
   */
  async updateTask(
    taskId: string,
    updates: {
      goal?: string;
      addReq?: string;
    }
  ): Promise<void> {
    // Check if it's the current task
    const currentTask = await this.getCurrentTask();
    if (!currentTask || currentTask.id !== taskId) {
      throw new Error(`Task ${taskId} not found or not active`);
    }
    
    // Load task data
    const taskData = await fs.readJson(this.taskFile);
    
    // Apply updates
    if (updates.goal) {
      taskData.originalGoal = updates.goal;
    }
    
    if (updates.addReq) {
      if (!taskData.requirements) {
        taskData.requirements = [];
      }
      if (!taskData.requirements.includes(updates.addReq)) {
        taskData.requirements.push(updates.addReq);
      }
    }
    
    // Save updated task
    await fs.writeJson(this.taskFile, taskData, { spaces: 2 });
    
    // Auto-inject context for AI
    const updatedTask = await this.getCurrentTask();
    if (updatedTask) {
      await this.contextInjector.updateAfterCommand('task.update', {
        task: updatedTask,
        warnings: [],
        blockers: []
      });
    }
  }
}

