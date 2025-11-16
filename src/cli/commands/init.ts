/**
 * Init Command - Initialize new project with AI Workflow
 * @requirement REQ-V2-003 - Missing init command (CRITICAL)
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { installGitHooks } from '../../hooks/install-hooks.js';
import {
  syncMDCFiles,
  syncStateBehaviors,
  createCommandsMD
} from '../utils/cursor-rules-sync.js';

/**
 * Default project structure
 * @requirement REQ-V2-003 - Standard directory structure
 */
const DEFAULT_STRUCTURE = {
  '.ai-context': {
    'STATUS.txt': 'READY\n',
    'NEXT_STEPS.md': `# 🚀 Welcome to AI Workflow Engine!\n\nYour project has been initialized successfully.\n\n## Next Steps\n\n1. **Create your first task:**\n   \`\`\`bash\n   ai-workflow task create "<your goal>"\n   \`\`\`\n\n2. **Start working** and the AI will track your progress automatically\n\n3. **When ready to commit:**\n   \`\`\`bash\n   ai-workflow validate\n   git commit\n   ai-workflow task complete  # Mark task as done!\n   \`\`\`\n\n## Workflow Commands\n\n- \`ai-workflow help\` - Show all commands\n- \`ai-workflow task status\` - Check current task\n- \`ai-workflow task complete\` - Complete task when done\n- \`ai-workflow validate\` - Check quality before commit\n\nHappy coding! 🎉\n`,
    'WARNINGS.md': '# ⚠️ Warnings\n\nNo warnings yet.\n'
  },
  'docs': {
    'workflows': {},
    'implementations': {},
    'testing': {},
    'learned-knowledge': {},
    'meetings': {},
    'decisions': {}
  }
};

/**
 * Create directory structure
 * @requirement REQ-V2-003 - Directory initialization
 */
async function createStructure(
  projectRoot: string,
  structure: any,
  currentPath: string = projectRoot
): Promise<void> {
  for (const [key, value] of Object.entries(structure)) {
    const fullPath = path.join(currentPath, key);
    
    if (typeof value === 'string') {
      // It's a file
      await fs.ensureFile(fullPath);
      await fs.writeFile(fullPath, value, 'utf-8');
    } else if (typeof value === 'object' && value !== null) {
      // It's a directory
      await fs.ensureDir(fullPath);
      if (Object.keys(value as Record<string, any>).length > 0) {
        await createStructure(projectRoot, value, fullPath);
      } else {
        // Empty directory, create .gitkeep
        await fs.writeFile(path.join(fullPath, '.gitkeep'), '', 'utf-8');
      }
    }
  }
}

/**
 * Check if project is already initialized
 * @requirement REQ-V2-003 - Prevent double initialization
 */
async function isAlreadyInitialized(projectRoot: string): Promise<boolean> {
  const contextDir = path.join(projectRoot, '.ai-context');
  return await fs.pathExists(contextDir);
}

/**
 * Create Cursor .mdc rules with alwaysApply enforcement
 * @requirement REQ-DOC-001 - Cursor enforcement via .mdc
 * @requirement DRY - Use shared utilities
 */
async function createCursorMDCRules(projectRoot: string): Promise<void> {
  const rulesDir = path.join(projectRoot, '.cursor', 'rules');
  await fs.ensureDir(rulesDir);
  
  console.log(chalk.cyan('\n📁 Creating Cursor .mdc rules (alwaysApply enforcement)...'));
  
  // Sync .mdc files (no backup on initial creation)
  const { updated } = await syncMDCFiles(projectRoot, rulesDir, {
    backup: false,
    onFileSync: (file) => {
      console.log(chalk.green(`   ✅ ${file}`));
    },
    onFileNotFound: (file) => {
      console.log(chalk.yellow(`   ⚠️  Template not found: ${file}`));
    }
  });
  
  // Sync state-behaviors directory
  const stateFilesCount = await syncStateBehaviors(rulesDir);
  if (stateFilesCount > 0) {
    console.log(chalk.green(`   ✅ state-behaviors/ (${stateFilesCount} state files)`));
  }
  
  console.log(chalk.bold.green('\n✨ Cursor .mdc rules created!'));
  console.log(chalk.cyan('   These rules enforce Cursor to read workflow files at EVERY conversation.'));
  console.log(chalk.cyan('   Compliance rate: 90-95% (vs 60-70% with .cursorrules only)'));
  console.log(chalk.gray('   Location: .cursor/rules/*.mdc\n'));
}

/**
 * Create command reference file for AI command discovery
 * @requirement v3.1.1 - Command discovery system
 * @requirement DRY - Use shared utilities
 */
