/**
 * Tests for TestPlanGenerator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestPlanGenerator } from '../src/utils/test-plan-generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TestPlanGenerator', () => {
  let generator: TestPlanGenerator;
  const testFile = path.join(__dirname, 'test-file.ts');

  beforeEach(async () => {
    generator = new TestPlanGenerator();
    // Create a test file with functions
    await fs.writeFile(testFile, `
      export function login(username: string) {
        return { success: true };
      }
      
      export async function logout() {
        return { success: true };
      }
      
      class UserService {
        public createUser(data: any) {
          return { id: 1 };
        }
        
        private validateEmail(email: string) {
          return true;
        }
      }
    `, 'utf-8');
  });

  afterEach(async () => {
    await fs.remove(testFile).catch(() => {});
  });

  describe('generateForFile', () => {
    it('should generate test plan from file', async () => {
      const plan = await generator.generateForFile(testFile);
      
      expect(plan).toBeDefined();
      expect(plan.title).toBeDefined();
      expect(plan.files).toContain(testFile);
      expect(Array.isArray(plan.testCases)).toBe(true);
      expect(plan.totalTests).toBeGreaterThan(0);
    });

    it('should extract functions from file', async () => {
      const plan = await generator.generateForFile(testFile);
      
      expect(plan.testCases.length).toBeGreaterThan(0);
      // Should have test cases for login, logout, createUser
      const titles = plan.testCases.map(tc => tc.title).join(' ');
      expect(titles).toMatch(/login|logout|createUser/i);
    });

    it('should generate test cases with proper structure', async () => {
      const plan = await generator.generateForFile(testFile);
      
      for (const testCase of plan.testCases) {
        expect(testCase.id).toBeDefined();
        expect(testCase.title).toBeDefined();
        expect(testCase.description).toBeDefined();
        expect(['P0', 'P1', 'P2']).toContain(testCase.priority);
      }
    });

    it('should handle file with no functions', async () => {
      const emptyFile = path.join(__dirname, 'empty-file.ts');
      await fs.writeFile(emptyFile, '// No functions here', 'utf-8');
      
      const plan = await generator.generateForFile(emptyFile);
      
      expect(plan).toBeDefined();
      expect(plan.testCases.length).toBe(0);
      expect(plan.totalTests).toBe(0);
      
      await fs.remove(emptyFile).catch(() => {});
    });
  });

  describe('generateMarkdown', () => {
    it('should generate markdown from test plan', async () => {
      const plan = await generator.generateForFile(testFile);
      const markdown = generator.generateMarkdown(plan);
      
      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown).toContain(plan.title);
      expect(markdown).toContain('Test Cases');
    });

    it('should include all test cases in markdown', async () => {
      const plan = await generator.generateForFile(testFile);
      const markdown = generator.generateMarkdown(plan);
      
      for (const testCase of plan.testCases) {
        expect(markdown).toContain(testCase.id);
        expect(markdown).toContain(testCase.title);
      }
    });
  });

  describe('save', () => {
    it('should save test plan to file', async () => {
      const plan = await generator.generateForFile(testFile);
      const outputPath = path.join(__dirname, 'test-plan-output.md');
      
      await generator.save(plan, outputPath);
      
      const exists = await fs.pathExists(outputPath);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain(plan.title);
      
      await fs.remove(outputPath).catch(() => {});
    });
  });
});

