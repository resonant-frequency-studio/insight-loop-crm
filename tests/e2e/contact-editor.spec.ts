import { test, expect } from "./fixtures/auth";
import { Page } from "@playwright/test";
import {
  createTestContact,
  createTestContactWithTouchpoint,
  deleteTestContact,
} from "./helpers/test-data";
import {
  expectContactInList,
  expectContactNotInList,
  expectTouchpointOnDashboard,
  expectTouchpointNotOnDashboard,
  expectTouchpointStatus,
} from "./helpers/assertions";

/**
 * E2E Integration Tests for Contact Editor
 * 
 * These tests focus on integration scenarios that unit tests cannot cover:
 * - Cross-page data consistency (changes on one page reflect on another)
 * - Cache invalidation and optimistic updates across pages
 * - Multi-step user workflows spanning multiple pages
 * 
 * Component-level functionality (form fields, buttons, modals) is tested
 * in unit tests and not duplicated here.
 * 
 * Note: Contact forms use auto-save on blur (debounced), not manual save buttons.
 */

/**
 * Helper to edit and save a field using auto-save on blur
 */
async function editFieldAndSave(page: Page, selector: string, newValue: string) {
  const input = page.locator(selector).first();
  await input.waitFor({ state: "visible" });
  
  // Clear existing value
  await input.clear();
  await page.waitForTimeout(100); // Small delay after clear
  
  // Fill new value
  await input.fill(newValue);
  await page.waitForTimeout(100); // Small delay after fill
  
  // Trigger blur to trigger auto-save
  await input.blur();
  
  // Wait for save to complete (debounce 500ms + save operation + buffer)
  await page.waitForTimeout(2000);
}

