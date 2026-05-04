import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration.
 * Tests live in tests/e2e/.
 * The app is served via `vite preview` on port 4173 before the suite runs.
 *
 * Validates: Requirements 12.1
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4173/archipielago-estetico/',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
})
