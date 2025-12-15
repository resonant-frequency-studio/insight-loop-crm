import { test, expect } from "./fixtures/auth";
import {
  createTestContact,
  createTestContactWithTouchpoint,
  deleteTestContact,
} from "./helpers/test-data";
import {
  expectContactInList,
  expectContactNotInList,
  expectTouchpointOnDashboard,
} from "./helpers/assertions";

/**
 * E2E Tests for Complete Contact Lifecycle Workflows
 * 
 * These tests verify end-to-end user journeys that span multiple pages
 * and operations, ensuring data consistency throughout the workflow.
 */

import { Page } from "@playwright/test";

/**
 * Helper to wait for contact page to fully load
 */
async function waitForContactPage(page: Page) {
  // Wait for DOM to be ready
  await page.waitForLoadState("domcontentloaded");
  
  // Wait for contact form to be visible - try multiple selectors
  try {
    await page.waitForSelector('input[type="email"], input[id*="email"], input[placeholder*="First Name"], input[placeholder*="first"]', { 
      timeout: 15000 
    });
  } catch {
    // Fallback: wait for any input or the page structure
    await page.waitForSelector('input, form, [class*="Card"]', { timeout: 10000 });
  }
  
  // Wait for React to hydrate - check for interactive elements
  await page.waitForFunction(
    () => document.querySelector('input, button') !== null,
    { timeout: 10000 }
  ).catch(() => {
    // Continue even if function wait fails
  });
  
  // Small delay to ensure React hydration is complete
  await page.waitForTimeout(500);
}

