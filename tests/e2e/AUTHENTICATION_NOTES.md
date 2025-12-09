# Authentication Setup Notes

## Current Status ✅

Authentication for E2E tests is fully working using Firebase custom tokens with session cookies. The implementation uses an E2E test mode that bypasses SSR auth redirects, allowing client-side authentication to handle authentication seamlessly.

## Implementation

### 1. Test API Endpoint (`/api/test/auth`):
   - Creates a custom token for the test user
   - Signs in with Firebase client SDK server-side
   - Creates a session cookie with matching attributes to production
   - Returns the cookie in the response

### 2. Authentication Flow:
   - Test user is created in Firebase Auth
   - Custom token is generated
   - Session cookie is set via API endpoint in browser context
   - Cookie is verified to be present in browser
   - Navigation to protected routes works correctly

### 3. E2E Test Mode Bypass:
   - `E2E_TEST_MODE` environment variable enables bypass of SSR auth redirects
   - Server components skip auth checks when `E2E_TEST_MODE=true`
   - Client-side auth (CrmLayoutWrapper) checks session cookie and allows rendering
   - This ensures tests can authenticate without SSR interference

## How It Works

1. **Test User Creation**: Each test creates a unique test user in Firebase Auth
2. **Session Cookie**: Authentication creates a session cookie via `/api/test/auth`
3. **SSR Bypass**: With `E2E_TEST_MODE=true`, server components don't redirect unauthenticated users
4. **Client-Side Auth**: `CrmLayoutWrapper` checks the session cookie and allows page rendering
5. **Data Loading**: Server components fetch data if session cookie is available, otherwise client components handle it

## Configuration

The E2E test mode is automatically enabled via `playwright.config.ts`:
- Sets `E2E_TEST_MODE=true` and `NEXT_PUBLIC_E2E_TEST_MODE=true` in webServer.env
- Ensures the flag is available to both server and client code during test runs

## Cookie Attributes

The session cookie is set with:
- Name: `__session`
- `httpOnly: true`
- `path: "/"`
- `sameSite: "lax"`
- `secure: false` (in development/test, `true` in production)

These attributes match the production session cookie exactly.

## Test Fixture

The `authenticatedPage` fixture:
1. Creates test user in Firebase Auth
2. Authenticates via `/api/test/auth` in browser context
3. Verifies session cookie exists
4. Navigates to protected routes
5. Client-side auth handles the rest

All test data is automatically cleaned up after each test.

