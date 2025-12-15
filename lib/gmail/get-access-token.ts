import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";

export async function getAccessToken(userId: string) {
  const doc = await adminDb.collection("googleAccounts").doc(userId).get();

  if (!doc.exists) throw new Error("No Gmail account linked.");

  const data = doc.data()!;
  const refreshToken = data.refreshToken;

  // If access token hasn't expired, reuse
  if (data.expiresAt > Date.now() + 60_000) {
    return data.accessToken;
  }

  // Otherwise refresh
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await res.json();

  if (!tokens.access_token) {
    // Check for specific error types
    const errorType = tokens.error;
    const errorDescription = tokens.error_description || "";
    
    let errorMessage = "Could not refresh access token.";
    if (errorType === "invalid_grant") {
      if (errorDescription.includes("expired") || errorDescription.includes("revoked")) {
        errorMessage = "Gmail access token has expired or been revoked. Please reconnect your Gmail account.";
      } else {
        errorMessage = "Gmail authentication failed. Please reconnect your Gmail account.";
      }
    }
    
    reportException(new Error(errorMessage), {
      context: "Token refresh failed",
      tags: { component: "get-access-token", userId },
      extra: { tokenResponse: tokens, errorType, errorDescription },
    });
    
    // Create a custom error with the user-friendly message
        const error = new Error(errorMessage);
        (error as Error & { code?: string; requiresReauth?: boolean }).code = errorType;
        (error as Error & { code?: string; requiresReauth?: boolean }).requiresReauth = errorType === "invalid_grant";
        throw error;
  }

  await doc.ref.update({
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    updatedAt: Date.now(),
  });

  return tokens.access_token;
}
