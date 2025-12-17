import { getAccessToken as getGmailAccessToken } from "@/lib/gmail/get-access-token";
import { adminDb } from "@/lib/firebase-admin";
import { reportException } from "@/lib/error-reporting";

/**
 * Get access token for Google Calendar API
 * Reuses Gmail token infrastructure but verifies Calendar scope is present
 * @param requireWriteScope - If true, verifies full calendar write scope (not just readonly)
 */
export async function getCalendarAccessToken(
  userId: string,
  requireWriteScope: boolean = false
): Promise<string> {
  // Check if Calendar scope is present in stored tokens
  const doc = await adminDb.collection("googleAccounts").doc(userId).get();
  
  if (!doc.exists) {
    const error = new Error("No Google account linked. Please connect your Gmail account.");
    (error as Error & { requiresReauth?: boolean }).requiresReauth = true;
    throw error;
  }

  const data = doc.data()!;
  const scope = data.scope || "";
  
  // Check if Calendar scope is present (readonly or full write access)
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

  // For write operations, verify full calendar scope (not just readonly)
  if (requireWriteScope) {
    // Check for full calendar write scope
    // The scope string should include "https://www.googleapis.com/auth/calendar" (not just readonly)
    // Scopes are space-separated, so we check for the full URL
    const calendarWriteScope = "https://www.googleapis.com/auth/calendar";
    const calendarReadonlyScope = "https://www.googleapis.com/auth/calendar.readonly";
    
    // Split scope string by spaces to check individual scopes
    const scopes = scope.split(/\s+/).filter(s => s.length > 0);
    
    // Check if we have the write scope (and not just readonly)
    const hasWriteScope = scopes.includes(calendarWriteScope);
    const hasOnlyReadonly = scopes.includes(calendarReadonlyScope) && !hasWriteScope;
    
    if (!hasWriteScope || hasOnlyReadonly) {
      const error = new Error("Calendar write access not granted. Please reconnect your Google account with Calendar write permissions.");
      (error as Error & { requiresReauth?: boolean }).requiresReauth = true;
      reportException(error, {
        context: "Calendar write scope missing",
        tags: { component: "get-calendar-access-token", userId },
        extra: { scope, scopes, requireWriteScope: true, hasWriteScope, hasOnlyReadonly },
      });
      throw error;
    }
  }

  // Use the same token infrastructure as Gmail
  return getGmailAccessToken(userId);
}

