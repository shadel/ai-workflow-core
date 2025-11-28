/**
 * Upgrade CLI Command for Core Build
 * Check for updates and guide upgrade process
 * @requirement REQ-V2-003 - Upgrade command
 * @requirement v2.1.4-hotfix - Sync Cursor .mdc rules
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { getPackageInfo } from '../utils/package-info.js';
import { fetchLatestVersion } from '../utils/npm-registry.js';
import { compareVersions } from '../utils/version-compare.js';
import {
  syncMDCFiles,
  syncStateBehaviors,
  createCommandsMD
} from '../utils/cursor-rules-sync.js';

/**
 * Sync Cursor .mdc rules from package templates
 * @requirement v2.1.4-hotfix - MDC sync mechanism for existing users
 * @requirement DRY - Use shared utilities
 */
async function syncCursorRules(projectRoot: string): Promise<void> {
  const spinner = ora('Syncing Cursor .mdc rules...').start();
  
  try {
    const userRulesDir = path.join(projectRoot, '.cursor', 'rules');
    
    // Check if .cursor/rules exists
    if (!await fs.pathExists(userRulesDir)) {
      spinner.fail('No .cursor/rules directory found');
      console.log('');
      console.log(chalk.yellow('⚠️  Cursor rules not installed'));
      console.log(chalk.gray('Run "npx ai-workflow init" first to install\n'));
      process.exit(1);
    }
    
    spinner.text = 'Backing up current rules...';
    
    // Sync .mdc files with backup enabled
    const { updated, backedUp } = await syncMDCFiles(projectRoot, userRulesDir, {
      backup: true,
      onFileNotFound: (file) => {
        console.log(chalk.yellow(`   ⚠️  Template not found: ${file}`));
      }
    });
    
    // Sync state-behaviors directory
    spinner.text = 'Syncing state-behaviors directory...';
    const stateFilesCount = await syncStateBehaviors(userRulesDir);
    if (stateFilesCount > 0) {
      console.log(chalk.green(`   ✅ state-behaviors/ (${stateFilesCount} state files)`));
    }
    
    // Create COMMANDS.md from template
    spinner.text = 'Creating COMMANDS.md...';
    const contextDir = path.join(projectRoot, '.ai-context');
    await fs.ensureDir(contextDir);
    const commandsDestPath = path.join(contextDir, 'COMMANDS.md');
    const commandsCreated = await createCommandsMD(projectRoot, commandsDestPath);
    if (commandsCreated) {
      console.log(chalk.green(`   ✅ .ai-context/COMMANDS.md`));
    }
    
    spinner.succeed('Cursor .mdc rules synced!');
    
    console.log('');
    console.log(chalk.bold('📊 Sync Summary:'));
    console.log(chalk.green(`  ✅ Updated: ${updated} .mdc files`));
    if (backedUp > 0) {
      console.log(chalk.gray(`  📋 Backed up: ${backedUp} files`));
    }
    console.log(chalk.green(`  ✅ Synced: state-behaviors/ directory`));
    console.log(chalk.green(`  ✅ Created: .ai-context/COMMANDS.md`));
    console.log('');
    console.log(chalk.yellow('⚠️  IMPORTANT: Restart Cursor to apply new rules'));
    console.log('');
    console.log(chalk.bold('🆕 What\'s new in v3.1.3:'));
    console.log(chalk.cyan('  • All .mdc files synced (including 000 and 004)'));
    console.log(chalk.cyan('  • state-behaviors/ directory synced'));
    console.log(chalk.cyan('  • COMMANDS.md created in .ai-context/ for command discovery'));
    console.log('');
    console.log(chalk.gray(`Location: ${userRulesDir}\n`));
    
    process.exit(0);
    
  } catch (error: any) {
    spinner.fail('Failed to sync rules');
    console.error(chalk.red('\n❌ Error:'), error.message);
    console.log('');
    process.exit(1);
  }
}

/**
 * Register upgrade command
 * @requirement REQ-V2-003 - CLI upgrade command
 * @requirement v2.1.4-hotfix - Add --sync-rules option
 * @requirement FIX-UPGRADE-COMMAND - Fix hardcoded version, add npm check
 */
