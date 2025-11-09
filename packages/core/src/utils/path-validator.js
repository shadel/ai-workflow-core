/**
 * Path Validator - Security utility for file system operations
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 * @requirement NFR-007 (Security)
 */
import path from 'path';
export class PathValidator {
    projectRoot;
    allowedPaths;
    deniedPaths;
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
        this.allowedPaths = [
            this.projectRoot,
            path.join(this.projectRoot, '.ai-context'),
            path.join(this.projectRoot, 'config'),
            path.join(this.projectRoot, 'docs'),
            path.join(this.projectRoot, 'packages'), // v2.0: Support monorepo
        ];
        this.deniedPaths = [
            '/etc',
            '/sys',
            '/proc',
            'C:\\Windows',
            'C:\\Program Files',
        ];
    }
    /**
     * Validate path is within project root and not in dangerous locations
     */
    validate(targetPath) {
        const resolvedPath = path.resolve(targetPath);
        // Check for path traversal
        if (!resolvedPath.startsWith(this.projectRoot)) {
            return {
                valid: false,
                error: `Path traversal detected: ${targetPath} is outside project root`,
            };
        }
        // Check against denied paths
        for (const deniedPath of this.deniedPaths) {
            if (resolvedPath.startsWith(deniedPath)) {
                return {
                    valid: false,
                    error: `Access to system path denied: ${deniedPath}`,
                };
            }
        }
        return { valid: true };
    }
    /**
     * Ensure path is safe and return normalized path
     */
    safe(targetPath) {
        const result = this.validate(targetPath);
        if (!result.valid) {
            throw new Error(result.error);
        }
        return path.resolve(targetPath);
    }
}
//# sourceMappingURL=path-validator.js.map