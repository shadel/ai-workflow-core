# Task Manager Testing Patterns

**Purpose:** Best practices and patterns for testing TaskManager to avoid common pitfalls.

**Last Updated:** 2025-11-21  
**Lessons Learned:** From fixing "should switch tasks without data loss" test failure

---

## 🚨 Critical Patterns

### Pattern 1: Instance Management

**❌ WRONG:**
```typescript
let taskManager: TaskManager;
let queueManager: TaskQueueManager; // Separate instance!

beforeEach(async () => {
  taskManager = new TaskManager(testDir);
  queueManager = new TaskQueueManager(testDir); // WRONG!
});
```

**✅ CORRECT:**
```typescript
let taskManager: TaskManager;

beforeEach(async () => {
  taskManager = new TaskManager(testDir);
  // Use taskManager's internal queueManager
  const queueManager = (taskManager as any).queueManager;
});
```

**Why:** Using separate instances causes timing issues and data inconsistency. The queueManager inside taskManager and the separate instance may read/write files at different times, causing race conditions.

---

### Pattern 2: Task Creation Behavior

**❌ WRONG ASSUMPTION:**
```typescript
// WRONG: Assuming new task automatically becomes active
const task1 = await taskManager.createTask('First task');
const task2 = await taskManager.createTask('Second task');
expect(await queueManager.getActiveTask()?.id).toBe(task2.id); // FAILS!
```

**✅ CORRECT:**
```typescript
// CORRECT: New tasks are QUEUED if active task exists
const task1 = await taskManager.createTask('First task');
expect(task1.status).toBe('ACTIVE'); // First task is active

const task2 = await taskManager.createTask('Second task');
expect(task2.status).toBe('QUEUED'); // Second task is queued
expect(await queueManager.getActiveTask()?.id).toBe(task1.id); // task1 still active

// Activate task2 if needed
await queueManager.activateTask(task2.id);
expect(await queueManager.getActiveTask()?.id).toBe(task2.id); // Now task2 is active
```

**Why:** Task creation behavior:
- First task: ACTIVE (no active task exists)
- Subsequent tasks: QUEUED (if active task exists)
- Use `force=true` to activate immediately: `createTask(goal, [], true)`

---

### Pattern 3: File Synchronization

**❌ WRONG:**
```typescript
await taskManager.syncFileFromQueue(activeTask, []);
// Immediately read file - may not be flushed yet!
const fileData = await fs.readJson(filePath);
```

**✅ CORRECT:**
```typescript
await taskManager.syncFileFromQueue(activeTask, []);
// Wait for file flush (especially important on Windows)
await new Promise(resolve => setTimeout(resolve, 150));
const fileData = await fs.readJson(filePath);
```

**Why:** File operations are asynchronous. On Windows, file system caching can cause reads to return stale data. Always wait after sync operations.

---

### Pattern 4: Using Test Helpers

**✅ RECOMMENDED:**
```typescript
import { createTaskManagerTestContext } from './task-manager-test-patterns';

describe('My Test', () => {
  const ctx = createTaskManagerTestContext();

  beforeEach(async () => {
    await ctx.setup();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('should work', async () => {
    const task = await ctx.taskManager.createTask('Test');
    const queueManager = ctx.getQueueManager(); // Same instance!
    await ctx.verifyTaskActive(task.id);
    await ctx.waitForFlush(); // Windows-safe wait
  });
});
```

**Why:** Test helpers enforce correct patterns and reduce boilerplate.

---

## 📋 Common Test Scenarios

### Scenario 1: Task Switching

```typescript
it('should switch tasks without data loss', async () => {
  const ctx = createTaskManagerTestContext();
  await ctx.setup();

  try {
    // Create first task (will be ACTIVE)
    const task1 = await ctx.taskManager.createTask('First task');
    await ctx.verifyTaskActive(task1.id);

    // Create second task (will be QUEUED)
    const task2 = await ctx.taskManager.createTask('Second task');
    await ctx.verifyTaskQueued(task2.id);
    await ctx.verifyTaskActive(task1.id); // task1 still active

    // Activate task2
    await ctx.getQueueManager().activateTask(task2.id);
    await ctx.verifyTaskActive(task2.id);
    await ctx.verifyTaskQueued(task1.id);

    // Switch back to task1
    await ctx.getQueueManager().activateTask(task1.id);
    await ctx.verifyTaskActive(task1.id);
    
    // Sync file
    const activeTask = await ctx.getActiveTask();
    await ctx.taskManager.syncFileFromQueue(activeTask, []);
    await ctx.waitForFlush();

    // Verify file
    await assertions.fileHasTaskId(ctx, task1.id);
  } finally {
    await ctx.cleanup();
  }
});
```

### Scenario 2: Task Creation with Force

```typescript
it('should force activate new task', async () => {
  const ctx = createTaskManagerTestContext();
  await ctx.setup();

  try {
    const task1 = await ctx.taskManager.createTask('First task');
    await ctx.verifyTaskActive(task1.id);

    // Force activate task2 (task1 becomes queued)
    const task2 = await ctx.taskManager.createTask('Second task', [], true);
    await ctx.verifyTaskActive(task2.id);
    await ctx.verifyTaskQueued(task1.id);
  } finally {
    await ctx.cleanup();
  }
});
```

---

## 🔍 Debugging Tips

### Enable Debug Logging

```typescript
const ctx = createTaskManagerTestContext({ debug: true });
// Or manually:
process.env.DEBUG_TASK_MANAGER = 'true';
process.env.TRACK_TASK_ID = 'true';
```

### Track TaskId Changes

```typescript
// Add logging in test
console.log('[TEST] Step 1: Creating task...');
const task = await ctx.taskManager.createTask('Test');
console.log('[TEST] Step 1: Created task, id:', task.id);

// Check queue state
const activeTask = await ctx.getActiveTask();
console.log('[TEST] Active task:', activeTask?.id);
```

---

## ✅ Checklist for New Tests

- [ ] Use `createTaskManagerTestContext()` helper
- [ ] Never create separate `TaskQueueManager` instance
- [ ] Verify task creation behavior (ACTIVE vs QUEUED)
- [ ] Wait for file flush after sync operations
- [ ] Use `ctx.getQueueManager()` instead of new instance
- [ ] Use `ctx.waitForFlush()` after file operations
- [ ] Use `ctx.verifyTaskActive()` / `ctx.verifyTaskQueued()` helpers
- [ ] Clean up test directory in `afterEach`

---

## 📚 Related Files

- `task-manager-test-patterns.ts` - Test helper implementation
- `verify-manual-workflow.test.ts` - Example usage
- `test-helpers.ts` - General test utilities

---

## 🎯 Key Takeaways

1. **Always use same instance** - Never create separate queueManager
2. **Understand behavior** - New tasks are QUEUED if active task exists
3. **Wait for flush** - Always wait after file operations
4. **Use helpers** - Test helpers enforce correct patterns
5. **Verify assumptions** - Don't assume behavior, verify it

