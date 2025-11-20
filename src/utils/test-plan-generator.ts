/**
 * Test Plan Generator - Simplified for Core Build
 * Auto-generates basic test plans from code structure
 * @requirement REQ-V2-022 - Test Plan Generator
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Test case structure
 */
export interface TestCase {
  id: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
}

/**
 * Generated test plan
 */
export interface TestPlan {
  title: string;
  files: string[];
  testCases: TestCase[];
  totalTests: number;
}

/**
 * Test Plan Generator - Creates test plans from code
 * @requirement REQ-V2-022 - Auto-generate test plans
 */
export class TestPlanGenerator {
  /**
   * Generate test plan for a file
   * @requirement REQ-V2-022 - Test plan generation logic
   */
  async generateForFile(filePath: string): Promise<TestPlan> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.ts');
    
    // Extract functions/methods
    const functions = this.extractFunctions(content);
    
    // Generate test cases
    const testCases: TestCase[] = [];
    let testId = 1;
    
    for (const func of functions) {
      // Happy path test
      testCases.push({
        id: `T${testId++}`,
        title: `should ${func} successfully`,
        description: `Test ${func} with valid input`,
        priority: 'P0'
      });
      
      // Edge case test
      testCases.push({
        id: `T${testId++}`,
        title: `should handle edge cases in ${func}`,
        description: `Test ${func} with boundary values`,
        priority: 'P1'
      });
      
      // Error case test
      testCases.push({
        id: `T${testId++}`,
        title: `should handle errors in ${func}`,
        description: `Test ${func} error handling`,
        priority: 'P1'
      });
    }
    
    return {
      title: `Test Plan: ${fileName}`,
      files: [filePath],
      testCases,
      totalTests: testCases.length
    };
  }

  /**
   * Extract function names from code
   */
  private extractFunctions(content: string): string[] {
    const functions: string[] = [];
    
    // Match function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    let match;
    
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
    
    // Match class methods
    const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g;
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      if (methodName !== 'constructor' && !methodName.startsWith('_')) {
        functions.push(methodName);
      }
    }
    
    return [...new Set(functions)]; // Remove duplicates
  }

  /**
   * Generate markdown test plan
   */
  generateMarkdown(plan: TestPlan): string {
    let md = `# ${plan.title}\n\n`;
    md += `**Files:** ${plan.files.join(', ')}\n`;
    md += `**Total Tests:** ${plan.totalTests}\n\n`;
    md += `---\n\n`;
    md += `## Test Cases\n\n`;
    
    for (const tc of plan.testCases) {
      md += `### ${tc.id}: ${tc.title}\n\n`;
      md += `**Priority:** ${tc.priority}\n`;
      md += `**Description:** ${tc.description}\n\n`;
    }
    
    return md;
  }

  /**
   * Save test plan to file
   */
  async save(plan: TestPlan, outputPath: string): Promise<void> {
    const md = this.generateMarkdown(plan);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, md, 'utf-8');
  }
}