export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description(`Check for updates and upgrade workflow engine

This command checks npm registry for the latest version and compares
with your current installation. Use --check-only for programmatic checks.

OPTIONS:
  --check-only    Output JSON with version comparison (exit code 0=current, 1=outdated)
  --sync-rules    Sync Cursor .mdc rules to latest version

EXAMPLES:
  npx ai-workflow upgrade              # Check and show upgrade instructions
  npx ai-workflow upgrade --check-only # Programmatic check (JSON output)
  npx ai-workflow upgrade --sync-rules # Update Cursor rules only`)
    .option('--check-only', 'Output JSON with version comparison')
    .option('--sync-rules', 'Sync Cursor .mdc rules from package templates')
    .action(async (options: { checkOnly?: boolean; syncRules?: boolean }) => {
      try {
        // If --sync-rules, sync Cursor rules and exit
        if (options.syncRules) {
          const projectRoot = process.cwd();
          await syncCursorRules(projectRoot);
          return;
        }
        
        // Get current package info (FIX: No longer hardcoded)
        const packageInfo = getPackageInfo();
        
        // If --check-only, output JSON and exit
        if (options.checkOnly) {
          const registryInfo = await fetchLatestVersion(packageInfo.name);
          const comparison = registryInfo.latestVersion 
            ? compareVersions(packageInfo.version, registryInfo.latestVersion)
            : 'unknown';
          
          console.log(JSON.stringify({
            current: packageInfo.version,
            latest: registryInfo.latestVersion,
            status: comparison,
            package: packageInfo.name
          }, null, 2));
          
          // Exit code: 0 if current, 1 if outdated or unknown
          process.exit(comparison === 'current' ? 0 : 1);
          return;
        }
        
        // Normal upgrade check flow
        console.log(chalk.bold.blue('\n🔄 AI Workflow Engine - Upgrade Check\n'));
        
        // FIX Bug #1 & #2: Display correct version and package name
        console.log(chalk.bold('Current Version:'));
        console.log(`  ${packageInfo.name}: ${chalk.cyan(packageInfo.version)}`);
        console.log('');
        
        // FIX Bug #3: Actually check npm registry
        console.log(chalk.bold('Checking for updates...'));
        const spinner = ora('Fetching latest version from npm...').start();
        
        const registryInfo = await fetchLatestVersion(packageInfo.name);
        
        if (!registryInfo.latestVersion) {
          spinner.warn('Could not fetch latest version (offline or npm error)');
          console.log('');
          console.log(chalk.yellow('⚠️  Unable to check for updates. Showing manual upgrade instructions:\n'));
          
          // Fallback to manual instructions
          console.log(chalk.yellow('💡 To upgrade:'));
          console.log('');
          console.log(chalk.gray('  # If installed from git:'));
          console.log('  cd path/to/ai-workflow-engine');
          console.log('  git pull origin master');
          console.log('  npm install -g .');
          console.log('');
          console.log(chalk.gray('  # If installed from npm:'));
          console.log(`  npm install -g ${packageInfo.name}@latest`);
          console.log('');
          console.log(chalk.gray('  # Check version:'));
          console.log('  ai-workflow --version');
          console.log('');
        } else {
          spinner.succeed(`Latest version: ${registryInfo.latestVersion}`);
          console.log('');
          
          const comparison = compareVersions(packageInfo.version, registryInfo.latestVersion);
          
          if (comparison === 'current') {
            console.log(chalk.green('✅ You are using the latest version!'));
            console.log('');
            console.log(chalk.gray('💡 To sync Cursor rules to latest:'));
            console.log('  npx ai-workflow upgrade --sync-rules');
            console.log('');
          } else if (comparison === 'outdated') {
            console.log(chalk.yellow(`⚠️  Update available: ${packageInfo.version} → ${registryInfo.latestVersion}`));
            if (registryInfo.publishDate) {
              const publishDate = new Date(registryInfo.publishDate);
              console.log(chalk.gray(`  Published: ${publishDate.toLocaleDateString()}`));
            }
            console.log('');
            console.log(chalk.bold('To upgrade:'));
            console.log(`  npm install -g ${packageInfo.name}@latest`);
            console.log('');
            console.log(chalk.gray('After upgrading, sync Cursor rules:'));
            console.log('  npx ai-workflow upgrade --sync-rules');
            console.log('');
          } else {
            // comparison === 'ahead'
            console.log(chalk.cyan(`ℹ️  You are ahead of latest stable (${registryInfo.latestVersion})`));
            console.log(chalk.gray('  You may be using a development version'));
            console.log('');
          }
        }
        
        console.log(chalk.bold('Release Notes:'));
        console.log('  https://github.com/shadel/ai-workflow-engine/releases');
        console.log('');
        
        process.exit(0);

      } catch (error) {
        console.error(chalk.red('❌ Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

