import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      'frontend/**',
      'node_modules/**',
      'dist/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 60,
        functions: 70,
        branches: 75,
        statements: 60
      },
      exclude: [
        'node_modules/',
        'dist/',
        'frontend/**',
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
