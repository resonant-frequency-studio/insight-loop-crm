# E2E Tests with Playwright

This directory contains end-to-end tests for the Insight Loop CRM application using Playwright.

## Setup

### 1. Install Dependencies

```bash
npm install
```

This will install Playwright and all required dependencies.

### 2. Create Test Firebase Project

**IMPORTANT**: You MUST use a separate Firebase project for testing to ensure tests never interact with production data.

1. Create a new Firebase project in the Firebase Console
2. Enable Firestore and Authentication
3. Download the service account JSON file
4. Set up Firestore security rules (same as production)

### 3. Configure Test Environment

1. Copy `env.test.local.example` to `.env.test.local`:
   ```bash
   cp env.test.local.example .env.test.local
   ```

2. Fill in your TEST Firebase project credentials in `.env.test.local`:
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Your test Firebase project ID
   - `FIREBASE_ADMIN_PROJECT_ID` - Same as above
   - `FIREBASE_ADMIN_CLIENT_EMAIL` - From service account JSON
   - `FIREBASE_ADMIN_PRIVATE_KEY` - From service account JSON
   - Other Firebase client configuration values

### 4. Verify Test Data Isolation

The test helpers automatically prefix all test data with `test_` to ensure isolation. Test data is automatically cleaned up after each test.

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/contact-editor.spec.ts
```

## Test Structure

- `fixtures/` - Playwright fixtures for authentication and test setup
- `helpers/` - Helper functions for test data creation and assertions
- `*.spec.ts` - Test files organized by feature

## Test Coverage

The E2E tests focus on **integration and end-to-end scenarios** that unit tests cannot cover:

### `contact-editor.spec.ts` - Cross-Page Integration Tests
1. **Cross-Page Data Consistency** - Changes on one page reflect correctly on other pages
2. **Cache Invalidation** - Verify cache updates work across pages
3. **Multi-Page Workflows** - Complete user journeys spanning multiple pages

### `contact-lifecycle.spec.ts` - Complete User Workflows
1. **Full Contact Lifecycle** - Create → Edit → Archive → Unarchive → Delete
2. **Touchpoint Management Workflow** - Create → View on Dashboard → Complete → Restore
3. **Multi-Contact Operations** - Managing multiple contacts and verifying list updates

### What We DON'T Test in E2E
Component-level functionality is tested in unit tests:
- Individual form field updates (tested in `BasicInfoCard.test.tsx`)
- Touchpoint status button clicks (tested in component tests)
- Archive/unarchive button interactions (tested in `ArchiveContactCard.test.tsx`)
- Delete confirmation modals (tested in `DeleteContactCard.test.tsx`)
- Action item CRUD operations (tested in component and API tests)
- Outreach draft editing (tested in `OutreachDraftCard.test.tsx`)

**Why?** Unit tests are faster, more reliable, and easier to maintain. E2E tests should focus on what only E2E can test: integration between pages and complete user workflows.

## Writing New Tests

1. Use the test fixtures for authenticated sessions:
   ```typescript
   test("my test", async ({ authenticatedPage, testUserId }) => {
     // test code
   });
   ```

2. Use test data helpers to create test contacts:
   ```typescript
   const contactId = await createTestContact(testUserId, {
     primaryEmail: "test@example.com",
     firstName: "Test",
   });
   ```

3. Use assertion helpers for common checks:
   ```typescript
   await expectContactInList(page, "test@example.com");
   await expectTouchpointOnDashboard(page, "test@example.com");
   ```

4. Always clean up test data (handled automatically by fixtures, but you can also do it manually):
   ```typescript
   try {
     // test code
   } finally {
     await deleteTestContact(testUserId, contactId);
   }
   ```

## CI/CD Integration

Tests are configured to run in CI environments:
- Uses separate test Firebase project (via environment variables)
- Automatic retries on failure
- HTML report generation
- Screenshots on failure

## Troubleshooting

### Tests fail with authentication errors
- Verify `.env.test.local` has correct test Firebase credentials
- Ensure test Firebase project has Authentication enabled
- Check that service account has proper permissions

### Tests fail with "Contact not found"
- Verify test data is being created (check Firestore console)
- Ensure test user has proper permissions
- Check that contact IDs are being generated correctly

### Tests are slow
- Run tests in parallel (default)
- Use `--workers=1` to run sequentially if needed
- Check network conditions

## Best Practices

1. **Always use test data** - Never use production data in tests
2. **Clean up after tests** - Test fixtures handle cleanup automatically
3. **Use descriptive test names** - Test names should explain expected behavior
4. **Keep tests independent** - Each test should be able to run in isolation
5. **Use page object model** - For complex pages, consider creating page objects

