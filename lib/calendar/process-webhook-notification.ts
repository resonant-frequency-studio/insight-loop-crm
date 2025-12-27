import { Firestore, Timestamp } from "firebase-admin/firestore";
import { getCalendarAccessToken } from "./get-access-token";
import { getCalendarEventsFromGoogle } from "./get-calendar-events";
import { syncCalendarEventsToFirestore } from "./sync-calendar-events";
import { tryAutoResolveConflict } from "./auto-resolve-conflict";
import { detectConflict } from "./conflict-detector";
import { getAllContactsForUserUncached } from "@/lib/contacts-server";
import { CalendarEvent, Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";

/**
 * Process a webhook notification and sync events from Google Calendar
 */
export async function processWebhookNotification(
  db: Firestore,
  userId: string,
  resourceId: string
): Promise<{ synced: number; conflicts: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;
  let conflicts = 0;

  try {
    // Get access token
    const accessToken = await getCalendarAccessToken(userId);

    // Get user's email for contact matching
    let userEmail: string | null = null;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email || null;
      }
    } catch (error) {
      // Log but don't fail if user info fetch fails
      reportException(error, {
        context: "Fetching user email for webhook sync",
        tags: { component: "process-webhook-notification", userId },
      });
    }

    // Fetch contacts for matching
    let contacts: Contact[] = [];
    try {
      contacts = await getAllContactsForUserUncached(userId);
    } catch (error) {
      // Log but don't fail if contacts fetch fails
      reportException(error, {
        context: "Fetching contacts for webhook sync",
        tags: { component: "process-webhook-notification", userId },
      });
    }

    // Fetch events from Google Calendar
    // Use a time range around now (30 days back, 60 days forward)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 60);

    // Use resourceId as calendarId (usually "primary" for the user's primary calendar)
    const calendarId = resourceId || "primary";

    const googleEventsResponse = await getCalendarEventsFromGoogle(
      accessToken,
      timeMin,
      timeMax,
      calendarId
    );

    const eventsCollection = db
      .collection("users")
      .doc(userId)
      .collection("calendarEvents");

    // Process each event
    for (const googleEvent of googleEventsResponse.items) {
      try {
        // Skip cancelled events
        if (googleEvent.status === "cancelled") {
          // Check if event exists in CRM and delete it
          const existingEventDoc = await eventsCollection
            .where("googleEventId", "==", googleEvent.id)
            .limit(1)
            .get();

          if (!existingEventDoc.empty) {
            await existingEventDoc.docs[0].ref.delete();
          }
          continue;
        }

        // Check if event exists in CRM
        const existingEventDoc = await eventsCollection
          .where("googleEventId", "==", googleEvent.id)
          .limit(1)
          .get();

        if (!existingEventDoc.empty) {
          // Event exists - check for conflicts
          const existingEvent = existingEventDoc.docs[0].data() as CalendarEvent;
          const existingEventId = existingEventDoc.docs[0].id;

          const conflictInfo = detectConflict(googleEvent, existingEvent);

          if (conflictInfo.type === "complex") {
            // Complex conflict - mark for user review
            conflicts++;
            await eventsCollection.doc(existingEventId).update({
              hasConflict: true,
              conflictType: "complex",
              conflictDetectedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
            continue;
          }

          // Try to auto-resolve simple conflicts
          const autoResolveResult = await tryAutoResolveConflict(
            db,
            userId,
            googleEvent,
            { ...existingEvent, eventId: existingEventId }
          );

          if (!autoResolveResult.resolved && conflictInfo.type === "simple") {
            // Simple conflict that couldn't be auto-resolved (e.g., only CRM changed)
            // This will be handled by the dirty event sync job
            conflicts++;
          }

          if (autoResolveResult.resolved) {
            synced++;
          }
        } else {
          // New event - sync it
          const syncResult = await syncCalendarEventsToFirestore(
            db,
            userId,
            [googleEvent],
            contacts,
            timeMin,
            timeMax,
            userEmail
          );

          synced += syncResult.synced;
          if (syncResult.errors.length > 0) {
            errors.push(...syncResult.errors);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to process event ${googleEvent.id}: ${errorMessage}`);
        reportException(error, {
          context: "Processing webhook event",
          tags: { component: "process-webhook-notification", userId, eventId: googleEvent.id },
        });
      }
    }

    return { synced, conflicts, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to process webhook notification: ${errorMessage}`);
    reportException(error, {
      context: "Processing webhook notification",
      tags: { component: "process-webhook-notification", userId },
    });
    throw error;
  }
}

