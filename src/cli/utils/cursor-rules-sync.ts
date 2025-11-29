/**
 * Cursor Rules Sync Utilities
 * Shared functions for syncing Cursor .mdc rules and COMMANDS.md
 * @requirement DRY - Don't Repeat Yourself pattern
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

/**
 * List of .mdc files to sync
 * @requirement v3.0+ - Consolidated structure (3 files)
 * Updated: Nov 29, 2025 - Complete consolidation from 5 files to 3 files
 */
export const MDC_FILES = [
  '000-workflow-core.mdc',      // Consolidated: 000-current-state-enforcement + 001-workflow-core + 004-workflow-commands
  '001-state-behaviors.mdc',    // Extracted: from 000-current-state-enforcement
  '002-quality-gates.mdc'       // Consolidated: 002-workflow-states + 003-workflow-validation
] as const;

/**
 * Get templates directory path
 * @returns Path to templates/cursor-rules directory
 */
export function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '../../../templates/cursor-rules');
}

/**
 * Get COMMANDS.md template path
 * @returns Path to COMMANDS.md.template
 */
export function getCommandsTemplatePath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '../../../templates/COMMANDS.md.template');
}

/**
 * Replace {{DATE}} placeholder in template content
 * @param content Template content
 * @returns Content with {{DATE}} replaced
 */
export function replaceDatePlaceholder(content: string): string {
  const currentDate = new Date().toISOString().split('T')[0];
  return content.replace(/\{\{DATE\}\}/g, currentDate);
}

/**
 * Sync .mdc files from templates to user's .cursor/rules directory
 * @param projectRoot Project root directory
 * @param userRulesDir User's .cursor/rules directory
 * @param options Options for syncing
 * @returns Summary of sync operation
 */
export async function syncMDCFiles(
  projectRoot: string,
  userRulesDir: string,
  options: {
    backup?: boolean;
    onFileSync?: (file: string) => void;
    onFileBackup?: (file: string) => void;
    onFileNotFound?: (file: string) => void;
  } = {}
): Promise<{ updated: number; backedUp: number }> {
  const templatesDir = getTemplatesDir();
  let updated = 0;
  let backedUp = 0;

  for (const file of MDC_FILES) {
    const templatePath = path.join(templatesDir, file);
    const userPath = path.join(userRulesDir, file);

    if (!await fs.pathExists(templatePath)) {
      // Improved error message with helpful suggestions
      if (options.onFileNotFound) {
        options.onFileNotFound(file);
      } else {
        // Log warning if no callback provided
        console.warn(
          chalk.yellow(`⚠️  Template not found: ${file}`),
          chalk.gray(`\n   Expected: ${templatePath}`),
          chalk.gray(`\n   Templates directory: ${templatesDir}`),
          chalk.gray(`\n   Suggestion: Check if file exists in package templates directory`),
          chalk.gray(`\n   Run: npm run validate-templates to verify template files`)
        );
      }
      continue;
    }

    // Backup user's current file if exists and backup enabled
    if (options.backup && await fs.pathExists(userPath)) {
      const backupPath = `${userPath}.backup-${Date.now()}`;
      await fs.copy(userPath, backupPath);
      backedUp++;
      if (options.onFileBackup) {
        options.onFileBackup(file);
      }
    }

    // Ensure directory exists before writing
    await fs.ensureDir(path.dirname(userPath));

    // Read template and replace {{DATE}} placeholder
    let content = await fs.readFile(templatePath, 'utf-8');
    content = replaceDatePlaceholder(content);

    // Write to destination
    await fs.writeFile(userPath, content, 'utf-8');
    updated++;
    if (options.onFileSync) {
      options.onFileSync(file);
    }
  }

  return { updated, backedUp };
}

/**
 * Sync state-behaviors directory from templates
 * @param userRulesDir User's .cursor/rules directory
 * @returns Number of state files synced
 */
export async function syncStateBehaviors(userRulesDir: string): Promise<number> {
  const templatesDir = getTemplatesDir();
  const stateBehaviorsTemplate = path.join(templatesDir, 'state-behaviors');
  const stateBehaviorsDest = path.join(userRulesDir, 'state-behaviors');

  if (await fs.pathExists(stateBehaviorsTemplate)) {
    await fs.copy(stateBehaviorsTemplate, stateBehaviorsDest);
    const stateFiles = await fs.readdir(stateBehaviorsDest);
    return stateFiles.length;
  }

  return 0;
}

/**
 * Create COMMANDS.md from template
 * @param projectRoot Project root directory
 * @param destPath Destination path for COMMANDS.md
 * @returns true if created, false if template not found
 */
export async function createCommandsMD(
  projectRoot: string,
  destPath: string
): Promise<boolean> {
  const templatePath = getCommandsTemplatePath();

  if (!await fs.pathExists(templatePath)) {
    return false;
  }

  // Ensure destination directory exists
  await fs.ensureDir(path.dirname(destPath));

  // Read template and replace {{DATE}} placeholder
  let content = await fs.readFile(templatePath, 'utf-8');
  content = replaceDatePlaceholder(content);

  // Write to destination
  await fs.writeFile(destPath, content, 'utf-8');

  return true;
}

