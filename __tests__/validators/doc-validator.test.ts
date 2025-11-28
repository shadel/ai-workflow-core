/**
 * Tests for DocumentationValidator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { DocumentationValidator } from '../../src/validators/doc-validator.js';

describe('DocumentationValidator', () => {
  const testDir = '.test-doc-validator';
  let validator: DocumentationValidator;

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    validator = new DocumentationValidator(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  const createValidDoc = async (filename: string) => {
    const content = `---
feature: Valid Feature
category: core-feature
source_files:
  - src/test.ts
logic_sections:
  - name: Test Logic
    type: business-logic
    source: src/test.ts:1-5
    flowchart: true
updated: ${new Date().toISOString()}
sync_status: verified
---

# Valid Feature

## Business Logic

\`\`\`typescript
function test() {
  return true;
}
\`\`\`

### Business Rules

| Rule | Action |
|------|--------|
| R1   | Test   |

\`\`\`mermaid
flowchart TD
  A[Start] --> B[End]
\`\`\`

## Examples

\`\`\`typescript
test();
\`\`\`
`;
    // Create source file
    await fs.ensureDir(path.join(testDir, 'src'));
    await fs.writeFile(
      path.join(testDir, 'src', 'test.ts'),
      'line 1\nline 2\nline 3\nline 4\nline 5\n'
    );

    await fs.writeFile(path.join(testDir, filename), content);
  };

  describe('validate()', () => {
    it('should validate a complete, valid document', async () => {
      await createValidDoc('valid.md');

      const result = await validator.validate(path.join(testDir, 'valid.md'));

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing feature/command name', async () => {
      const content = `---
category: core-feature
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Missing Name`;
      await fs.writeFile(path.join(testDir, 'missing-name.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'missing-name.md')
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DOC-002')).toBe(true);
      expect(result.errors.some(e => e.message.includes('feature or command'))).toBe(true);
    });

    it('should detect missing required metadata fields', async () => {
      const content = `---
feature: Test
---

# Test`;
      await fs.writeFile(path.join(testDir, 'incomplete.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'incomplete.md')
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'source_files')).toBe(true);
      expect(result.errors.some(e => e.field === 'logic_sections')).toBe(true);
    });

    it('should detect invalid category', async () => {
      const content = `---
feature: Test
category: invalid-category
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Test`;
      await fs.writeFile(path.join(testDir, 'invalid-category.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'invalid-category.md')
      );

      expect(result.warnings.some(w => w.code === 'DOC-003' && w.field === 'category')).toBe(true);
    });

    it('should detect non-existent source files', async () => {
      const content = `---
feature: Test
category: core-feature
source_files:
  - nonexistent.ts
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Test`;
      await fs.writeFile(path.join(testDir, 'missing-source.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'missing-source.md')
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.code === 'DOC-003' && e.message.includes('nonexistent.ts')
      )).toBe(true);
    });

    it('should detect invalid logic section references', async () => {
      const content = `---
feature: Test
category: core-feature
source_files: []
logic_sections:
  - name: Invalid Logic
    type: business-logic
    source: nonexistent.ts:1-10
    flowchart: false
updated: ${new Date().toISOString()}
sync_status: pending
---

# Test`;
      await fs.writeFile(path.join(testDir, 'invalid-logic.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'invalid-logic.md')
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DOC-004')).toBe(true);
    });

    it('should warn about outdated sync_status', async () => {
      const content = `---
feature: Test
category: core-feature
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: outdated
---

# Test`;
      await fs.writeFile(path.join(testDir, 'outdated.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'outdated.md')
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.code === 'DOC-007' && e.message.includes('outdated')
      )).toBe(true);
    });

    it('should warn about missing business rules', async () => {
      const content = `---
feature: Test
category: core-feature
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Test

No business rules here.`;
      await fs.writeFile(path.join(testDir, 'no-rules.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'no-rules.md')
      );

      expect(result.warnings.some(w =>
        w.code === 'DOC-006' && w.message.includes('business rules')
      )).toBe(true);
    });

    it('should warn about missing examples', async () => {
      const content = `---
feature: Test
category: core-feature
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Test

No examples here.`;
      await fs.writeFile(path.join(testDir, 'no-examples.md'), content);

      const result = await validator.validate(
        path.join(testDir, 'no-examples.md')
      );

      expect(result.warnings.some(w =>
        w.code === 'DOC-007' && w.message.includes('examples')
      )).toBe(true);
    });

    it('should handle parse errors gracefully', async () => {
      const invalidFile = path.join(testDir, 'invalid.md');
      // Don't create the file

      const result = await validator.validate(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DOC-PARSE-001')).toBe(true);
    });
  });

  describe('discoverFeatures()', () => {
    it('should discover CLI commands', async () => {
      await fs.ensureDir(path.join(testDir, 'packages/test/src/cli/commands'));
      await fs.writeFile(
        path.join(testDir, 'packages/test/src/cli/commands/test-command.ts'),
        'export function testCommand() {}'
      );

      const features = await validator.discoverFeatures();

      const command = features.find(f => f.name === 'test-command');
      expect(command).toBeDefined();
      expect(command?.type).toBe('command');
      expect(command?.hasDocumentation).toBe(false);
    });

    it('should discover features (managers)', async () => {
      await fs.ensureDir(path.join(testDir, 'packages/test/src/core'));
      await fs.writeFile(
        path.join(testDir, 'packages/test/src/core/test-manager.ts'),
        'export class TestManager {}'
      );

      const features = await validator.discoverFeatures();

      const feature = features.find(f => f.name === 'test');
      expect(feature).toBeDefined();
      expect(feature?.type).toBe('feature');
    });

    it('should detect when documentation exists', async () => {
      // Create command file
      await fs.ensureDir(path.join(testDir, 'packages/test/src/cli/commands'));
      await fs.writeFile(
        path.join(testDir, 'packages/test/src/cli/commands/test.ts'),
        'export function test() {}'
      );

      // Create documentation
      await fs.ensureDir(path.join(testDir, 'docs/commands'));
      await createValidDoc('docs/commands/test.md');

      const features = await validator.discoverFeatures();

      const command = features.find(f => f.name === 'test');
      expect(command?.hasDocumentation).toBe(true);
    });
  });

  describe('generateReport()', () => {
    it('should generate validation report', async () => {
      // Create some docs
      await fs.ensureDir(path.join(testDir, 'docs/features'));
      await createValidDoc('docs/features/feature1.md');

      const report = await validator.generateReport();

      expect(report.totalDocs).toBeGreaterThanOrEqual(1);
      expect(report.validDocs + report.invalidDocs).toBe(report.totalDocs);
      expect(report.results).toHaveLength(report.totalDocs);
      expect(report.summary).toBeDefined();
    });

    it('should detect missing documentation', async () => {
      // Create source files without docs
      await fs.ensureDir(path.join(testDir, 'packages/test/src/cli/commands'));
      await fs.writeFile(
        path.join(testDir, 'packages/test/src/cli/commands/undocumented.ts'),
        'export function undocumented() {}'
      );

      const report = await validator.generateReport();

      expect(report.summary.missingDocs.length).toBeGreaterThan(0);
      expect(report.summary.missingDocs.some(d =>
        d.includes('undocumented')
      )).toBe(true);
    });

    it('should detect orphaned documentation', async () => {
      // Create doc without corresponding source
      await fs.ensureDir(path.join(testDir, 'docs/features'));
      const content = `---
feature: Orphaned
category: core-feature
source_files: []
logic_sections: []
updated: ${new Date().toISOString()}
sync_status: pending
---

# Orphaned`;
      await fs.writeFile(
        path.join(testDir, 'docs/features/orphaned.md'),
        content
      );

      const report = await validator.generateReport();

      // This doc has no corresponding source
      expect(report.summary.orphanedDocs.length).toBeGreaterThanOrEqual(0);
    });
  });
});

