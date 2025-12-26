import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { isJestTest } from "@/util/test-utils";
import { reportException } from "@/lib/error-reporting";

/**
 * Test-only endpoint for E2E test authentication
 * Creates a session cookie for a test user using a custom token
 * 
 * This endpoint should only be available in test environments
 */
export async function POST(req: Request) {
  // Only allow in development or test environment, or when explicitly enabled
  const isDevelopment = process.env.NODE_ENV === "development";
  const isTest = isJestTest();
  const isAllowed = process.env.ALLOW_TEST_AUTH === "true";
  
  if (!isDevelopment && !isTest && !isAllowed) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Create custom token for the user
    const customToken = await adminAuth.createCustomToken(userId);

    // Initialize Firebase client SDK and sign in
    // We'll do this server-side and return the ID token
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, signInWithCustomToken } = await import("firebase/auth");

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    };

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const auth = getAuth(app);

    const userCredential = await signInWithCustomToken(auth, customToken);
    const idToken = await userCredential.user.getIdToken();

    // Create session cookie
    const expiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    // Return custom token in response so client can sign in client-side
    // This is needed for client components that use useAuth hook
    const response = NextResponse.json({ 
      ok: true, 
      userId: userCredential.user.uid,
      customToken: customToken, // Include custom token for client-side auth
    });
    response.cookies.set({
      name: "__session",
      value: sessionCookie,
      httpOnly: true,
      maxAge: expiresIn / 1000,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    reportException(error, {
      context: "Test auth error",
      tags: { component: "test-auth-api" },
    });
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

