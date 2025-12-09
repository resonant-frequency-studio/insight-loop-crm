import { test, expect } from "./fixtures/auth";

/**
 * Test to verify Firebase custom token authentication works
 */
test("should authenticate using custom token", async ({ authenticatedPage, testUserId }) => {
  // Page should already be authenticated from fixture
  // Wait for page to be ready (fixture already navigated)
  await authenticatedPage.waitForLoadState("networkidle");
  
  // Wait a bit for any client-side redirects to complete
  await authenticatedPage.waitForTimeout(1000);
  
  // Get current URL
  const url = authenticatedPage.url();
  console.log(`Current URL: ${url}`);
  
  // Should not be on login page
  expect(url).not.toContain("/login");
  
  // Should be on a valid app page (dashboard, contacts, etc.)
  // Allow base path with or without trailing slash
  const baseUrl = url.split("?")[0].split("#")[0]; // Remove query params and hash
  const isValidPage = baseUrl === "/" || 
                      baseUrl.endsWith("/") || 
                      baseUrl.includes("/contacts") || 
                      baseUrl.includes("/dashboard") ||
                      baseUrl.includes("/action-items");
  
  expect(isValidPage).toBe(true);
  
  // Page should have loaded content - check for navigation sidebar
  const nav = authenticatedPage.locator("nav, [role='navigation']").first();
  await expect(nav).toBeVisible({ timeout: 5000 });
  
  console.log(`✓ Authentication successful for test user: ${testUserId}`);
  console.log(`  Authenticated URL: ${url}`);
});

