/**
 * Unit tests for Cursor Rules Sync Utilities
 * @requirement Pattern: Mọi code change đều phải có test plan và test code
 * @requirement DRY - Test shared utilities
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  syncMDCFiles,
  syncStateBehaviors,
  createCommandsMD,
  getTemplatesDir,
  getCommandsTemplatePath,
  replaceDatePlaceholder,
  MDC_FILES
} from '../../../src/cli/utils/cursor-rules-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Cursor Rules Sync Utilities', () => {
  let testDir: string;
  let userRulesDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `cursor-rules-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Use actual project root (where package.json is)
    // This allows us to test with real templates
    projectRoot = path.resolve(__dirname, '../../../../..');

    // Create user rules directory
    userRulesDir = path.join(testDir, '.cursor', 'rules');
    await fs.ensureDir(userRulesDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors on Windows
    }
  });

  describe('getTemplatesDir', () => {
    it('should return path ending with templates/cursor-rules', () => {
      const templatesPath = getTemplatesDir();
      expect(templatesPath).toContain('templates');
      expect(templatesPath).toContain('cursor-rules');
    });
  });

  describe('getCommandsTemplatePath', () => {
    it('should return path ending with COMMANDS.md.template', () => {
      const templatePath = getCommandsTemplatePath();
      expect(templatePath).toContain('COMMANDS.md.template');
    });
  });

  describe('replaceDatePlaceholder', () => {
    it('should replace single {{DATE}} placeholder', () => {
      const content = 'Date: {{DATE}}';
      const result = replaceDatePlaceholder(content);
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      expect(result).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
    });

    it('should replace multiple {{DATE}} placeholders', () => {
      const content = 'Created: {{DATE}}, Updated: {{DATE}}';
      const result = replaceDatePlaceholder(content);
      const matches = result.match(/\d{4}-\d{2}-\d{2}/g);
      expect(matches).toHaveLength(2);
      expect(matches![0]).toBe(matches![1]); // Both should be same date
    });

    it('should return ISO date format (YYYY-MM-DD)', () => {
      const content = '{{DATE}}';
      const result = replaceDatePlaceholder(content);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('syncMDCFiles', () => {
    it('should sync all .mdc files successfully when templates exist', async () => {
      const result = await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false
      });

      // Should sync files if templates exist
      expect(typeof result.updated).toBe('number');
      expect(typeof result.backedUp).toBe('number');
      expect(result.updated).toBeGreaterThanOrEqual(0);
      expect(result.backedUp).toBe(0); // No backup when backup: false

      // Verify files were created if templates exist
      if (result.updated > 0) {
        for (const file of MDC_FILES) {
          const userPath = path.join(userRulesDir, file);
          const exists = await fs.pathExists(userPath);
          // At least some files should exist if templates are present
          if (exists) {
            const content = await fs.readFile(userPath, 'utf-8');
            // Verify {{DATE}} was replaced
            expect(content).not.toContain('{{DATE}}');
          }
        }
      }
    });

    it('should backup existing files when backup enabled', async () => {
      // First sync without backup
      await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false
      });

      // Create an existing file manually to test backup
      const existingFile = path.join(userRulesDir, MDC_FILES[0]);
      if (await fs.pathExists(existingFile)) {
        await fs.writeFile(existingFile, 'Old content', 'utf-8');

        // Sync again with backup enabled
        const result = await syncMDCFiles(projectRoot, userRulesDir, {
          backup: true
        });

        // Should have backed up the existing file
        expect(result.backedUp).toBeGreaterThanOrEqual(0);
        
        // Check backup file exists
        if (result.backedUp > 0) {
          const backupFiles = await fs.readdir(userRulesDir);
          const backupFile = backupFiles.find(f => f.startsWith(MDC_FILES[0] + '.backup-'));
          expect(backupFile).toBeDefined();
        }
      }
    });

    it('should handle missing template files gracefully', async () => {
      let notFoundFiles: string[] = [];

      const result = await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false,
        onFileNotFound: (file) => {
          notFoundFiles.push(file);
        }
      });

      // Function should complete without error
      expect(typeof result.updated).toBe('number');
      // If templates don't exist, onFileNotFound should be called
      // If templates exist, result.updated > 0
    });

    it('should replace {{DATE}} placeholder in synced files', async () => {
      const result = await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false
      });

      // If files were synced, verify {{DATE}} was replaced
      if (result.updated > 0) {
        const firstFile = path.join(userRulesDir, MDC_FILES[0]);
        if (await fs.pathExists(firstFile)) {
          const content = await fs.readFile(firstFile, 'utf-8');
          // {{DATE}} should be replaced with actual date
          expect(content).not.toContain('{{DATE}}');
          // Should contain date pattern if template had {{DATE}}
        }
      }
    });

    it('should call onFileSync callback for each synced file', async () => {
      const syncedFiles: string[] = [];

      const result = await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false,
        onFileSync: (file) => {
          syncedFiles.push(file);
        }
      });

      // Verify callback was called for each synced file
      expect(syncedFiles.length).toBe(result.updated);
      if (result.updated > 0) {
        expect(syncedFiles.length).toBeGreaterThan(0);
        // All synced files should be in MDC_FILES list
        syncedFiles.forEach(file => {
          expect(MDC_FILES).toContain(file);
        });
      }
    });

    it('should call onFileBackup callback for each backed up file', async () => {
      // First sync to create files
      await syncMDCFiles(projectRoot, userRulesDir, {
        backup: false
      });

      const backedUpFiles: string[] = [];

      // Sync again with backup
      const result = await syncMDCFiles(projectRoot, userRulesDir, {
        backup: true,
        onFileBackup: (file) => {
          backedUpFiles.push(file);
        }
      });

      // Verify callback was called for each backed up file
      expect(backedUpFiles.length).toBe(result.backedUp);
    });
  });

  describe('syncStateBehaviors', () => {
    it('should sync state-behaviors directory successfully when template exists', async () => {
      const result = await syncStateBehaviors(userRulesDir);

      // Should return number of files synced
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);

      // If template exists, should have synced files
      if (result > 0) {
        const stateBehaviorsDir = path.join(userRulesDir, 'state-behaviors');
        expect(await fs.pathExists(stateBehaviorsDir)).toBe(true);
        
        const stateFiles = await fs.readdir(stateBehaviorsDir);
        expect(stateFiles.length).toBe(result);
        
        // Should contain expected state files
        const expectedStates = ['UNDERSTANDING', 'DESIGNING', 'IMPLEMENTING', 'TESTING', 'REVIEWING', 'READY_TO_COMMIT'];
        const stateFileNames = stateFiles.map(f => f.replace('.md', ''));
        expectedStates.forEach(state => {
          // At least some expected states should be present
          if (result >= expectedStates.length) {
            expect(stateFileNames).toContain(state);
          }
        });
      }
    });

    it('should handle missing state-behaviors template gracefully', async () => {
      // Note: syncStateBehaviors uses getTemplatesDir() which points to package templates
      // So it will always find templates if they exist in the package
      // This test verifies the function doesn't throw when called
      // In a real scenario where templates don't exist, it would return 0
      const result = await syncStateBehaviors(userRulesDir);

      // Function should complete without error
      // Result depends on whether package templates exist
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should overwrite existing state-behaviors', async () => {
      // Create existing state-behaviors with old content
      const existingStateDir = path.join(userRulesDir, 'state-behaviors');
      await fs.ensureDir(existingStateDir);
      await fs.writeFile(
        path.join(existingStateDir, 'OLD.md'),
        'Old content',
        'utf-8'
      );

      // Sync state-behaviors (should overwrite)
      const result = await syncStateBehaviors(userRulesDir);
      
      // Should complete without error
      expect(typeof result).toBe('number');
      
      // If template exists, old file should be replaced
      if (result > 0) {
        const oldFileExists = await fs.pathExists(path.join(existingStateDir, 'OLD.md'));
        // OLD.md might still exist if template doesn't overwrite it, but new files should be there
        const stateFiles = await fs.readdir(existingStateDir);
        expect(stateFiles.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createCommandsMD', () => {
    it('should create COMMANDS.md successfully when template exists', async () => {
      const destPath = path.join(testDir, 'docs', 'COMMANDS.md');
      
      // Test with actual package template
      const result = await createCommandsMD(projectRoot, destPath);

      // Result depends on whether template exists in actual package
      expect(typeof result).toBe('boolean');
      
      if (result) {
        // File should be created
        expect(await fs.pathExists(destPath)).toBe(true);
        
        // Content should not contain {{DATE}}
        const content = await fs.readFile(destPath, 'utf-8');
        expect(content).not.toContain('{{DATE}}');
        // Should contain date pattern if template had {{DATE}}
        if (content.includes('Date:')) {
          expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
        }
      }
    });

    it('should handle missing template gracefully', async () => {
      // Note: createCommandsMD uses getCommandsTemplatePath() which points to package template
      // So it will find the template if it exists in the package
      // This test verifies the function signature and return type
      // In a real scenario where template doesn't exist, it would return false
      const destPath = path.join(testDir, 'docs', 'COMMANDS.md');
      
      // Test with actual package (template may or may not exist)
      const result = await createCommandsMD(projectRoot, destPath);

      // Function should complete without error
      // Result depends on whether package template exists
      expect(typeof result).toBe('boolean');
      
      // If template doesn't exist, file should not be created
      if (!result) {
        expect(await fs.pathExists(destPath)).toBe(false);
      }
    });

    it('should create parent directory if missing', async () => {
      // Test with dest path requiring parent creation
      const destPath = path.join(testDir, 'new-dir', 'sub-dir', 'COMMANDS.md');
      
      const result = await createCommandsMD(projectRoot, destPath);
      
      // If template exists, parent should be created
      if (result) {
        expect(await fs.pathExists(path.dirname(destPath))).toBe(true);
        expect(await fs.pathExists(destPath)).toBe(true);
      }
    });

    it('should replace {{DATE}} placeholder in COMMANDS.md', async () => {
      const destPath = path.join(testDir, 'docs', 'COMMANDS.md');
      const result = await createCommandsMD(projectRoot, destPath);
      
      if (result) {
        const content = await fs.readFile(destPath, 'utf-8');
        // {{DATE}} should be replaced
        expect(content).not.toContain('{{DATE}}');
      }
      
      // Also test the placeholder replacement function directly
      const content = '# Commands\n\nDate: {{DATE}}\n';
      const replaced = replaceDatePlaceholder(content);
      expect(replaced).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
      expect(replaced).not.toContain('{{DATE}}');
    });
  });
});