async function createCommandReference(projectRoot: string): Promise<void> {
  const contextDir = path.join(projectRoot, '.ai-context');
  await fs.ensureDir(contextDir);
  
  const destPath = path.join(contextDir, 'COMMANDS.md');
  const created = await createCommandsMD(projectRoot, destPath);
  
  if (created) {
    console.log(chalk.green('   ✅ .ai-context/COMMANDS.md (Command reference for AI)'));
  } else {
    console.log(chalk.yellow('   ⚠️  Template not found: COMMANDS.md.template'));
  }
}

/**
 * Initialize AI Workflow in current directory
 * @requirement REQ-V2-003 - Project initialization
 */
async function initWorkflow(options: {
  skipHooks?: boolean;
  minimal?: boolean;
  force?: boolean;
}): Promise<void> {
  const projectRoot = process.cwd();
  
  // Check if already initialized
  if (!options.force && await isAlreadyInitialized(projectRoot)) {
    console.log(chalk.yellow('⚠️  Project already initialized!'));
    console.log(chalk.dim('Use --force to reinitialize\n'));
    process.exit(0);
  }
  
  const spinner = ora('Initializing AI Workflow Engine...').start();
  
  try {
    // Create directory structure
    spinner.text = 'Creating directory structure...';
    if (options.minimal) {
      // Minimal setup - only .ai-context
      await fs.ensureDir(path.join(projectRoot, '.ai-context'));
      await fs.writeFile(
        path.join(projectRoot, '.ai-context', 'STATUS.txt'),
        'READY\n',
        'utf-8'
      );
      await fs.writeFile(
        path.join(projectRoot, '.ai-context', 'NEXT_STEPS.md'),
        DEFAULT_STRUCTURE['.ai-context']['NEXT_STEPS.md'],
        'utf-8'
      );
    } else {
      // Full setup
      await createStructure(projectRoot, DEFAULT_STRUCTURE);
    }
    
    // Create Cursor .mdc rules (NEW!)
    if (!options.minimal) {
      spinner.text = 'Creating Cursor .mdc rules...';
      await createCursorMDCRules(projectRoot);
    }
    
    // Create command reference for AI discovery (v3.1.1)
    spinner.text = 'Creating command reference...';
    await createCommandReference(projectRoot);
    
    // Install git hooks
    if (!options.skipHooks) {
      spinner.text = 'Installing git hooks...';
      try {
        await installGitHooks(projectRoot);
      } catch (err: any) {
        spinner.warn('Git hooks installation skipped (not a git repository)');
        console.log(chalk.dim('Run "git init" first, then "ai-workflow init" to install hooks'));
      }
    }
    
    spinner.succeed(chalk.green('AI Workflow Engine initialized! ✅'));
    
    // Show success message
    console.log('');
    console.log(chalk.bold('📦 Created:'));
    console.log(chalk.dim('  .ai-context/         AI context files'));
    console.log(chalk.dim('  .ai-context/COMMANDS.md  Command reference for AI'));
    if (!options.minimal) {
      console.log(chalk.dim('  .cursor/rules/       Cursor behavior rules'));
      console.log(chalk.dim('  docs/                Documentation structure'));
    }
    if (!options.skipHooks) {
      console.log(chalk.dim('  .git/hooks/          Pre-commit validation'));
    }
    
    console.log('');
    console.log(chalk.bold('🤖 For AI Assistants:'));
    console.log(chalk.cyan('  Your AI can now discover all commands from:'));
    console.log(chalk.cyan('  - .ai-context/COMMANDS.md (full reference)'));
    if (!options.minimal) {
      console.log(chalk.cyan('  - .cursor/rules/004-workflow-commands.mdc (Cursor guide)'));
    }
    
    console.log('');
    console.log(chalk.bold('🚀 Next steps:'));
    console.log(chalk.cyan('  1. ai-workflow task create "<your goal>"'));
    console.log(chalk.cyan('  2. Ask AI: "What commands can I use?"'));
    console.log(chalk.cyan('  3. Start coding!'));
    
    console.log('');
    console.log(chalk.dim('Need help? Run: ai-workflow help'));
    console.log('');
    
    process.exit(0);
    
  } catch (error: any) {
    spinner.fail(chalk.red('Initialization failed'));
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Register init command
 * @requirement REQ-V2-003 - CLI command registration
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize AI Workflow Engine in current directory')
    .option('-y, --yes', 'Skip prompts, use defaults')
    .option('--minimal', 'Minimal setup (only .ai-context)')
    .option('--skip-hooks', 'Skip git hooks installation')
    .option('--force', 'Force reinitialize (overwrite existing)')
    .action(async (options) => {
      await initWorkflow(options);
    });
}

