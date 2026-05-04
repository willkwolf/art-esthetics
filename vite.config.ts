import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/archipielago-estetico/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // Exclude Playwright E2E tests from Vitest's discovery
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
