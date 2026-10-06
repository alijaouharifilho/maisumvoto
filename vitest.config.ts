import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['testes/**/*.test.ts', 'testes/**/*.test.tsx'],
    exclude: ['testes/e2e/**', 'node_modules/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['nucleo/**/*.ts'],
      exclude: ['nucleo/tipos.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
})
