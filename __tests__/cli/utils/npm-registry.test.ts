/**
 * Unit tests for NPM Registry Utility
 * @requirement FIX-UPGRADE-COMMAND - Test npm registry fetching
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { fetchLatestVersion } from '../../../src/cli/utils/npm-registry.js';

// Mock fetch globally
const originalFetch = global.fetch;

describe('NPM Registry Utility', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = originalFetch;
  });

  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = originalFetch;
  });

  describe('fetchLatestVersion', () => {
    it('should fetch latest version from npm registry', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          'dist-tags': {
            latest: '3.1.2',
            beta: '3.2.0-beta.1'
          },
          time: {
            '3.1.2': '2024-11-14T08:00:00.000Z'
          }
        })
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBe('3.1.2');
      expect(info.betaVersion).toBe('3.2.0-beta.1');
      expect(info.publishDate).toBe('2024-11-14T08:00:00.000Z');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://registry.npmjs.org/@shadel/ai-workflow-core',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should return null for non-existent package (404)', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@nonexistent/package');

      expect(info.latestVersion).toBeNull();
      expect(info.betaVersion).toBeNull();
      expect(info.publishDate).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBeNull();
      expect(info.betaVersion).toBeNull();
      expect(info.publishDate).toBeNull();
    });

    it('should handle missing dist-tags in response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          // No dist-tags field
          name: '@shadel/ai-workflow-core'
        })
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBeNull();
      expect(info.betaVersion).toBeNull();
    });

    it('should handle missing latest tag', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          'dist-tags': {
            // Only beta, no latest
            beta: '3.2.0-beta.1'
          }
        })
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBeNull();
      expect(info.betaVersion).toBe('3.2.0-beta.1');
    });

    it('should extract publish date when available', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          'dist-tags': {
            latest: '3.1.2'
          },
          time: {
            '3.1.2': '2024-11-14T08:00:00.000Z',
            '3.1.1': '2024-11-13T08:00:00.000Z'
          }
        })
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.publishDate).toBe('2024-11-14T08:00:00.000Z');
    });

    it('should handle missing time field', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          'dist-tags': {
            latest: '3.1.2'
          }
          // No time field
        })
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBe('3.1.2');
      expect(info.publishDate).toBeNull();
    });

    it('should handle HTTP errors other than 404', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };

      global.fetch = jest.fn(() => Promise.resolve(mockResponse as Response));

      const info = await fetchLatestVersion('@shadel/ai-workflow-core');

      expect(info.latestVersion).toBeNull();
      expect(info.betaVersion).toBeNull();
      expect(info.publishDate).toBeNull();
    });
  });
});

