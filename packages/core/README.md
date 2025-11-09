# @workflow/core

Foundation package for AI Workflow Engine - Shared code for Core and Full builds.

**@requirement REQ-V2-002**

## Overview

Pure foundation package providing state machine, workflow engine, plugin system, and utilities. Used by both `@ai-workflow/core` and `@ai-workflow/full` builds.

## Features

- ✅ State Machine (6-state workflow)
- ✅ Workflow Engine (orchestrator with hooks)
- ✅ Plugin System (extensibility)
- ✅ Error Handling (standardized errors)
- ✅ Security Utilities (path validation)
- ✅ Type Definitions (complete type system)

## Installation

```bash
npm install @workflow/core
```

## Usage

### Basic State Machine

```typescript
import { StateMachine } from '@workflow/core';

const machine = new StateMachine();

// Get current state
console.log(machine.getCurrentState()); // 'UNDERSTANDING'

// Transition to next state
machine.setState('DESIGN_COMPLETE');

// Get progress
console.log(machine.getProgress()); // 20

// Check if complete
console.log(machine.isComplete()); // false
```

### Workflow Engine

```typescript
import { WorkflowEngine } from '@workflow/core';

const engine = new WorkflowEngine({
  onStateChange: async (from, to) => {
    console.log(`State changed: ${from} -> ${to}`);
  },
  onTaskCreate: async (task) => {
    console.log(`Task created: ${task.goal}`);
  }
});

// Create task
const task = await engine.createTask('Implement feature X');

// Transition states
await engine.transitionTo('DESIGN_COMPLETE');
await engine.transitionTo('IMPLEMENTATION_COMPLETE');

// Check progress
console.log(engine.getProgress()); // 40

// Complete task
await engine.completeTask();
```

### Plugin System

```typescript
import { PluginManager, WorkflowPlugin } from '@workflow/core';

// Define plugin
const myPlugin: WorkflowPlugin = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  
  async onStateChange(from, to) {
    console.log(`Plugin sees: ${from} -> ${to}`);
  },
  
  async validate() {
    return { valid: true, errors: [], warnings: [] };
  }
};

// Use plugin
const manager = new PluginManager();
await manager.register(myPlugin);

// Execute hooks
await manager.executeHook('onStateChange', 'UNDERSTANDING', 'DESIGN_COMPLETE');
```

### Security (Path Validation)

```typescript
import { PathValidator } from '@workflow/core';

const validator = new PathValidator('/my/project/root');

// Validate path
const result = validator.validate('../../../etc/passwd');
// Throws error: "Path outside project root"

// Safe path check
if (validator.isSafe('./config/settings.json')) {
  // Path is safe to use
}
```

### Error Handling

```typescript
import { StateTransitionError, ValidationError } from '@workflow/core';

// Throw standardized errors
throw new StateTransitionError('UNDERSTANDING', 'COMMIT_READY');
throw new ValidationError('Coverage too low', { coverage: 45 });
```

## API Reference

See [API Documentation](./docs/API.md) for complete reference.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Coverage:** 97.69% (exceeds 90% target)

## Package Size

~200KB (well under 500KB target)

## Version

1.0.0

## License

MIT

