/**
 * Help Data for Core Build
 * Data-driven help command data structure
 * @requirement REQ-V2-003 - Help system data
 */

import type { CommandHelp, Category, Option } from './help-types.js';

/**
 * Categories for command organization
 */
export const CATEGORIES: Category[] = [
  {
    id: 'core-workflow',
    name: '🚀 CORE WORKFLOW',
    icon: '🚀',
    description: 'Essential workflow commands available in both Core and Full Build',
    commands: ['task', 'sync', 'validate', 'checklist', 'help'],
    package: 'both'
  },
  {
    id: 'patterns',
    name: '📚 PATTERNS',
    icon: '📚',
    description: 'Pattern management (v3.1.0)',
    commands: ['pattern', 'rule'],
    package: 'both'
  },
  {
    id: 'utilities',
    name: '🛠️ UTILITIES',
    icon: '🛠️',
    description: 'Utility commands',
    commands: ['init', 'upgrade', 'migrate', 'generate', 'review', 'shell', 'dashboard'],
    package: 'both'
  }
];

/**
 * Command help data for Core Build
 * Priority: Higher number = more common (1-10 scale)
 */
export const COMMAND_HELPS: CommandHelp[] = [
  // CORE WORKFLOW commands
  {
    name: 'task',
    description: 'Manage workflow tasks',
    usage: 'npx ai-workflow task <subcommand> [options]',
    options: [
      { name: '--satisfies <req...>', description: 'Link to requirements (FR-001, NFR-002)' },
      { name: '--force', description: 'Force action (create new task if one exists)' }
    ],
    examples: [
      'npx ai-workflow task create "Implement user authentication"',
      'npx ai-workflow task create "Fix login bug" --satisfies FR-042',
      'npx ai-workflow task status',
      'npx ai-workflow task complete'
    ],
    workflow: [
      '1. Create task: npx ai-workflow task create "<goal>"',
      '2. Work on your code',
      '3. Sync state: npx ai-workflow sync',
      '4. Validate: npx ai-workflow validate',
      '5. Complete: npx ai-workflow task complete'
    ],
    tips: [
      'Tasks are automatically created from commits if missing!',
      'Use --satisfies to link requirements to tasks'
    ],
    related: ['sync', 'validate'],
    category: 'core-workflow',
    priority: 10, // Highest priority - most common command
    package: 'both'
  },
  {
    name: 'sync',
    description: 'Auto-sync workflow state and update context files',
    usage: 'npx ai-workflow sync [options]',
    examples: [
      'npx ai-workflow sync',
      'npx ai-workflow sync --state IMPLEMENTING'
    ],
    workflow: [
      '1. Work on your code',
      '2. Sync: npx ai-workflow sync',
      '3. Context files updated automatically'
    ],
    tips: [
      'Run sync after making significant changes',
      'Run sync before validating or committing'
    ],
    related: ['task', 'validate'],
    category: 'core-workflow',
    priority: 9,
    package: 'both'
  },
  {
    name: 'validate',
    description: 'Run all quality gates and validate workflow state',
    usage: 'npx ai-workflow validate [options]',
    options: [
      { name: '--json', description: 'Output in JSON format' }
    ],
    examples: [
      'npx ai-workflow validate',
      'npx ai-workflow validate --json'
    ],
    workflow: [
      '1. Complete implementation',
      '2. Run tests',
      '3. Validate: npx ai-workflow validate',
      '4. Fix any issues',
      '5. Ready to commit'
    ],
    tips: [
      'Run validate before every commit',
      'Use --json for automated checking'
    ],
    related: ['task', 'sync'],
    category: 'core-workflow',
    priority: 9,
    package: 'both'
  },
  {
    name: 'checklist',
    description: 'Manage state checklists',
    // @requirement REQ-V2-003 - Help system (checklist command added to help data)
    usage: 'npx ai-workflow checklist <subcommand> [options]',
    options: [
      { name: '--state <state>', description: 'State for checklist (default: current state)' },
      { name: '--evidence <type>', description: 'Evidence type: file_created, file_modified, command_run, test_passed, validation_passed, manual, other' },
      { name: '--files <files>', description: 'Comma-separated file paths (for file_created/file_modified)' },
      { name: '--description <text>', description: 'Evidence description (required for most evidence types)' },
      { name: '--command <command>', description: 'Command that was run (for command_run evidence)' },
      { name: '--output <output>', description: 'Command output (for command_run evidence)' },
      { name: '--manual-notes <notes>', description: 'Manual notes (for manual evidence)' }
    ],
    examples: [
      'npx ai-workflow checklist status',
      'npx ai-workflow checklist status --state TESTING',
      'npx ai-workflow checklist check understand-requirements --evidence manual --description "Discussed requirements with user"',
      'npx ai-workflow checklist check write-code --evidence file_created --files "src/auth.ts,src/auth.test.ts" --description "Created authentication module"',
      'npx ai-workflow checklist check run-tests --state TESTING --evidence test_passed --description "All tests passing"',
      'npx ai-workflow checklist check validate-code --evidence validation_passed --description "Validation passed"'
    ],
    workflow: [
      '1. View checklist: npx ai-workflow checklist status',
      '2. Complete items: npx ai-workflow checklist check <item-id> --evidence <type>',
      '3. Evidence is required for all checklist items',
      '4. Checklist helps track workflow state requirements'
    ],
    tips: [
      'Use checklist status to see what needs to be done',
      'Evidence is mandatory - provide --evidence and --description',
      'Checklist items are state-specific and pattern-based',
      'Use --state to view checklist for different states'
    ],
    related: ['task', 'sync', 'review'],
    category: 'core-workflow',
    priority: 7,
    package: 'both'
  },
  {
    name: 'help',
    description: 'Show help for commands',
    usage: 'npx ai-workflow help [command] [options]',
    options: [
      { name: '--all', description: 'Show all commands (not just top ones)' },
      { name: '--json', description: 'Output in JSON format' }
    ],
    examples: [
      'npx ai-workflow help',
      'npx ai-workflow help task',
      'npx ai-workflow help --all',
      'npx ai-workflow help --json'
    ],
    tips: [
      'Use --all to see all commands',
      'Use help <command> for command-specific help'
    ],
    related: [],
    category: 'core-workflow',
    priority: 8,
    package: 'both'
  },
  // PATTERNS commands
  {
    name: 'pattern',
    description: 'Manage patterns (rules and best practices)',
    usage: 'npx ai-workflow pattern <subcommand> [options]',
    examples: [
      'npx ai-workflow pattern list',
      'npx ai-workflow pattern add "<pattern>"',
      'npx ai-workflow pattern check'
    ],
    tips: [
      'Patterns are learned rules and best practices',
      'Use pattern list to see all patterns'
    ],
    related: ['rule'],
    category: 'patterns',
    priority: 7,
    package: 'both'
  },
  {
    name: 'rule',
    description: 'Legacy pattern commands (deprecated, use pattern instead)',
    usage: 'npx ai-workflow rule <subcommand> [options]',
    examples: [
      'npx ai-workflow rule list',
      'npx ai-workflow rule add "<rule>"'
    ],
    tips: [
      '⚠️ This command is deprecated',
      'Use "pattern" command instead'
    ],
    related: ['pattern'],
    category: 'patterns',
    priority: 3, // Lower priority - deprecated
    package: 'both'
  },
  // UTILITIES commands
  {
    name: 'init',
    description: 'Initialize new project with ai-workflow',
    usage: 'npx ai-workflow init [options]',
    options: [
      { name: '--minimal', description: 'Minimal setup (no examples)' },
      { name: '--skip-hooks', description: "Don't install git hooks" },
      { name: '--force', description: 'Force initialization even if already initialized' }
    ],
    examples: [
      'npx ai-workflow init',
      'npx ai-workflow init --minimal',
      'npx ai-workflow init --skip-hooks'
    ],
    workflow: [
      '1. Run: npx ai-workflow init',
      '2. Follow prompts',
      '3. Start using workflow commands'
    ],
    tips: [
      'Run init in your project root',
      'Use --minimal for simpler setup'
    ],
    related: ['task'],
    category: 'utilities',
    priority: 8,
    package: 'both'
  },
  {
    name: 'upgrade',
    description: 'Upgrade ai-workflow-engine to latest version',
    usage: 'npx ai-workflow upgrade [options]',
    examples: [
      'npx ai-workflow upgrade',
      'npx ai-workflow upgrade --check'
    ],
    tips: [
      'Upgrade regularly for latest features',
      'Check changelog after upgrade'
    ],
    related: [],
    category: 'utilities',
    priority: 5,
    package: 'both'
  },
  {
    name: 'generate',
    description: 'Generate files from templates',
    usage: 'npx ai-workflow generate <type> [options]',
    examples: [
      'npx ai-workflow generate test-plan',
      'npx ai-workflow generate requirement'
    ],
    related: [],
    category: 'utilities',
    priority: 4,
    package: 'both'
  },
  {
    name: 'review',
    description: 'Review checklist and validation',
    usage: 'npx ai-workflow review [options]',
    examples: [
      'npx ai-workflow review',
      'npx ai-workflow review check'
    ],
    related: ['validate'],
    category: 'utilities',
    priority: 6,
    package: 'both'
  },
  {
    name: 'migrate',
    description: 'Migrate to new version',
    usage: 'npx ai-workflow migrate [options]',
    examples: [
      'npx ai-workflow migrate',
      'npx ai-workflow migrate --from v1.3 --to v1.4'
    ],
    related: ['upgrade'],
    category: 'utilities',
    priority: 4,
    package: 'both'
  },
  {
    name: 'shell',
    description: 'Open shell in workflow context',
    usage: 'npx ai-workflow shell',
    examples: [
      'npx ai-workflow shell'
    ],
    tips: [
      'Use shell to access workflow context in terminal'
    ],
    related: [],
    category: 'utilities',
    priority: 3,
    package: 'both'
  },
  {
    name: 'dashboard',
    description: 'Show workflow dashboard',
    usage: 'npx ai-workflow dashboard [options]',
    examples: [
      'npx ai-workflow dashboard',
      'npx ai-workflow dashboard --json'
    ],
    related: ['task', 'validate'],
    category: 'utilities',
    priority: 5,
    package: 'both'
  }
];

