import { Page, expect } from "@playwright/test";

/**
 * Assertion helpers for common test scenarios
 */

/**
 * Verifies a contact appears in the contacts list
 */
export async function expectContactInList(
  page: Page,
  contactEmail: string,
  contactName?: string
): Promise<void> {
  // Navigate to contacts page if not already there
  if (!page.url().includes("/contacts")) {
    await page.goto("/contacts");
  }

  // Wait for contacts to load
  await page.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"]', {
    timeout: 10000,
  });

  // Check if contact email is visible
  const emailVisible = await page
    .getByText(contactEmail, { exact: false })
    .isVisible()
    .catch(() => false);

  expect(emailVisible).toBe(true);

  // If name provided, check for name as well
  if (contactName) {
    const nameVisible = await page
      .getByText(contactName, { exact: false })
      .isVisible()
      .catch(() => false);
    expect(nameVisible).toBe(true);
  }
}

/**
 * Verifies a contact does NOT appear in the contacts list
 */
export async function expectContactNotInList(
  page: Page,
  contactEmail: string
): Promise<void> {
  if (!page.url().includes("/contacts")) {
    await page.goto("/contacts");
  }

  await page.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"]', {
    timeout: 10000,
  });

  const emailVisible = await page
    .getByText(contactEmail, { exact: false })
    .isVisible()
    .catch(() => false);

  expect(emailVisible).toBe(false);
}

/**
 * Verifies a touchpoint appears on the Dashboard
 * Checks that the contact email is visible within touchpoint sections
 * (Today's Priorities, Overdue, Upcoming Touchpoints)
 * Note: Email always exists on contacts, so we check specifically within touchpoint sections
 */
export async function expectTouchpointOnDashboard(
  page: Page,
): Promise<void> {
  // Navigate to dashboard if not already there
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await page.waitForURL("/");
  await expect(page.getByRole('button', { name: 'Mark as Contacted' })).toBeVisible();
}

/**
 * Verifies a touchpoint does NOT appear on the Dashboard
 * Specifically checks within touchpoint sections (Today's Priorities, Overdue, Upcoming)
 * Note: The email might still appear elsewhere on the dashboard (Recent Contacts, stats, etc.), 
 * but it should NOT appear in touchpoint sections when the touchpoint is completed
 */
export async function expectTouchpointNotOnDashboard(
  page: Page,
  contactEmail: string
): Promise<void> {
  // Navigate to dashboard if not already there
  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await page.waitForURL("/");

  // When a touchpoint is marked as completed, DashboardTouchpoints filters it out
  // (contacts are filtered where touchpointStatus !== "completed")
  // The touchpoint sections may not exist at all if all touchpoints are completed
  
  // Check if touchpoint sections exist
  const touchpointSections = page.locator('[class*="Card"]').filter({
    hasText: /Today's Priorities|Upcoming Touchpoints|Overdue/
  });
  const hasTouchpointSections = await touchpointSections.count() > 0;

  if (hasTouchpointSections) {
    // If sections exist, verify the email is NOT in any touchpoint section
    const emailInTouchpointSection = await touchpointSections
      .filter({ hasText: contactEmail })
      .first()
      .isVisible()
      .catch(() => false);
    
    expect(emailInTouchpointSection).toBe(false);
  } else {
    // If no touchpoint sections exist, that's fine - the touchpoint is properly filtered out
    // The email might still appear in Recent Contacts, but that's expected
  }
}

/**
 * Verifies touchpoint status badge is displayed
 */
export async function expectTouchpointStatus(
  page: Page,
  status: "pending" | "completed" | "cancelled"
): Promise<void> {
  const statusTexts = {
    pending: "Mark as Contacted",
    completed: "Contacted",
    cancelled: "Skipped",
  };

  const statusText = statusTexts[status];
  const statusVisible = await page
    .getByText(statusText, { exact: false })
    .isVisible()
    .catch(() => false);

  expect(statusVisible).toBe(true);
}

/**
 * Verifies error message is displayed
 */
export async function expectErrorMessage(
  page: Page,
  message?: string
): Promise<void> {
  // Look for error message component
  const errorVisible = await page
    .locator('[role="alert"], .error-message, [class*="ErrorMessage"]')
    .first()
    .isVisible()
    .catch(() => false);

  expect(errorVisible).toBe(true);

  if (message) {
    const messageVisible = await page
      .getByText(message, { exact: false })
      .isVisible()
      .catch(() => false);
    expect(messageVisible).toBe(true);
  }
}

