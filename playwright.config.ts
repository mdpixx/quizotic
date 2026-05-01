import { defineConfig, devices } from '@playwright/test'

// Critical-path E2E. Targets a running dev server by default (PLAYWRIGHT_BASE_URL
// override lets us point at staging or prod for synthetic monitoring).
//
// Single project (chromium-only) because:
//   - The bug class we're guarding against is server schema / Socket.IO logic,
//     which isn't browser-rendering specific.
//   - Faster CI loop matters more than cross-browser coverage at this stage.
//   - Multi-browser can be added when the test surface grows.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

export default defineConfig({
  testDir: './tests/e2e',
  // No parallel — we share one game session across host/participant contexts
  // and the server's session Map is keyed by 6-digit codes, so collisions
  // between concurrent runs would be loud.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
