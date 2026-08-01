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

// Only manage a server when we are pointed at a local one. With
// PLAYWRIGHT_BASE_URL set to staging or prod, booting a dev server would be
// both pointless and confusing.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL)
// server.mjs defaults to 3000, but every other entry point here (predeploy,
// .claude/launch.json, the port rule in CLAUDE.md) uses 4000 — so the port has
// to be handed over explicitly or the server comes up somewhere the tests are
// not looking.
const localPort = (() => {
  try { return new URL(baseURL).port || '4000' } catch { return '4000' }
})()

export default defineConfig({
  testDir: './tests/e2e',
  // Start the app if it is not already up.
  //
  // Without this, running the suite with nothing on :4000 fails EVERY test with
  // net::ERR_CONNECTION_REFUSED — which reads exactly like a broken branch. It
  // cost a real misdiagnosis: a baseline run against main reported "10 specs
  // failing" when the only problem was that no server was listening, and three
  // healthy specs were written off as flaky on the strength of it.
  //
  // reuseExistingServer means `npm run predeploy`, which boots its own server
  // first, still runs against that one rather than starting a second.
  ...(isLocal
    ? {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          // The dev server compiles routes on demand; first boot is slow.
          timeout: 120_000,
          env: { PORT: localPort },
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
  // Deletes the @e2e.test accounts the suite creates. Without it every run
  // leaves a batch of "E2E Host" users behind, and they had grown to dominate
  // the admin Users list. Set KEEP_E2E_USERS=1 to skip.
  globalTeardown: './tests/e2e/global-teardown.ts',
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
