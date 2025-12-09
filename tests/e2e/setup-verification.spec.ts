import { test, expect } from "@playwright/test";

/**
 * Simple test to verify Playwright setup is correct
 * This test checks that:
 * 1. Playwright can connect to the app
 * 2. The app is running
 * 3. Basic page navigation works
 */
test("should load the login page", async ({ page }) => {
  // Try to navigate to the app
  await page.goto("/");
  
  // The app should redirect to login if not authenticated
  // or show the dashboard if authenticated
  // Either way, we should get a response
  await expect(page).toHaveURL(/\/login|\//);
  
  // Check that the page has loaded (has some content)
  const body = page.locator("body");
  await expect(body).toBeVisible({ timeout: 10000 });
  
  console.log("✓ Playwright setup verification passed!");
  console.log(`  Page URL: ${page.url()}`);
  console.log(`  Page title: ${await page.title()}`);
});

