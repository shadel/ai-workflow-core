#!/usr/bin/env node

/**
 * CLI executable for @ai-workflow/core
 */

import('../dist/workflow-core/src/cli/index.js').catch(err => {
  console.error('Failed to load CLI:', err);
  process.exit(1);
});

