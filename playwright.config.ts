import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * 
 * IMPORTANT: Tests use a separate test Firebase project to ensure
 * they never interact with production data.
 * 
 * Set up:
 * 1. Create a separate Firebase project for testing
 * 2. Copy env.example to .env.test.local
 * 3. Fill in TEST_* environment variables with test project credentials
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      // Allow test auth endpoint in test environment
      ALLOW_TEST_AUTH: "true",
      NODE_ENV: "test",
      // Enable E2E test mode to bypass SSR auth redirects
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
    },
  },
});

