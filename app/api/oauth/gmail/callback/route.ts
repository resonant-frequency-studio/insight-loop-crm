import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getUserId } from "@/lib/auth-utils";
import { reportException } from "@/lib/error-reporting";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" });
  }

  // Parse redirect URL from state parameter
  let redirectUrl = "/contacts";
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      if (stateData.redirect) {
        redirectUrl = stateData.redirect;
      }
    } catch {
      // If state parsing fails, use default redirect
    }
  }

  // Get userId from session cookie
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url).toString());
  }


  // Exchange code → access + refresh tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  // Get existing account data to preserve refresh token if new one isn't provided
  const existingAccountDoc = await adminDb
    .collection("googleAccounts")
    .doc(userId)
    .get();

  const existingData = existingAccountDoc.exists ? existingAccountDoc.data() : null;
  const existingRefreshToken = existingData?.refreshToken;

  // Google only returns refresh_token on first authorization or when forcing re-auth
  // If no refresh_token in response, use existing one (if available)
  if (!tokens.refresh_token && !existingRefreshToken) {
    reportException(new Error("Refresh token missing from OAuth response and no existing token"), {
      context: "OAuth callback - no refresh token",
      tags: { component: "oauth-callback" },
      extra: { tokenResponse: tokens, hasExistingToken: !!existingRefreshToken },
    });
    return NextResponse.json({ error: "Refresh token missing. Please reconnect your Google account." });
  }

  // Store tokens securely in Firestore
  // Use new refresh_token if provided, otherwise keep existing one
  const refreshTokenToStore = tokens.refresh_token || existingRefreshToken;

  await adminDb
    .collection("googleAccounts")
    .doc(userId)
    .set(
      {
        refreshToken: refreshTokenToStore,
        accessToken: tokens.access_token,
        scope: tokens.scope,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.redirect(new URL(redirectUrl, req.url).toString());
}
