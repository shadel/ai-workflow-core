export default {
  preset: 'ts-jest/presets/default-esm',  // v3.1.0: ESM support
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],  // v3.1.0: Treat .ts as ESM
  maxWorkers: 1,  // Run tests sequentially to avoid isolation issues with shared .ai-context
  moduleNameMapper: {
    '^@shadel/workflow-core$': '<rootDir>/../core/src/index.ts',
    '^@shadel/workflow-core/(.*)$': '<rootDir>/../core/src/$1',
    '^@workflow/core$': '<rootDir>/../core/src/index.ts',
    '^@workflow/core/(.*)$': '<rootDir>/../core/src/$1',
    '^(\\.{1,2}/.+)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,  // v3.1.0: Enable ESM support
        tsconfig: 'tsconfig.test.json',  // Use test-specific tsconfig
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
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
};

