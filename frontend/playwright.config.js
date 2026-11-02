import { defineConfig, devices } from '@playwright/test'
import { API_URL, APP_URL, E2E_DB_NAME } from './e2e/support/env.js'

// Own ports and reuseExistingServer: false, so a test run can never attach to a `pnpm dev` server
// that is using the shared database.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  // One at a time: the tests share one database
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: APP_URL,
    timezoneId: 'Asia/Singapore',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server.js',
      cwd: '../backend',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      // MONGO_URI and JWT_SECRET come from backend/.env, or from CI. dotenv never replaces a variable
      // that is already set, so these win over anything in backend/.env.
      env: {
        PORT: new URL(API_URL).port,
        NODE_ENV: 'development',
        MONGO_DB_NAME: E2E_DB_NAME,
        FRONTEND_URL: APP_URL,
        HAWKER_IMPORT_ON_START: 'off',
        REPORT_LOCATION_CHECK: 'on',
        LOGIN_RATE_LIMIT_MAX: '1000',
        REPORT_RATE_LIMIT_MAX: '1000',
        STALL_RATE_LIMIT_MAX: '1000'
      }
    },
    {
      command: `pnpm exec vite --port ${new URL(APP_URL).port} --strictPort`,
      url: APP_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: API_URL }
    }
  ]
})
