/**
 * Path Validator - Security utility for file system operations
 * Extracted from v1.x for @workflow/core package
 * @requirement REQ-V2-002
 * @requirement NFR-007 (Security)
 */
export declare class PathValidator {
    private readonly projectRoot;
    private readonly allowedPaths;
    private readonly deniedPaths;
    constructor(projectRoot?: string);
    /**
     * Validate path is within project root and not in dangerous locations
     */
    validate(targetPath: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Ensure path is safe and return normalized path
     */
    safe(targetPath: string): string;
}
//# sourceMappingURL=path-validator.d.ts.map