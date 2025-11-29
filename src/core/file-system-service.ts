/**
 * File System Service - Centralized file system operations
 * 
 * Provides abstraction layer for file system operations with:
 * - Automatic directory creation
 * - Retry logic for transient errors
 * - Standardized error handling
 * - Consistent API across codebase
 * 
 * @requirement TASK-2.1 - File System Abstraction
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * File system operation options
 */
export interface FileSystemOptions {
  /**
   * Retry attempts for transient errors (default: 3)
   */
  retries?: number;
  
  /**
   * Retry delay in milliseconds (default: 100)
   */
  retryDelay?: number;
  
  /**
   * Ensure directory exists before operation (default: true)
   */
  ensureDir?: boolean;
}

/**
 * File System Service
 * 
 * Centralizes file system operations with automatic directory creation,
 * retry logic, and standardized error handling.
 */
export class FileSystemService {
  private defaultRetries: number;
  private defaultRetryDelay: number;

  constructor(options: { retries?: number; retryDelay?: number } = {}) {
    this.defaultRetries = options.retries ?? 3;
    this.defaultRetryDelay = options.retryDelay ?? 100;
  }

  /**
   * Ensure directory exists
   * 
   * @param dirPath - Directory path
   * @throws Error if directory cannot be created
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
    } catch (error: any) {
      throw new Error(
        `Failed to create directory: ${dirPath}\n` +
        `Error: ${error.message}`
      );
    }
  }

  /**
   * Write file with automatic directory creation
   * 
   * @param filePath - File path
   * @param content - File content
   * @param encoding - File encoding (default: 'utf-8')
   * @param options - Operation options
   */
  async writeFile(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf-8',
    options: FileSystemOptions = {}
  ): Promise<void> {
    const { retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, ensureDir = true } = options;

    if (ensureDir) {
      await this.ensureDir(path.dirname(filePath));
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await fs.writeFile(filePath, content, encoding);
        return;
      } catch (error: any) {
        lastError = error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw new Error(
      `Failed to write file after ${retries + 1} attempts: ${filePath}\n` +
      `Error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Write JSON file with automatic directory creation
   * 
   * @param filePath - File path
   * @param data - JSON data
   * @param options - Operation options
   */
  async writeJson(
    filePath: string,
    data: any,
    options: FileSystemOptions & { spaces?: number } = {}
  ): Promise<void> {
    const { spaces, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, ensureDir = true } = options;

    if (ensureDir) {
      await this.ensureDir(path.dirname(filePath));
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await fs.writeJson(filePath, data, { spaces });
        return;
      } catch (error: any) {
        lastError = error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw new Error(
      `Failed to write JSON file after ${retries + 1} attempts: ${filePath}\n` +
      `Error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Read JSON file
   * 
   * @param filePath - File path
   * @returns Parsed JSON data
   */
  async readJson(filePath: string): Promise<any> {
    try {
      return await fs.readJson(filePath);
    } catch (error: any) {
      throw new Error(
        `Failed to read JSON file: ${filePath}\n` +
        `Error: ${error.message}`
      );
    }
  }

  /**
   * Read file
   * 
   * @param filePath - File path
   * @param encoding - File encoding (default: 'utf-8')
   * @returns File content
   */
  async readFile(
    filePath: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error: any) {
      throw new Error(
        `Failed to read file: ${filePath}\n` +
        `Error: ${error.message}`
      );
    }
  }

  /**
   * Check if path exists
   * 
   * @param filePath - File or directory path
   * @returns True if path exists
   */
  async pathExists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  /**
   * Remove file or directory
   * 
   * @param filePath - File or directory path
   */
  async remove(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error: any) {
      throw new Error(
        `Failed to remove: ${filePath}\n` +
        `Error: ${error.message}`
      );
    }
  }

  /**
   * Copy file or directory
   * 
   * @param src - Source path
   * @param dest - Destination path
   * @param options - Operation options
   */
  async copy(
    src: string,
    dest: string,
    options: FileSystemOptions = {}
  ): Promise<void> {
    const { ensureDir = true } = options;

    if (ensureDir) {
      await this.ensureDir(path.dirname(dest));
    }

    try {
      await fs.copy(src, dest);
    } catch (error: any) {
      throw new Error(
        `Failed to copy: ${src} -> ${dest}\n` +
        `Error: ${error.message}`
      );
    }
  }

  /**
   * Move file or directory
   * 
   * @param src - Source path
   * @param dest - Destination path
   * @param options - Operation options
   */
  async move(
    src: string,
    dest: string,
    options: FileSystemOptions = {}
  ): Promise<void> {
    const { ensureDir = true } = options;

    if (ensureDir) {
      await this.ensureDir(path.dirname(dest));
    }

    try {
      await fs.move(src, dest);
    } catch (error: any) {
      throw new Error(
        `Failed to move: ${src} -> ${dest}\n` +
        `Error: ${error.message}`
      );
    }
  }
}

/**
 * Default FileSystemService instance
 * 
 * Use this for most operations. Create custom instances only if you need
 * different retry settings.
 */
export const fileSystemService = new FileSystemService();



