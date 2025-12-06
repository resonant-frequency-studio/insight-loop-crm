import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getUserId } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" });
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

  if (!tokens.refresh_token) {
    console.error("NO REFRESH TOKEN", tokens);
    return NextResponse.json({ error: "Refresh token missing" });
  }

  // Store tokens securely in Firestore
  await adminDb
    .collection("googleAccounts")
    .doc(userId)
    .set(
      {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        scope: tokens.scope,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.redirect(new URL("/contacts", req.url).toString());
}
