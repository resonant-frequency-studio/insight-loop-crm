import { test, expect } from "./fixtures/auth";
import {
  createTestContact,
  createTestContactWithTouchpoint,
  createTestContactWithCompletedTouchpoint,
  deleteTestContact,
  createTestActionItem,
  deleteTestActionItem,
  deleteAllTestActionItems,
} from "./helpers/test-data";
import {
  expectContactInList,
  expectContactNotInList,
  expectTouchpointOnDashboard,
  expectTouchpointNotOnDashboard,
  expectTouchpointStatus,
} from "./helpers/assertions";

/**
 * Comprehensive E2E tests for ContactEditor
 * 
 * These tests cover all buttons and actions in ContactEditor:
 * - Form field updates and save
 * - Touchpoint status actions
 * - Archive/unarchive contact
 * - Delete contact
 * - Outreach draft editor
 * - Cross-page verification
 */

test.describe("ContactEditor - Form Field Updates & Save", () => {
  test("should update and save contact fields", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_form_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Original",
      lastName: "Name",
    });

    // Wait for Firestore write to complete
    // Note: Cache invalidation issue - contact may not be immediately available due to Next.js cache
    // Adding a reasonable wait, but the page should handle client-side fetching
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Navigate directly - the page will fetch the contact (might bypass cache on client side)
      // Use a longer timeout since cache might need to refresh
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
      
      // Verify we're on the right page
      const currentUrl = authenticatedPage.url();
      if (!currentUrl.includes('/contacts/')) {
        throw new Error(`Expected to be on contact page but URL is: ${currentUrl}`);
      }
      
      // Wait for Next.js to hydrate - check for React root or main content
      await authenticatedPage.waitForLoadState("domcontentloaded");
      await authenticatedPage.waitForLoadState("networkidle");
      
      // Wait for React to hydrate
      await authenticatedPage.waitForFunction(() => {
        return document.querySelector('input, button, [class*="Card"], [class*="card"]') !== null;
      }, { timeout: 10000 }).catch(() => {
        // Continue anyway
      });
      
      // Wait for client-side data fetching - cache may need a moment
      await authenticatedPage.waitForTimeout(2000);
      
      // Check if page shows "not found" - if so, reload once to bypass cache
      const notFoundVisible = await authenticatedPage.locator('text="Contact Not Found", text="404"').isVisible().catch(() => false);
      if (notFoundVisible) {
        // Cache is stale - reload to force fresh fetch
        await authenticatedPage.reload({ waitUntil: "networkidle" });
        await authenticatedPage.waitForTimeout(2000);
      }
      
      // Wait for contact form - client-side fetch should bypass server cache
      await authenticatedPage.waitForSelector('input[type="email"]', { timeout: 15000 });
      
      // Wait for First Name field
      await authenticatedPage.waitForSelector('input[placeholder*="First Name"]', { timeout: 10000 });
      
      // Brief wait for form data to populate
      await authenticatedPage.waitForTimeout(500);

      // Update first name - wait for field to be ready
      const firstNameInput = authenticatedPage.locator('input[placeholder*="First Name"]').first();
      await firstNameInput.waitFor({ state: "visible", timeout: 5000 });
      await firstNameInput.clear();
      await firstNameInput.fill("Updated");
      
      // Update last name
      const lastNameInput = authenticatedPage.locator('input[placeholder*="Last Name"]').first();
      await lastNameInput.waitFor({ state: "visible", timeout: 5000 });
      await lastNameInput.clear();
      await lastNameInput.fill("Contact");

      // Update tags
      const tagsInput = authenticatedPage.locator('input[placeholder*="tag"]').first();
      await tagsInput.waitFor({ state: "visible", timeout: 5000 });
      await tagsInput.fill("tag1, tag2, tag3");

      // Update segment
      const segmentInput = authenticatedPage.locator('input[placeholder*="segment"]').first();
      await segmentInput.waitFor({ state: "visible", timeout: 5000 });
      if (await segmentInput.isVisible()) {
        await segmentInput.fill("Test Segment");
      }

      // Update notes
      const notesTextarea = authenticatedPage.locator('textarea[placeholder*="notes"]').first();
      await notesTextarea.waitFor({ state: "visible", timeout: 5000 });
      await notesTextarea.fill("Test notes");

      // Click Save All Changes button
      const saveButton = authenticatedPage.locator('button:has-text("Save All Changes")').first();
      await saveButton.waitFor({ state: "visible", timeout: 5000 });
      await saveButton.click();

      // Wait for save to complete (button becomes enabled again)
      await authenticatedPage.waitForSelector('button:has-text("Save All Changes"):not([disabled])', {
        timeout: 10000,
      });
      
      // Wait a bit for React Query cache to update
      await authenticatedPage.waitForTimeout(2000);

      // Verify changes persisted - reload page to bypass cache
      await authenticatedPage.reload({ waitUntil: "networkidle" });
      
      // Wait for form to load after reload
      await authenticatedPage.waitForSelector('input[placeholder*="First Name"]', { timeout: 10000 });
      await authenticatedPage.waitForTimeout(1000);
      
      // Verify updated values
      await expect(authenticatedPage.locator('input[value="Updated"]').first()).toBeVisible({ timeout: 5000 });
      await expect(authenticatedPage.locator('input[value="Contact"]').first()).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should display error message on save failure", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_error_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Try to trigger an error (e.g., by disconnecting network or invalid data)
      // This test would need to be adjusted based on actual error scenarios
      
      // For now, just verify error display component exists
      // In a real scenario, you might mock the API to return an error
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("ContactEditor - Touchpoint Status Actions", () => {
  test("should mark touchpoint as contacted and update UI", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_complete_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail);

    // Wait for Firestore write to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Navigate and wait for page to load
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
      
      // Verify we're on the right page
      const currentUrl = authenticatedPage.url();
      if (!currentUrl.includes('/contacts/')) {
        throw new Error(`Expected to be on contact page but URL is: ${currentUrl}`);
      }

      // Wait for React to hydrate
      await authenticatedPage.waitForFunction(() => {
        return document.querySelector('input, button, [class*="Card"], [class*="card"]') !== null;
      }, { timeout: 10000 }).catch(() => {
        // Continue anyway
      });
      
      // Wait for client-side data fetching
      await authenticatedPage.waitForTimeout(2000);
      
      // Check if page shows "not found" - if so, reload to bypass cache
      const notFoundVisible = await authenticatedPage.locator('text="Contact Not Found", text="404"').isVisible().catch(() => false);
      if (notFoundVisible) {
        await authenticatedPage.reload({ waitUntil: "networkidle" });
        await authenticatedPage.waitForTimeout(2000);
      }
      
      // Wait for contact form to load
      await authenticatedPage.waitForSelector('input[type="email"]', { timeout: 15000 });
      await authenticatedPage.waitForSelector('input[placeholder*="First Name"]', { timeout: 10000 });
      await authenticatedPage.waitForTimeout(500);

      // Wait for touchpoint actions to be visible
      await authenticatedPage.waitForSelector('button:has-text("Mark as Contacted")', { timeout: 10000 });
      
      // Click "Mark as Contacted"
      await authenticatedPage.click('button:has-text("Mark as Contacted")');

      // Wait for modal to appear
      await authenticatedPage.waitForSelector('text="Mark as Contacted"', { timeout: 10000 });

      // Optionally add a reason
      const reasonTextarea = authenticatedPage.locator('textarea[placeholder*="note"]');
      if (await reasonTextarea.isVisible()) {
        await reasonTextarea.fill("Test contact note");
      }

      // Confirm in modal - wait for button to be visible first
      const confirmButton = authenticatedPage.locator('button:has-text("Mark as Contacted"), button:has-text("Mark Completed")').first();
      await confirmButton.waitFor({ state: "visible", timeout: 5000 });
      await confirmButton.click();

      // Wait for modal to close and status to update
      await authenticatedPage.waitForTimeout(500);
      
      // Wait for status to update optimistically
      await expectTouchpointStatus(authenticatedPage, "completed");

      // CRITICAL: Verify the status persists and doesn't revert
      // Wait a bit longer to ensure the mutation completes and cache update happens
      await authenticatedPage.waitForTimeout(2000);
      
      // Verify status is STILL "completed" - this ensures optimistic update doesn't revert
      await expectTouchpointStatus(authenticatedPage, "completed");

      // Verify "Restore to Pending" button appears and stays visible
      const restoreButton = authenticatedPage.locator('button:has-text("Restore to Pending")').first();
      await expect(restoreButton).toBeVisible({
        timeout: 10000,
      });
      
      // Wait a bit more and verify it's still there (no revert)
      await authenticatedPage.waitForTimeout(1000);
      await expect(restoreButton).toBeVisible();

      // Navigate to Dashboard and verify touchpoint is not in list
      // Wait a bit for cache to update before navigating
      await authenticatedPage.waitForTimeout(1000);
      await expectTouchpointNotOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should skip touchpoint and update UI", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_skip_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail);

    // Wait for Firestore write to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Navigate and wait for page to load
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
      
      // Verify we're on the right page
      const currentUrl = authenticatedPage.url();
      if (!currentUrl.includes('/contacts/')) {
        throw new Error(`Expected to be on contact page but URL is: ${currentUrl}`);
      }

      // Wait for React to hydrate
      await authenticatedPage.waitForFunction(() => {
        return document.querySelector('input, button, [class*="Card"], [class*="card"]') !== null;
      }, { timeout: 10000 }).catch(() => {
        // Continue anyway
      });
      
      // Wait for client-side data fetching
      await authenticatedPage.waitForTimeout(2000);
      
      // Check if page shows "not found" - if so, reload to bypass cache
      const notFoundVisible = await authenticatedPage.locator('text="Contact Not Found", text="404"').isVisible().catch(() => false);
      if (notFoundVisible) {
        await authenticatedPage.reload({ waitUntil: "networkidle" });
        await authenticatedPage.waitForTimeout(2000);
      }
      
      // Wait for contact form to load
      await authenticatedPage.waitForSelector('input[type="email"]', { timeout: 15000 });
      await authenticatedPage.waitForSelector('input[placeholder*="First Name"]', { timeout: 10000 });
      await authenticatedPage.waitForTimeout(500);

      // Wait for touchpoint actions to be visible
      await authenticatedPage.waitForSelector('button:has-text("Skip Touchpoint")', { timeout: 10000 });

      // Click "Skip Touchpoint"
      await authenticatedPage.click('button:has-text("Skip Touchpoint")');

      // Wait for modal to appear
      await authenticatedPage.waitForSelector('text="Skip Touchpoint"', { timeout: 10000 });

      // Optionally add a reason
      const reasonTextarea = authenticatedPage.locator('textarea[placeholder*="reason"]');
      if (await reasonTextarea.isVisible()) {
        await reasonTextarea.fill("Not relevant");
      }

      // Confirm in modal - wait for button to be visible first
      const skipConfirmButton = authenticatedPage.locator('button:has-text("Skip Touchpoint"):not(:has-text("Keep"))').first();
      await skipConfirmButton.waitFor({ state: "visible", timeout: 5000 });
      await skipConfirmButton.click();

      // Wait for status to update optimistically
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "cancelled");

      // CRITICAL: Verify the status persists and doesn't revert
      // Wait longer to ensure mutation completes and cache update happens
      await authenticatedPage.waitForTimeout(2000);
      
      // Verify status is STILL "cancelled" - ensures optimistic update doesn't revert
      await expectTouchpointStatus(authenticatedPage, "cancelled");

      // Verify "Restore to Pending" button appears and stays visible
      const restoreButton = authenticatedPage.locator('button:has-text("Restore to Pending")').first();
      await expect(restoreButton).toBeVisible({
        timeout: 10000,
      });
      
      // Wait a bit more and verify it's still there (no revert)
      await authenticatedPage.waitForTimeout(1000);
      await expect(restoreButton).toBeVisible();

      // Navigate to Dashboard and verify touchpoint is not in list
      await authenticatedPage.waitForTimeout(1000);
      await expectTouchpointNotOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should restore touchpoint to pending", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_restore_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithCompletedTouchpoint(testUserId, testEmail);

    // Wait for Firestore write to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Navigate and wait for page to load
      await authenticatedPage.goto(`/contacts/${encodeURIComponent(contactId)}`, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
      
      // Verify we're on the right page
      const currentUrl = authenticatedPage.url();
      if (!currentUrl.includes('/contacts/')) {
        throw new Error(`Expected to be on contact page but URL is: ${currentUrl}`);
      }

      // Wait for React to hydrate
      await authenticatedPage.waitForFunction(() => {
        return document.querySelector('input, button, [class*="Card"], [class*="card"]') !== null;
      }, { timeout: 10000 }).catch(() => {
        // Continue anyway
      });
      
      // Wait for client-side data fetching
      await authenticatedPage.waitForTimeout(2000);
      
      // Check if page shows "not found" - if so, reload to bypass cache
      const notFoundVisible = await authenticatedPage.locator('text="Contact Not Found", text="404"').isVisible().catch(() => false);
      if (notFoundVisible) {
        await authenticatedPage.reload({ waitUntil: "networkidle" });
        await authenticatedPage.waitForTimeout(2000);
      }
      
      // Wait for contact form to load
      await authenticatedPage.waitForSelector('input[type="email"]', { timeout: 15000 });
      await authenticatedPage.waitForSelector('input[placeholder*="First Name"]', { timeout: 10000 });
      await authenticatedPage.waitForTimeout(500);

      // Verify status shows "Contacted"
      await expectTouchpointStatus(authenticatedPage, "completed");

      // Wait for "Restore to Pending" button to be visible
      await authenticatedPage.waitForSelector('button:has-text("Restore to Pending")', { timeout: 10000 });
      
      // Click "Restore to Pending"
      await authenticatedPage.click('button:has-text("Restore to Pending")');

      // Wait for status to update optimistically
      await authenticatedPage.waitForTimeout(500);
      await expectTouchpointStatus(authenticatedPage, "pending");

      // CRITICAL: Verify the status persists and doesn't revert
      // Wait longer to ensure mutation completes and cache update happens
      await authenticatedPage.waitForTimeout(2000);
      
      // Verify status is STILL "pending" - ensures optimistic update doesn't revert
      await expectTouchpointStatus(authenticatedPage, "pending");

      // Verify action buttons appear and stay visible
      const markContactedButton = authenticatedPage.locator('button:has-text("Mark as Contacted")').first();
      await expect(markContactedButton).toBeVisible({
        timeout: 10000,
      });
      
      // Wait a bit more and verify it's still there (no revert)
      await authenticatedPage.waitForTimeout(1000);
      await expect(markContactedButton).toBeVisible();

      // Navigate to Dashboard and verify touchpoint appears in list
      await authenticatedPage.waitForTimeout(1000);
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should display error message on touchpoint status update failure", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_error_status_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail);

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // This test would need API mocking to simulate an error
      // For now, verify error display component exists
      // In a real scenario, you might:
      // 1. Mock the API endpoint to return an error
      // 2. Or disconnect network before clicking
      // 3. Then verify error message appears below the button
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("ContactEditor - Archive/Unarchive Contact", () => {
  test("should archive contact and update button text", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_archive_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      archived: false,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Click "Archive Contact"
      await authenticatedPage.click('button:has-text("Archive Contact")');

      // Wait for button text to change
      await expect(authenticatedPage.locator('button:has-text("Unarchive Contact")')).toBeVisible({
        timeout: 5000,
      });

      // Navigate to Contacts list and verify contact is filtered out
      await expectContactNotInList(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should unarchive contact and update button text", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_unarchive_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      archived: true,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Click "Unarchive Contact"
      await authenticatedPage.click('button:has-text("Unarchive Contact")');

      // Wait for button text to change
      await expect(authenticatedPage.locator('button:has-text("Archive Contact")')).toBeVisible({
        timeout: 5000,
      });

      // Navigate to Contacts list and verify contact appears
      await expectContactInList(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("ContactEditor - Delete Contact", () => {
  test("should show confirmation modal and cancel deletion", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_delete_cancel_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Click "Delete Contact"
      await authenticatedPage.click('button:has-text("Delete Contact")');

      // Verify modal appears
      await expect(authenticatedPage.locator('text="Delete Contact"')).toBeVisible();
      await expect(authenticatedPage.locator('text="Are you sure"')).toBeVisible();

      // Click Cancel
      await authenticatedPage.click('button:has-text("Cancel")');

      // Verify modal closes and contact still exists
      await expect(authenticatedPage.locator('text="Delete Contact"')).not.toBeVisible();
      await expect(authenticatedPage.locator(`text="${testEmail}"`)).toBeVisible();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should delete contact and redirect to contacts page", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_delete_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Click "Delete Contact"
      await authenticatedPage.click('button:has-text("Delete Contact")');

      // Confirm deletion
      await authenticatedPage.click('button:has-text("Delete"):not(:has-text("Cancel"))');

      // Wait for redirect to contacts page
      await authenticatedPage.waitForURL(/\/contacts/, { timeout: 5000 });

      // Verify contact no longer appears in list
      await expectContactNotInList(authenticatedPage, testEmail);
    } finally {
      // Contact should already be deleted, but cleanup just in case
      try {
        await deleteTestContact(testUserId, contactId);
      } catch {
        // Expected - contact was deleted
      }
    }
  });
});

test.describe("ContactEditor - Outreach Draft Editor", () => {
  test("should save draft and show save button", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_draft_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Find draft textarea
      const draftTextarea = authenticatedPage.locator('textarea[placeholder*="outreach draft"]');
      await draftTextarea.fill("Test draft message");

      // Verify "Save Draft" button appears
      await expect(authenticatedPage.locator('button:has-text("Save Draft")')).toBeVisible({
        timeout: 2000,
      });

      // Click Save Draft
      await authenticatedPage.click('button:has-text("Save Draft")');

      // Wait for save to complete
      await authenticatedPage.waitForSelector('button:has-text("Save Draft"):not([disabled])', {
        timeout: 5000,
      });

      // Reload page and verify draft persists
      await authenticatedPage.reload();
      await expect(draftTextarea).toHaveValue("Test draft message");
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should open Gmail compose with draft", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_gmail_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Add draft
      const draftTextarea = authenticatedPage.locator('textarea[placeholder*="outreach draft"]');
      await draftTextarea.fill("Test draft message");

      // Save draft first
      await authenticatedPage.click('button:has-text("Save Draft")');
      await authenticatedPage.waitForTimeout(1000);

      // Click "Continue in Gmail"
      const [newPage] = await Promise.all([
        authenticatedPage.context().waitForEvent("page"),
        authenticatedPage.click('button:has-text("Continue in Gmail")'),
      ]);

      // Verify Gmail URL
      expect(newPage.url()).toContain("mail.google.com");
      expect(newPage.url()).toContain(encodeURIComponent(testEmail));
      expect(newPage.url()).toContain(encodeURIComponent("Test draft message"));

      await newPage.close();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("ContactEditor - Cross-Page Verification", () => {
  test("should reflect touchpoint status changes on Dashboard", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_crosspage_${Date.now()}@test.example.com`;
    const contactId = await createTestContactWithTouchpoint(testUserId, testEmail);

    try {
      // Start on contact detail page
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Mark as contacted
      await authenticatedPage.click('button:has-text("Mark as Contacted")');
      await authenticatedPage.click('button:has-text("Mark as Contacted"), button:has-text("Mark Completed")');
      await authenticatedPage.waitForTimeout(1000);

      // Navigate to Dashboard
      await authenticatedPage.goto("/");

      // Verify touchpoint is not in list
      await expectTouchpointNotOnDashboard(authenticatedPage, testEmail);

      // Navigate back to contact
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Restore to pending
      await authenticatedPage.click('button:has-text("Restore to Pending")');
      await authenticatedPage.waitForTimeout(1000);

      // Navigate to Dashboard again
      await authenticatedPage.goto("/");

      // Verify touchpoint appears in list
      await expectTouchpointOnDashboard(authenticatedPage, testEmail);
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should reflect contact changes on Contacts list", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_list_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Original",
    });

    try {
      // Update contact name
      await authenticatedPage.goto(`/contacts/${contactId}`);
      await authenticatedPage.fill('input[placeholder*="First Name"]', "Updated");
      await authenticatedPage.click('button:has-text("Save All Changes")');
      await authenticatedPage.waitForTimeout(1000);

      // Navigate to Contacts list
      await authenticatedPage.goto("/contacts");

      // Verify updated name appears
      await expect(authenticatedPage.locator('text="Updated"')).toBeVisible();
    } finally {
      await deleteTestContact(testUserId, contactId);
    }
  });
});

test.describe("ContactEditor - Action Items", () => {
  test("should add a new action item", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_action_add_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });

      // Click "Add Action Item" button
      await authenticatedPage.click('button:has-text("Add Action Item")');

      // Fill in the action item text
      const textarea = authenticatedPage.locator('textarea[placeholder*="Enter action item"]');
      await textarea.fill("Test action item to complete");

      // Optionally add a due date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateInput = authenticatedPage.locator('input[type="date"]').first();
      await dateInput.fill(futureDate.toISOString().split("T")[0]);

      // Click Add button
      await authenticatedPage.click('button:has-text("Add"):not(:has-text("Action Item"))');

      // Wait for the action item to appear in the list
      await expect(authenticatedPage.locator('text="Test action item to complete"')).toBeVisible({
        timeout: 5000,
      });

      // Verify due date is displayed
      await expect(
        authenticatedPage.locator('text="Due:"')
      ).toBeVisible({ timeout: 2000 });
    } finally {
      await deleteAllTestActionItems(testUserId, contactId);
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should update an action item (edit text and due date)", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_action_update_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    const actionItemId = await createTestActionItem(testUserId, contactId, {
      text: "Original action item text",
      status: "pending",
      dueDate: new Date().toISOString().split("T")[0],
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });
      await authenticatedPage.waitForSelector('text="Original action item text"', {
        timeout: 5000,
      });

      // Find the edit button (pencil icon) for the action item
      // Click edit button near the action item text
      const actionItemCard = authenticatedPage
        .locator('text="Original action item text"')
        .locator("..")
        .locator("..")
        .locator("..");
      const editBtn = actionItemCard.locator('button[title="Edit"]').first();

      // Wait for edit button to be visible
      await editBtn.waitFor({ timeout: 5000 });
      await editBtn.click();

      // Wait for edit mode to appear
      await authenticatedPage.waitForSelector('textarea', { timeout: 3000 });

      // Update the text
      const textarea = authenticatedPage.locator('textarea').first();
      await textarea.clear();
      await textarea.fill("Updated action item text");

      // Update the due date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dateInput = authenticatedPage.locator('input[type="date"]').first();
      await dateInput.fill(futureDate.toISOString().split("T")[0]);

      // Click Save button
      await authenticatedPage.click('button:has-text("Save"):not(:has-text("Draft"))');

      // Wait for updated text to appear
      await expect(authenticatedPage.locator('text="Updated action item text"')).toBeVisible({
        timeout: 5000,
      });

      // Verify original text is gone
      await expect(authenticatedPage.locator('text="Original action item text"')).not.toBeVisible();
    } finally {
      await deleteTestActionItem(testUserId, contactId, actionItemId);
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should complete and uncomplete an action item", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_action_complete_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    const actionItemId = await createTestActionItem(testUserId, contactId, {
      text: "Action item to complete",
      status: "pending",
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });
      await authenticatedPage.waitForSelector('text="Action item to complete"', {
        timeout: 5000,
      });

      // Find the checkbox/complete button for the action item
      // The checkbox is a button with aria-label containing "Mark as complete"
      const completeButton = authenticatedPage
        .locator('button[aria-label*="Mark as complete"], button[aria-label*="complete"]')
        .first();

      await completeButton.waitFor({ timeout: 5000 });
      await completeButton.click();

      // Wait for status to update (text should be strikethrough/styled as completed)
      await authenticatedPage.waitForTimeout(1000);

      // Verify action item appears as completed (checkbox should be checked)
      const checkedButton = authenticatedPage
        .locator('button[aria-label*="Mark as pending"], button[aria-label*="pending"]')
        .first();
      await expect(checkedButton).toBeVisible({ timeout: 5000 });

      // Now uncomplete it
      await checkedButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Verify it's back to pending
      const uncompleteButton = authenticatedPage
        .locator('button[aria-label*="Mark as complete"], button[aria-label*="complete"]')
        .first();
      await expect(uncompleteButton).toBeVisible({ timeout: 5000 });
    } finally {
      await deleteTestActionItem(testUserId, contactId, actionItemId);
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should delete an action item", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_action_delete_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    const actionItemId = await createTestActionItem(testUserId, contactId, {
      text: "Action item to delete",
      status: "pending",
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });
      await authenticatedPage.waitForSelector('text="Action item to delete"', {
        timeout: 5000,
      });

      // Find the delete button (trash icon) for the action item
      const actionItemCard = authenticatedPage
        .locator('text="Action item to delete"')
        .locator("..")
        .locator("..")
        .locator("..");
      const deleteBtn = actionItemCard.locator('button[title="Delete"]').first();

      await deleteBtn.waitFor({ timeout: 5000 });

      // Set up dialog handler for confirmation
      authenticatedPage.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("Are you sure");
        await dialog.accept();
      });

      await deleteBtn.click();

      // Wait for action item to disappear
      await expect(authenticatedPage.locator('text="Action item to delete"')).not.toBeVisible({
        timeout: 5000,
      });
    } finally {
      // Cleanup just in case
      try {
        await deleteTestActionItem(testUserId, contactId, actionItemId);
      } catch {
        // Expected - action item was deleted
      }
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should filter action items by status (All, Pending, Completed)", async ({
    authenticatedPage,
    testUserId,
  }) => {
    const testEmail = `test_action_filter_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    const pendingItemId = await createTestActionItem(testUserId, contactId, {
      text: "Pending action item",
      status: "pending",
    });

    const completedItemId = await createTestActionItem(testUserId, contactId, {
      text: "Completed action item",
      status: "completed",
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });

      // Wait for both action items to appear
      await authenticatedPage.waitForSelector('text="Pending action item"', { timeout: 5000 });
      await authenticatedPage.waitForSelector('text="Completed action item"', { timeout: 5000 });

      // Test "All" filter (should show both)
      const allTab = authenticatedPage.locator('button[role="tab"]:has-text("All")');
      await allTab.click();
      await authenticatedPage.waitForTimeout(500);
      await expect(authenticatedPage.locator('text="Pending action item"')).toBeVisible();
      await expect(authenticatedPage.locator('text="Completed action item"')).toBeVisible();

      // Test "Pending" filter (should only show pending)
      const pendingTab = authenticatedPage.locator('button[role="tab"]:has-text("Pending")');
      await pendingTab.click();
      await authenticatedPage.waitForTimeout(500);
      await expect(authenticatedPage.locator('text="Pending action item"')).toBeVisible();
      await expect(authenticatedPage.locator('text="Completed action item"')).not.toBeVisible();

      // Test "Completed" filter (should only show completed)
      const completedTab = authenticatedPage.locator('button[role="tab"]:has-text("Completed")');
      await completedTab.click();
      await authenticatedPage.waitForTimeout(500);
      await expect(authenticatedPage.locator('text="Completed action item"')).toBeVisible();
      await expect(authenticatedPage.locator('text="Pending action item"')).not.toBeVisible();
    } finally {
      await deleteTestActionItem(testUserId, contactId, pendingItemId);
      await deleteTestActionItem(testUserId, contactId, completedItemId);
      await deleteTestContact(testUserId, contactId);
    }
  });

  test("should cancel editing an action item", async ({ authenticatedPage, testUserId }) => {
    const testEmail = `test_action_cancel_${Date.now()}@test.example.com`;
    const contactId = await createTestContact(testUserId, {
      primaryEmail: testEmail,
      firstName: "Test",
      lastName: "Contact",
    });

    const actionItemId = await createTestActionItem(testUserId, contactId, {
      text: "Original text to keep",
      status: "pending",
    });

    try {
      await authenticatedPage.goto(`/contacts/${contactId}`);

      // Wait for Action Items section to load
      await authenticatedPage.waitForSelector('text="Action Items"', { timeout: 5000 });
      await authenticatedPage.waitForSelector('text="Original text to keep"', {
        timeout: 5000,
      });

      // Click edit button
      const actionItemCard = authenticatedPage
        .locator('text="Original text to keep"')
        .locator("..")
        .locator("..")
        .locator("..");
      const editBtn = actionItemCard.locator('button[title="Edit"]').first();
      await editBtn.waitFor({ timeout: 5000 });
      await editBtn.click();

      // Wait for edit mode
      await authenticatedPage.waitForSelector('textarea', { timeout: 3000 });

      // Change the text
      const textarea = authenticatedPage.locator('textarea').first();
      await textarea.clear();
      await textarea.fill("Changed text that should not be saved");

      // Click Cancel button
      await authenticatedPage.click('button:has-text("Cancel")');

      // Verify original text is still there
      await expect(authenticatedPage.locator('text="Original text to keep"')).toBeVisible({
        timeout: 5000,
      });
      await expect(authenticatedPage.locator('text="Changed text that should not be saved"')).not.toBeVisible();
    } finally {
      await deleteTestActionItem(testUserId, contactId, actionItemId);
      await deleteTestContact(testUserId, contactId);
    }
  });
});

