import { getAccessToken as getGmailAccessToken } from "@/lib/gmail/get-access-token";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";

/**
 * Get access token for Google Calendar API
 * Reuses Gmail token infrastructure but verifies Calendar scope is present
 */
export async function getCalendarAccessToken(userId: string): Promise<string> {
  // Check if Calendar scope is present in stored tokens
  const doc = await adminDb.collection("googleAccounts").doc(userId).get();
  
  if (!doc.exists) {
    throw new Error("No Google account linked. Please connect your Gmail account.");
  }

  const data = doc.data()!;
  const scope = data.scope || "";
  
  // Check if Calendar scope is present
  const hasCalendarScope = scope.includes("calendar.readonly") || scope.includes("calendar");
  
  if (!hasCalendarScope) {
    const error = new Error("Calendar access not granted. Please reconnect your Google account with Calendar permissions.");
    (error as Error & { requiresReauth?: boolean }).requiresReauth = true;
    reportException(error, {
      context: "Calendar scope missing",
      tags: { component: "get-calendar-access-token", userId },
      extra: { scope },
    });
    throw error;
  }

  // Use the same token infrastructure as Gmail
  return getGmailAccessToken(userId);
}

