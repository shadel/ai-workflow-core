/**
 * Jest Setup - Set test environment variables
 * This file runs before all tests
 */

import { jest } from '@jest/globals';

// Set NODE_ENV to 'test' to enable test mode features
// (bypasses checklist validation, rate limiting warnings, etc.)
process.env.NODE_ENV = 'test';

// Increase timeout globally for all tests and hooks (Windows file I/O can be slow)
// Windows needs 2x timeout due to slower file operations
// Local: 10s (Windows) or 5s (Unix), CI: 30s (Windows) or 15s (Unix)
const isWindows = process.platform === 'win32';
const isCI = !!(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.CIRCLECI ||
  process.env.TRAVIS ||
  process.env.JENKINS_URL ||
  process.env.BUILDKITE ||
  process.env.TF_BUILD
);
const baseTimeout = isCI ? 15000 : 5000;
const enhancedTimeout = isWindows ? baseTimeout * 2 : baseTimeout;
jest.setTimeout(enhancedTimeout);

