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
 */
export async function expectTouchpointOnDashboard(
  page: Page,
  contactEmail: string
): Promise<void> {
  await page.goto("/");

  // Wait for dashboard to load
  await page.waitForSelector('text="Upcoming Touchpoints", text="Overdue Touchpoints"', {
    timeout: 10000,
  });

  const emailVisible = await page
    .getByText(contactEmail, { exact: false })
    .isVisible()
    .catch(() => false);

  expect(emailVisible).toBe(true);
}

/**
 * Verifies a touchpoint does NOT appear on the Dashboard
 */
export async function expectTouchpointNotOnDashboard(
  page: Page,
  contactEmail: string
): Promise<void> {
  await page.goto("/");

  await page.waitForSelector('text="Upcoming Touchpoints", text="Overdue Touchpoints"', {
    timeout: 10000,
  });

  // Wait a bit to ensure the list has rendered
  await page.waitForTimeout(1000);

  const emailVisible = await page
    .getByText(contactEmail, { exact: false })
    .isVisible()
    .catch(() => false);

  expect(emailVisible).toBe(false);
}

/**
 * Verifies touchpoint status badge is displayed
 */
export async function expectTouchpointStatus(
  page: Page,
  status: "pending" | "completed" | "cancelled"
): Promise<void> {
  const statusTexts = {
    pending: "Pending",
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

