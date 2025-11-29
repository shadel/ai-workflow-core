/**
 * Migrate Command
 * Updates workflow files to new format
 * @requirement REQ-MDC-OPTIMIZATION-001
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { handleCliError } from '../utils/error-handler.js';
import { getTemplatesDir } from '../utils/cursor-rules-sync.js';

export function registerMigrateCommand(program: Command): void {
  const migrate = program
    .command('migrate')
    .description('Migrate workflow files to new format')
    .option('--update-mdc-files', 'Update .mdc files from templates')
    .action(async (options: { updateMdcFiles?: boolean }) => {
      try {
        if (options.updateMdcFiles) {
          await updateMdcFilesFromTemplates(); // Uses process.cwd() by default
        } else {
          console.log(chalk.yellow('No migration option specified. Use --update-mdc-files'));
          console.log('');
          console.log('Available options:');
          console.log('  --update-mdc-files    Update .mdc files from templates');
          console.log('');
          process.exit(0);
        }
      } catch (error) {
        handleCliError(error, {
          command: 'migrate',
          operation: 'update-mdc-files',
          suggestions: [
            'Check if templates directory exists',
            'Check if .cursor/rules/ directory exists',
            'Verify file permissions'
          ]
        });
      }
    });
}

/**
 * Update .mdc files from templates
 * Exported for testing purposes
 * @param projectRoot - Optional project root directory (defaults to process.cwd())
 */
export async function updateMdcFilesFromTemplates(projectRoot?: string): Promise<void> {
  const root = projectRoot || process.cwd();
  // Uses shared utility for path resolution (works in dev and npm)
  const templatesDir = getTemplatesDir();
  const rulesDir = path.join(root, '.cursor/rules');
  
  // Check if templates directory exists
  if (!await fs.pathExists(templatesDir)) {
    throw new Error(`Templates directory not found: ${templatesDir}`);
  }
  
  // Ensure .cursor/rules/ exists
  await fs.ensureDir(rulesDir);
  
  // Create backup
  const timestamp = Date.now();
  const backupDir = path.join(rulesDir, `.backup-${timestamp}`);
  await fs.ensureDir(backupDir);
  
  console.log(chalk.cyan('📦 Creating backup...'));
  
  // Copy existing files to backup
  const existingFiles = await fs.readdir(rulesDir);
  let backedUp = 0;
  for (const file of existingFiles) {
    if (file.endsWith('.mdc') && !file.startsWith('.backup-')) {
      await fs.copy(
        path.join(rulesDir, file),
        path.join(backupDir, file)
      );
      backedUp++;
    }
  }
  
  console.log(chalk.green(`✅ Backed up ${backedUp} file(s) to ${backupDir}`));
  console.log('');
  
  // Copy templates to .cursor/rules/
  const templates = await fs.readdir(templatesDir);
  let updated = 0;
  
  console.log(chalk.cyan('🔄 Updating .mdc files from templates...'));
  
  for (const template of templates) {
    if (template.endsWith('.mdc') && !template.startsWith('.')) {
      await fs.copy(
        path.join(templatesDir, template),
        path.join(rulesDir, template)
      );
      console.log(chalk.green(`  ✅ Updated: ${template}`));
      updated++;
    }
  }
  
  console.log('');
  console.log(chalk.green(`✅ Migration complete!`));
  console.log(chalk.gray(`   Updated: ${updated} file(s)`));
  console.log(chalk.gray(`   Backup: ${backupDir}`));
  console.log('');
  console.log(chalk.cyan('📢 FOR AI ASSISTANTS (Cursor/Copilot):'));
  console.log(chalk.cyan('   .mdc files have been updated!'));
  console.log(chalk.cyan('   Please reload .cursor/rules/*.mdc files'));
  console.log('');
}
