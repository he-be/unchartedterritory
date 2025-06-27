import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      'frontend/tests/**', // Playwright tests  
      'frontend/node_modules/**', // Frontend dependencies
      'node_modules/**',
      'dist/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 35,
        functions: 45,
        branches: 45,
        statements: 35
      },
      exclude: [
        'node_modules/',
        'dist/',
        'frontend/**', // Exclude all frontend files from coverage
        'apps/**', // Exclude new distributed workers (will add tests in next iteration)
        'packages/**', // Exclude shared types
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        'templates/**'
      ]
    },
    environment: 'node',
    globals: true
  }
})
