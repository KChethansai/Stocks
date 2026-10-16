import { defineConfig, devices } from '@playwright/test'

// Browser audit for MarketForge. App + isolated test API must be running:
//   Backend:  DB_URL=<isolated pwtest url> PORT=4101 node server.js   (Backend cwd)
//   Frontend: VITE_API_URL=http://localhost:4101 VITE_GOOGLE_CLIENT_ID= npx vite --port 5173 (Frontend cwd)
// Blank the Google ID for deterministic runs: a real client ID loads the
// third-party GSI script, which races form interaction on Firefox in sandbox
// networks (lost submit clicks + console noise). OAuth round-trip is an
// accepted unverified area; nothing under test asserts on the Google button.
// Reports + screenshots go to ignored artifact dirs (see Frontend/.gitignore).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-desktop',
      // Branded Google Chrome per operator instruction (channel: 'chrome').
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'], channel: 'chrome', viewport: { width: 390, height: 844 } },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
