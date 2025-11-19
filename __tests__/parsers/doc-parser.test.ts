/**
 * Tests for DocumentParser
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { DocumentParser } from '../../src/parsers/doc-parser.js';

describe('DocumentParser', () => {
  const testDir = '.test-doc-parser';
  let parser: DocumentParser;

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    parser = new DocumentParser();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('parse()', () => {
    it('should parse valid markdown with frontmatter', async () => {
      const testFile = path.join(testDir, 'test.md');
      const content = `---
feature: Test Feature
category: core-feature
source_files:
  - src/test.ts
logic_sections:
  - name: Test Logic
    type: business-logic
    source: src/test.ts:10-20
    flowchart: true
updated: 2025-11-16T10:00:00Z
sync_status: verified
---

# Test Feature

## Business Logic

\`\`\`typescript
function test() {
  return true;
}
\`\`\`

## Flow

\`\`\`mermaid
flowchart TD
  A[Start] --> B[End]
\`\`\`
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse(testFile);

      expect(result.filePath).toBe(testFile);
      expect(result.metadata.feature).toBe('Test Feature');
      expect(result.metadata.category).toBe('core-feature');
      expect(result.metadata.source_files).toEqual(['src/test.ts']);
      expect(result.metadata.logic_sections).toHaveLength(1);
      expect(result.metadata.sync_status).toBe('verified');
      expect(result.codeBlocks).toHaveLength(2);
      expect(result.flowcharts).toHaveLength(1);
    });

    it('should extract code blocks correctly', async () => {
      const testFile = path.join(testDir, 'code.md');
      const content = `---
feature: Code Test
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`javascript
const y = 2;
\`\`\`

\`\`\`bash
echo "test"
\`\`\`
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse(testFile);

      expect(result.codeBlocks).toHaveLength(3);
      expect(result.codeBlocks[0].language).toBe('typescript');
      expect(result.codeBlocks[0].code).toContain('const x = 1;');
      expect(result.codeBlocks[1].language).toBe('javascript');
      expect(result.codeBlocks[2].language).toBe('bash');
    });

    it('should detect flowcharts', async () => {
      const testFile = path.join(testDir, 'flowchart.md');
      const content = `---
feature: Flowchart Test
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> State1
\`\`\`
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse(testFile);

      expect(result.flowcharts).toHaveLength(2);
      expect(result.flowcharts[0].type).toBe('flowchart');
      expect(result.flowcharts[1].type).toBe('stateDiagram');
    });

    it('should detect business rules and examples', async () => {
      const testFile = path.join(testDir, 'complete.md');
      const content = `---
feature: Complete Test
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

# Feature

## Business Rules

| Rule | Action |
|------|--------|
| R1   | Do X   |

## Examples

\`\`\`typescript
example();
\`\`\`
`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse(testFile);

      expect(result.hasBusinessRules).toBe(true);
      expect(result.hasExamples).toBe(true);
    });

    it('should handle missing frontmatter gracefully', async () => {
      const testFile = path.join(testDir, 'no-frontmatter.md');
      const content = `# Just Markdown

No frontmatter here.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parse(testFile);

      expect(result.metadata.source_files).toEqual([]);
      expect(result.metadata.logic_sections).toEqual([]);
    });
  });

  describe('isValidDocFile()', () => {
    it('should return true for .md files', async () => {
      const testFile = path.join(testDir, 'valid.md');
      await fs.writeFile(testFile, '# Test');

      const result = await parser.isValidDocFile(testFile);

      expect(result).toBe(true);
    });

    it('should return false for non-.md files', async () => {
      const testFile = path.join(testDir, 'invalid.txt');
      await fs.writeFile(testFile, 'test');

      const result = await parser.isValidDocFile(testFile);

      expect(result).toBe(false);
    });

    it('should return false for non-existent files', async () => {
      const result = await parser.isValidDocFile('nonexistent.md');

      expect(result).toBe(false);
    });
  });

  describe('parseMultiple()', () => {
    it('should parse multiple files', async () => {
      const file1 = path.join(testDir, 'doc1.md');
      const file2 = path.join(testDir, 'doc2.md');

      await fs.writeFile(file1, `---
feature: Feature 1
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

# Feature 1`);

      await fs.writeFile(file2, `---
feature: Feature 2
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

# Feature 2`);

      const results = await parser.parseMultiple([file1, file2]);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.feature).toBe('Feature 1');
      expect(results[1].metadata.feature).toBe('Feature 2');
    });

    it('should handle errors gracefully and continue', async () => {
      const validFile = path.join(testDir, 'valid.md');
      const invalidFile = 'nonexistent.md';

      await fs.writeFile(validFile, `---
feature: Valid
category: core-feature
source_files: []
logic_sections: []
updated: 2025-11-16T10:00:00Z
sync_status: pending
---

# Valid`);

      const results = await parser.parseMultiple([validFile, invalidFile]);

      // Should only return successfully parsed files
      expect(results).toHaveLength(1);
      expect(results[0].metadata.feature).toBe('Valid');
    });
  });
});

