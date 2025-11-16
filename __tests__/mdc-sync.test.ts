/**
 * MDC Sync Tests
 * v2.1.4-hotfix - Test --sync-rules functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MDC Rules Sync', () => {
  const testProjectDir = '.test-mdc-sync';
  const rulesDir = `${testProjectDir}/.cursor/rules`;
  // Use direct path to local CLI to avoid npx resolution issues in CI
  // __dirname is __tests__ directory, so go up one level to packages/workflow-core
  const cliPath = path.resolve(__dirname, '..', 'bin', 'cli.js');

  beforeEach(async () => {
    await fs.remove(testProjectDir);
    await fs.ensureDir(testProjectDir);
  });

  afterEach(async () => {
    await fs.remove(testProjectDir);
  });

  function runCLI(command: string): { exitCode: number; output: string } {
    try {
      const output = execSync(command, { 
        encoding: 'utf-8', 
        stdio: 'pipe',
        timeout: 20000, // 20 second timeout for CLI execution
        cwd: process.cwd()
      });
      return { exitCode: 0, output };
    } catch (error: any) {
      return {
        exitCode: error.status || 1,
        output: error.stdout || error.stderr || error.message
      };
    }
  }

  it('should fail when .cursor/rules does not exist', () => {
    const result = runCLI(`cd ${testProjectDir} && node ${cliPath} upgrade --sync-rules`);
    
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not installed');
  }, 10000); // 10 second timeout

  it('should sync .mdc files from templates', async () => {
    // Create .cursor/rules directory
    await fs.ensureDir(rulesDir);
    
    const result = runCLI(`cd ${testProjectDir} && node ${cliPath} upgrade --sync-rules`);
    
    expect(result.exitCode).toBe(0);
    
    // Check files were created
    expect(await fs.pathExists(`${rulesDir}/001-workflow-core.mdc`)).toBe(true);
    expect(await fs.pathExists(`${rulesDir}/002-workflow-states.mdc`)).toBe(true);
    expect(await fs.pathExists(`${rulesDir}/003-workflow-validation.mdc`)).toBe(true);
  }, 30000); // 30 second timeout for file operations

  it('should backup existing .mdc files', async () => {
    await fs.ensureDir(rulesDir);
    
    // Create old version of file
    const oldContent = 'old version content';
    await fs.writeFile(`${rulesDir}/003-workflow-validation.mdc`, oldContent);
    
    const result = runCLI(`cd ${testProjectDir} && node ${cliPath} upgrade --sync-rules`);
    
    expect(result.exitCode).toBe(0);
    
    // Check backup was created
    const backups = await fs.readdir(rulesDir);
    const backupFiles = backups.filter(f => f.includes('.backup-'));
    
    expect(backupFiles.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for file operations

  it('should update version in synced files', async () => {
    await fs.ensureDir(rulesDir);
    
    const result = runCLI(`cd ${testProjectDir} && node ${cliPath} upgrade --sync-rules`);
    
    expect(result.exitCode).toBe(0);
    
    // Check version in synced file
    const content = await fs.readFile(`${rulesDir}/003-workflow-validation.mdc`, 'utf-8');
    expect(content).toContain('version: 2.1.4');
    expect(content).toContain('ERROR HANDLING');
  }, 30000); // 30 second timeout for file operations

  it('should show sync summary', async () => {
    await fs.ensureDir(rulesDir);
    
    const result = runCLI(`cd ${testProjectDir} && node ${cliPath} upgrade --sync-rules`);
    
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Sync Summary');
    // v3.1.3: Now syncs 5 .mdc files (including 000 and 004)
    expect(result.output).toMatch(/Updated: \d+ .mdc files/);
  }, 30000); // 30 second timeout for file operations
});

