export default {
  preset: 'ts-jest/presets/default-esm',  // v3.1.0: ESM support
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],  // v3.1.0: Treat .ts as ESM
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',  // Package-level cache (Phase 1 - working)
  maxWorkers: process.env.CI ? '50%' : '75%',  // REQUIREMENT: Must achieve 100% pass rate at 75% maxWorkers - use other isolation solutions
  // Optimize test discovery
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Optimize module resolution
  moduleNameMapper: {
    '^@shadel/workflow-core$': '<rootDir>/../core/src/index.ts',
    '^@shadel/workflow-core/(.*)$': '<rootDir>/../core/src/$1',
    '^@workflow/core$': '<rootDir>/../core/src/index.ts',
    '^@workflow/core/(.*)$': '<rootDir>/../core/src/$1',
    '^(\\.{1,2}/.+)\\.js$': '$1',
  },
  // Optimize transform
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,  // v3.1.0: Enable ESM support
        tsconfig: 'tsconfig.test.json',  // Use test-specific tsconfig
        // Note: isolatedModules moved to tsconfig.test.json (ts-jest deprecation warning)
        // Optimize: Enable isolatedModules for faster compilation
        isolatedModules: true,
      },
    ],
  },
  // Optimize coverage collection
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/cli/commands/init.ts',
    '!src/hooks/pre-commit.ts',
    '!src/core/validator-with-config.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 40,
      lines: 20,
      statements: 20,
    },
  },
  // Optimize test execution
  testTimeout: process.env.CI ? 15000 : 5000,  // Environment-aware timeout
  // Optimize for monorepo
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>/src'],
  // Reduce test overhead
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