test.describe("Contact Lifecycle Workflows", () => {
  test("complete workflow: view → edit → archive → view archived → unarchive → delete", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_full_workflow_${Date.now()}@test.example.com`;
    let contactId: string | null = null;

    try {
      // Step 1: Create contact
      contactId = await createTestContact(testUserId, {
        primaryEmail: testEmail,
        firstName: "Workflow",
        lastName: "Test",
        tags: ["important"],
        segment: "Prospect",
      });

      // Step 2: View contact and verify initial data
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`);
      await waitForContactPage(authenticatedPage);

      await expect(authenticatedPage.locator('text="Workflow"')).toBeVisible({ timeout: 5000 });
      await expect(authenticatedPage.locator('text="Test"')).toBeVisible({ timeout: 5000 });

      // Step 3: Edit contact fields (auto-saves on blur)
      const firstNameInput = authenticatedPage.locator('input[placeholder*="First Name"], input[id*="first-name"]').first();
      await firstNameInput.waitFor({ state: "visible", timeout: 5000 });
      await firstNameInput.clear();
      await firstNameInput.fill("Updated Workflow");
      await firstNameInput.blur();
      
      // Wait for save to complete
      await authenticatedPage.waitForResponse(
        (resp) => {
          const url = resp.url();
          return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
        },
        { timeout: 10000 }
      ).catch(() => null);
      
      await authenticatedPage.waitForTimeout(1000);

      const lastNameInput = authenticatedPage.locator('input[placeholder*="Last Name"], input[id*="last-name"]').first();
      await lastNameInput.waitFor({ state: "visible", timeout: 5000 });
      await lastNameInput.clear();
      await lastNameInput.fill("Updated Test");
      await lastNameInput.blur();
      
      // Wait for save to complete
      await authenticatedPage.waitForResponse(
        (resp) => {
          const url = resp.url();
          return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
        },
        { timeout: 10000 }
      ).catch(() => null);
      
      await authenticatedPage.waitForTimeout(1000);

      // Verify changes persisted (reload page)
      await authenticatedPage.reload({ waitUntil: "domcontentloaded" });
      await waitForContactPage(authenticatedPage);
      
      const firstNameInputReloaded = authenticatedPage.locator('input[placeholder*="First Name"], input[id*="first-name"]').first();
      await expect(firstNameInputReloaded).toHaveValue("Updated Workflow", { timeout: 10000 });
      
      const lastNameInputReloaded = authenticatedPage.locator('input[placeholder*="Last Name"], input[id*="last-name"]').first();
      await expect(lastNameInputReloaded).toHaveValue("Updated Test", { timeout: 10000 });

      // Step 4: Archive contact
      const archiveBtn = authenticatedPage.locator('button:has-text("Archive Contact")').first();
      await archiveBtn.waitFor({ state: "visible", timeout: 15000 });
      
      // Wait for API response when archiving
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/archive') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        archiveBtn.click(),
      ]);
      
      await authenticatedPage.waitForSelector('button:has-text("Unarchive Contact")', { timeout: 5000 });

      // Step 5: Verify archived contact is hidden from main list
      await authenticatedPage.goto("/contacts");
      await authenticatedPage.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"], a[href*="/contacts/"]', {
        timeout: 15000,
      });
      await authenticatedPage.waitForLoadState("domcontentloaded");
      await authenticatedPage.waitForTimeout(500);
      await expectContactNotInList(authenticatedPage, testEmail);

      // Step 6: Access archived contact directly via URL (still accessible)
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`);
      await waitForContactPage(authenticatedPage);
      
      // Should still see contact data
      await expect(authenticatedPage.locator('text="Updated Workflow"')).toBeVisible({ timeout: 5000 });

      // Step 7: Unarchive contact
      const unarchiveBtn = authenticatedPage.locator('button:has-text("Unarchive Contact")').first();
      await unarchiveBtn.waitFor({ state: "visible", timeout: 15000 });
      
      // Wait for API response when unarchiving
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => resp.url().includes('/api/contacts/') && resp.url().includes('/archive') && resp.status() === 200,
          { timeout: 10000 }
        ).catch(() => null),
        unarchiveBtn.click(),
      ]);
      
      await authenticatedPage.waitForSelector('button:has-text("Archive Contact")', { timeout: 5000 });

      // Step 8: Verify contact reappears in list
      await authenticatedPage.goto("/contacts");
      await authenticatedPage.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"], a[href*="/contacts/"]', {
        timeout: 15000,
      });
      await authenticatedPage.waitForLoadState("domcontentloaded");
      await authenticatedPage.waitForTimeout(500);
      await expectContactInList(authenticatedPage, testEmail);

      // Step 9: Delete contact
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`);
      await waitForContactPage(authenticatedPage);

      const deleteBtn = authenticatedPage.locator('button:has-text("Delete Contact")').first();
      await deleteBtn.waitFor({ state: "visible", timeout: 15000 });
      await deleteBtn.click();

      // Confirm deletion - wait for modal
      const deleteModal = authenticatedPage.locator('[role="dialog"]').filter({ hasText: /Are you sure|Delete Contact/ }).first();
      await deleteModal.waitFor({ state: "visible", timeout: 5000 });
      
      // Click the Delete button in the modal
      const confirmDeleteBtn = deleteModal
        .locator('button:has-text("Delete")')
        .filter({ hasNotText: "Cancel" })
        .first();
      await confirmDeleteBtn.waitFor({ state: "visible", timeout: 5000 });
      
      // Wait for delete API call and redirect
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            // DELETE request to contact endpoint (not a sub-route)
            return url.includes('/api/contacts/') && !url.includes('/touchpoint-status') && !url.includes('/archive') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
        authenticatedPage.waitForURL(/\/contacts/, { timeout: 10000 }),
        confirmDeleteBtn.click(),
      ]);

      // Verify redirect and deletion
      await authenticatedPage.waitForURL(/\/contacts/, { timeout: 5000 });
      await expectContactNotInList(authenticatedPage, testEmail);

      contactId = null; // Mark as deleted
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

  test("touchpoint management workflow: create → view on Dashboard → complete → restore", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_touchpoint_mgmt_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail);

    try {
      // Step 1: Verify touchpoint appears on Dashboard
      await authenticatedPage.goto("/");
      await authenticatedPage.waitForSelector('text="Upcoming Touchpoints", text="Overdue Touchpoints"', { timeout: 10000 });
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);

      // Step 2: View contact detail page
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`);
      await waitForContactPage(authenticatedPage);

      // Verify touchpoint status shows as pending
      await authenticatedPage.waitForSelector('button:has-text("Mark as Contacted")', { timeout: 10000 });

      // Step 3: Mark as contacted with reason
      const markContactedBtn = authenticatedPage.locator('button:has-text("Mark as Contacted")').first();
      await markContactedBtn.waitFor({ state: "visible", timeout: 15000 });
      await markContactedBtn.click();
      
      // Wait for modal to appear
      const modal = authenticatedPage.locator('[role="dialog"]').first();
      await modal.waitFor({ state: "visible", timeout: 5000 });
      
      // Add reason in modal if visible
      const reasonTextarea = modal.locator('textarea[placeholder*="note"], textarea[placeholder*="Note"]').first();
      if (await reasonTextarea.isVisible().catch(() => false)) {
        await reasonTextarea.fill("E2E test completion");
      }

      // Confirm - find button within modal
      const confirmButton = modal.locator('button:has-text("Mark as Contacted"):not(:has-text("Cancel"))').first();
      await confirmButton.waitFor({ state: "visible", timeout: 5000 });
      
      // Wait for API response when confirming
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            return url.includes('/api/contacts/') && url.includes('/touchpoint-status') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
        confirmButton.click(),
      ]);
      
      // Wait for modal to close
      await modal.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});

      // Verify status updated
      await authenticatedPage.waitForTimeout(500);
      await expect(authenticatedPage.locator('text="Contacted", text="completed", text="Restore to Pending"').first()).toBeVisible({ timeout: 10000 });

      // Step 4: Verify Dashboard updated (touchpoint removed)
      await authenticatedPage.goto("/");
      await authenticatedPage.waitForSelector('text="Upcoming Touchpoints", text="Overdue Touchpoints"', { timeout: 10000 });
      
      // Wait a moment for cache to update
      await authenticatedPage.waitForTimeout(1000);
      
      const emailVisible = await authenticatedPage
        .getByText(testEmail, { exact: false })
        .isVisible()
        .catch(() => false);
      
      expect(emailVisible).toBe(false);

      // Step 5: Restore touchpoint to pending
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`);
      await waitForContactPage(authenticatedPage);

      const restoreBtn = authenticatedPage.locator('button:has-text("Restore to Pending")').first();
      await restoreBtn.waitFor({ state: "visible", timeout: 15000 });
      
      // Wait for API response when restoring
      await Promise.all([
        authenticatedPage.waitForResponse(
          (resp) => {
            const url = resp.url();
            return url.includes('/api/contacts/') && url.includes('/touchpoint-status') && resp.status() === 200;
          },
          { timeout: 10000 }
        ).catch(() => null),
        restoreBtn.click(),
      ]);
      
      await authenticatedPage.waitForTimeout(500);

      // Verify status back to pending
      await authenticatedPage.waitForSelector('button:has-text("Mark as Contacted")', { timeout: 5000 });

      // Step 6: Verify Dashboard updated (touchpoint reappears)
      await authenticatedPage.goto("/");
      await authenticatedPage.waitForSelector('text="Upcoming Touchpoints", text="Overdue Touchpoints"', { timeout: 10000 });
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("multi-contact workflow: create multiple contacts → verify list updates", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmails = [
      `test_multi_1_${Date.now()}@test.example.com`,
      `test_multi_2_${Date.now()}@test.example.com`,
      `test_multi_3_${Date.now()}@test.example.com`,
    ];
    const contactIds: string[] = [];

    try {
      // Step 1: Create multiple contacts
      for (const email of testEmails) {
        const contactId = await createTestContact(testUserId, {
          primaryEmail: email,
          firstName: `Contact${testEmails.indexOf(email) + 1}`,
        });
        contactIds.push(contactId);
      }

      // Step 2: Navigate to contacts list
      await authenticatedPage.goto("/contacts");
      
      // Wait for contacts to load - use multiple fallback selectors
      await authenticatedPage.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"], a[href*="/contacts/"]', {
        timeout: 15000,
      });
      
      // Wait for page to fully load
      await authenticatedPage.waitForLoadState("domcontentloaded");
      await authenticatedPage.waitForTimeout(1000); // Give time for React to render cards

      // Step 3: Verify all contacts appear
      for (const email of testEmails) {
        await expect(authenticatedPage.getByText(email, { exact: false })).toBeVisible({ timeout: 10000 });
      }

      // Step 4: Archive one contact
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactIds[0])}`);
      await waitForContactPage(authenticatedPage);
      
      await authenticatedPage.waitForSelector('button:has-text("Archive Contact")', { timeout: 10000 });
      await authenticatedPage.click('button:has-text("Archive Contact")');
      await authenticatedPage.waitForSelector('button:has-text("Unarchive Contact")', { timeout: 5000 });

      // Step 5: Verify only 2 contacts remain in list
      await authenticatedPage.goto("/contacts");
      await authenticatedPage.waitForSelector('[data-testid="contact-card"], .contact-card, [class*="ContactCard"], a[href*="/contacts/"]', {
        timeout: 15000,
      });
      await authenticatedPage.waitForLoadState("domcontentloaded");
      await authenticatedPage.waitForTimeout(500);
      
      await expectContactNotInList(authenticatedPage, testEmails[0]);
      await expectContactInList(authenticatedPage, testEmails[1]);
      await expectContactInList(authenticatedPage, testEmails[2]);
    } finally {
      // Cleanup all contacts
      for (const contactId of contactIds) {
        try {
          await deleteTestContact(testUserId, contactId);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
  });
});
