import { defineConfig, devices } from "@playwright/test";
// ⬇️ Add this if you also want Playwright itself (Node side) to see .env.test.local
import dotenv from "dotenv";
dotenv.config({ path: ".env.test.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ||
      process.env.PLAYWRIGHT_BASE_URL ||
      "http://localhost:3000",
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
    // Let Next handle .env.test.local based on NODE_ENV=test
    command: "NODE_ENV=test next dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: "test",
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      ALLOW_TEST_AUTH: "true",
    },
  },
});