test.describe("Cross-Page Data Consistency", () => {
  test("touchpoint status changes sync with Dashboard", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_crosspage_${Date.now()}@test.example.com`;
    // Create touchpoint with date in the past so it appears in "Overdue Touchpoints"
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail, -1);

    try {
      // Step 1: Navigate to contact detail page
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      // Step 2: Mark touchpoint as contacted
      const markContactedButton = authenticatedPage.locator('button:has-text("Mark as Contacted")').first();
      await markContactedButton.waitFor({ state: "visible" });
      
      // Click button and wait for modal to appear (it's rendered via portal)
      await markContactedButton.click();
      
      // Wait for modal to appear - it's rendered via createPortal so may take a moment
      const modal = authenticatedPage.locator('[role="dialog"]').filter({ 
        hasText: /Mark as Contacted|Mark the touchpoint/ 
      });
      await modal.waitFor({ state: "visible" });
      
      // Find the confirm button inside the modal
      const confirmButton = modal.locator('button:has-text("Mark as Contacted"), button:has-text("Mark Completed")')
        .filter({ hasNotText: "Cancel" })
        .first();
      
      // Wait for the confirm button to be visible and enabled
      await confirmButton.waitFor({ state: "visible" });
      
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/touchpoint-status') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        confirmButton.click(),
      ]);
      
      await modal.waitFor({ state: "hidden" }).catch(() => {});
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "completed");

      // Step 3: Navigate to Dashboard - verify touchpoint removed
      // Note: Touchpoint sections may not exist in DOM if all touchpoints are completed
      // The assertion helper will check if email appears in touchpoint sections (if they exist)
      await authenticatedPage.getByRole('link', { name: 'Dashboard' }).click();
      // Wait for dashboard to load (Recent Contacts or other sections)
      await authenticatedPage.waitForURL(/\/$/);
      await expect(authenticatedPage.getByText("Overdue")).not.toBeVisible();
      await expect(authenticatedPage.getByText("Upcoming Touchpoints")).not.toBeVisible();

      // Step 4: Navigate back to contact and restore
      await authenticatedPage.getByRole('link', { name: 'Test Contact' }).click();
      await authenticatedPage.waitForURL(/\/contacts\/.+/);
      
      const restoreButton = authenticatedPage.locator('button:has-text("Restore to Pending")').first();
      await restoreButton.waitFor({ state: "visible" });
      
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/touchpoint-status') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        restoreButton.click(),
      ]);
      
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "pending");

      // Step 5: Navigate to Dashboard again - verify touchpoint reappears
      // After restoring, the touchpoint should appear in touchpoint sections
      await authenticatedPage.getByRole('link', { name: 'Dashboard' }).click();
      // Wait for dashboard to load
      await authenticatedPage.waitForURL(/\/$/);
      await expect(authenticatedPage.getByText("Today's Priorities")).toBeVisible();
      await expect(authenticatedPage.getByText("Overdue").first()).toBeVisible();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("contact changes reflect on Contacts list", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_list_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Original",
      lastName: "Name",
    });

    try {
      // Step 1: Edit contact on detail page (auto-saves on blur)
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      // Edit first name - will auto-save on blur
      await Promise.all([
        editFieldAndSave(authenticatedPage, 'input#contact-first-name, input[id*="contact-first"], input[placeholder="First Name"]', "Updated"),
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
      ]);
      
      await authenticatedPage.waitForTimeout(500);

      // Step 2: Navigate to Contacts list - verify updated name appears
      await authenticatedPage.getByRole('link', { name: 'Contacts' }).first().click();
      await authenticatedPage.waitForURL(/\/contacts/);
      
      await expect(authenticatedPage.locator('text="Updated Name"')).toBeVisible();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("archived contacts are filtered from Contacts list", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_archive_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Original",
      lastName: "Name",
      archived: false,
    });

    try {
      // Step 1: Archive contact on detail page
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      const archiveButton = authenticatedPage.locator('button:has-text("Archive Contact")').first();
      await archiveButton.waitFor({ state: "visible" });
      
      // Wait for API response when archiving
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/archive') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        archiveButton.click(),
      ]);

      // Wait for button text to change (indicates archive succeeded)
      await authenticatedPage.waitForSelector('button:has-text("Unarchive Contact")');

      await authenticatedPage.getByRole('link', { name: 'Contacts' }).first().click();
      await authenticatedPage.waitForURL(/\/contacts/);
      await expect(authenticatedPage.locator('text="No contacts match your filters"')).toBeVisible();
      await authenticatedPage.getByLabel("Show archived contacts").click();
      await expect(authenticatedPage.locator('text="Original Name"')).toBeVisible();
      // Step 3: Go back and unarchive
      await authenticatedPage.getByRole('link', { name: 'Original Name' }).click();
      await authenticatedPage.waitForURL(/\/contacts\/.+/);
      
      const unarchiveButton = authenticatedPage.locator('button:has-text("Unarchive Contact")').first();
      await unarchiveButton.waitFor({ state: "visible" });
      
      // Wait for API response when unarchiving
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/archive') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        unarchiveButton.click(),
      ]);
      
      await expect(authenticatedPage.locator('button:has-text("Archive Contact")')).toBeVisible();
      await expect(authenticatedPage.locator('text="Original Name"')).toBeVisible();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("Complete User Workflows", () => {
  test("full contact lifecycle: create → edit → archive → delete", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_lifecycle_${Date.now()}@test.example.com`;
    let contactId: string | null = null;

    try {
      // Step 1: Create contact
      contactId = await createTestContact(testUserId, {
        primaryEmail: testEmail,
        firstName: "Lifecycle",
        lastName: "Test",
      });

      await authenticatedPage.getByRole('button', { name: 'Toggle Contacts submenu' }).click();
      await authenticatedPage.getByRole('link', { name: 'Add Contact'}).click();

      // Edit first name - auto-saves on blur
      await Promise.all([
        editFieldAndSave(authenticatedPage, 'input#contact-first-name, input[id*="contact-first"], input[placeholder="First Name"]', "Updated Lifecycle"),
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
      ]);

      await authenticatedPage.waitForURL(/\/contacts\/.+/);
      
      const firstNameInput = authenticatedPage.locator('input#contact-first-name, input[id*="contact-first"], input[placeholder="First Name"]').first();
      await expect(firstNameInput).toHaveValue("Updated Lifecycle");

      // Step 3: Archive contact
      const archiveButton2 = authenticatedPage.locator('button:has-text("Archive Contact")').first();
      await archiveButton2.waitFor({ state: "visible" });
      
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/archive') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        archiveButton2.click(),
      ]);
      
      await authenticatedPage.waitForSelector('button:has-text("Unarchive Contact")');

      // Verify archived in list
      await authenticatedPage.getByRole('link', { name: 'Contacts' }).first().click();
      await authenticatedPage.waitForURL(/\/contacts/);
      await expect(authenticatedPage.locator('text="No contacts match your filters"')).toBeVisible();
      await authenticatedPage.getByLabel("Show archived contacts").click();
      await expect(authenticatedPage.locator('text="Updated Lifecycle Test"')).toBeVisible();
      // Step 3: Go back and unarchive
      await authenticatedPage.getByRole('link', { name: 'Updated Lifecycle Test' }).click();
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      // Step 4: Delete contact (must go back to detail page)
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      const deleteButton = authenticatedPage.locator('button:has-text("Delete Contact")').first();
      await deleteButton.waitFor({ state: "visible" });
      await deleteButton.click();

      // Confirm deletion - wait for modal
      const deleteModal = authenticatedPage.locator('[role="dialog"]').filter({ hasText: /Are you sure|Delete Contact/ }).first();
      await deleteModal.waitFor({ state: "visible" });
      
      // Click the Delete button in the modal
      const confirmDeleteButton = deleteModal
        .locator('button:has-text("Delete")')
        .filter({ hasNotText: "Cancel" })
        .first();
      await confirmDeleteButton.waitFor({ state: "visible" });
      
      // Wait for delete API call and redirect
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            // DELETE request to contact endpoint
            return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
        authenticatedPage.waitForURL(/\/contacts/, { timeout: 10000 }),
        confirmDeleteButton.click(),
      ]);
      await expect(authenticatedPage.locator('text="No contacts match your filters"')).toBeVisible();
      // Contact was deleted, skip cleanup
      contactId = null;
    } finally {
      if (contactId) {
        try {
          await deleteTestContact(testUserId, contactId);
        } catch {
          // Expected if contact was deleted
        }
      }
    }
  });

  test("touchpoint workflow: create → mark completed → restore → verify Dashboard sync", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_touchpoint_workflow_${Date.now()}@test.example.com`;
    // Create touchpoint with date in the past so it appears in "Overdue Touchpoints"
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail, -1);

    try {
      // Step 1: Verify touchpoint appears on Dashboard
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);

      // Step 2: Navigate to contact and mark as contacted
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      const markContactedButton2 = authenticatedPage.locator('button:has-text("Mark as Contacted")').first();
      await markContactedButton2.waitFor({ state: "visible" });
      await markContactedButton2.click();
      
      // Wait for modal to appear - it's rendered via createPortal so may take a moment
      const modal2 = authenticatedPage.locator('[role="dialog"]').filter({ 
        hasText: /Mark as Contacted|Mark the touchpoint/ 
      });
      await modal2.waitFor({ state: "visible" });
      
      // Find the confirm button inside the modal (can be "Mark as Contacted" or "Mark Completed")
      const confirmButton2 = modal2.locator('button:has-text("Mark as Contacted"), button:has-text("Mark Completed")')
        .filter({ hasNotText: "Cancel" })
        .first();
      
      // Wait for the confirm button to be visible and enabled
      await confirmButton2.waitFor({ state: "visible" });
      
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/touchpoint-status') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        confirmButton2.click(),
      ]);
      
      await modal2.waitFor({ state: "hidden" }).catch(() => {});

      // Wait for status update
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "completed");

      // Step 3: Verify removed from Dashboard
      await expectTouchpointNotOnDashboard(authenticatedPage, testEmail);

      // Step 4: Restore to pending
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.waitForURL(/\/contacts\/.+/);

      const restoreButton5 = authenticatedPage.locator('button:has-text("Restore to Pending")').first();
      await restoreButton5.waitFor({ state: "visible" });
      
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/touchpoint-status') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        restoreButton5.click(),
      ]);
      
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "pending");

      // Step 5: Verify back on Dashboard
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});
