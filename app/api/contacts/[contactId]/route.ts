import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-utils";
import { getContactForUser } from "@/lib/contacts-server";
import { reportException } from "@/lib/error-reporting";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { Contact } from "@/types/firestore";
import { convertTimestamp } from "@/util/timestamp-utils-server";
import { syncTouchpointToCalendar } from "@/lib/calendar/sync-touchpoints";
import { updateGoogleEvent } from "@/lib/calendar/write-calendar-event";
import { Timestamp } from "firebase-admin/firestore";

/**
 * GET /api/contacts/[contactId]
 * Get a single contact for the authenticated user
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);
    
    const contact = await getContactForUser(userId, contactId);
    
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ contact });
  } catch (error) {
    reportException(error, {
      context: "Fetching contact",
      tags: { component: "contacts-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts/[contactId]
 * Update a contact for the authenticated user
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);
    const body = await req.json();
    const updates = body;

    // Validate that contact exists
    const existingContact = await getContactForUser(userId, contactId);
    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Update contact using server-side Firestore
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });

    // Invalidate meeting insights for all calendar events linked to this contact
    try {
      const eventsCollection = adminDb
        .collection("users")
        .doc(userId)
        .collection("calendarEvents");
      
      // Find all events linked to this contact
      const linkedEventsSnapshot = await eventsCollection
        .where("matchedContactId", "==", contactId)
        .get();

      if (!linkedEventsSnapshot.empty) {
        // Use batch write for efficiency
        const batch = adminDb.batch();
        linkedEventsSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            meetingInsights: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (invalidationError) {
      // Log but don't fail the contact update if insight invalidation fails
      reportException(invalidationError, {
        context: "Invalidating meeting insights for linked calendar events",
        tags: { component: "contacts-api", contactId },
      });
    }

    // Fetch the updated contact to return in response
    const updatedDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .get();

    if (!updatedDoc.exists) {
      return NextResponse.json(
        { error: "Contact not found after update" },
        { status: 404 }
      );
    }

    const contactData = updatedDoc.data() as Contact;
    const updatedContact: Contact = {
      ...contactData,
      contactId: updatedDoc.id,
      createdAt: convertTimestamp(contactData.createdAt),
      updatedAt: convertTimestamp(contactData.updatedAt),
      lastEmailDate: contactData.lastEmailDate ? convertTimestamp(contactData.lastEmailDate) : null,
      nextTouchpointDate: contactData.nextTouchpointDate ? convertTimestamp(contactData.nextTouchpointDate) : null,
      touchpointStatusUpdatedAt: contactData.touchpointStatusUpdatedAt ? convertTimestamp(contactData.touchpointStatusUpdatedAt) : null,
      summaryUpdatedAt: contactData.summaryUpdatedAt ? convertTimestamp(contactData.summaryUpdatedAt) : null,
    };

    // Sync touchpoint to calendar if nextTouchpointDate was updated
    if (updates.nextTouchpointDate !== undefined) {
      try {
        // Check if touchpoint is linked to a Google Calendar event
        const isLinkedToGoogleEvent = 
          updatedContact.linkedGoogleEventId && 
          updatedContact.linkStatus === "linked";

        if (isLinkedToGoogleEvent && updatedContact.nextTouchpointDate && updatedContact.linkedGoogleEventId) {
          // Update the linked Google Calendar event
          const linkedEventId = updatedContact.linkedGoogleEventId; // TypeScript now knows this is a string
          const touchpointDate = updatedContact.nextTouchpointDate;
          let touchpointDateObj: Date;
          
          if (touchpointDate instanceof Date) {
            touchpointDateObj = touchpointDate;
          } else if (touchpointDate && typeof touchpointDate === "object" && "toDate" in touchpointDate) {
            touchpointDateObj = (touchpointDate as { toDate: () => Date }).toDate();
          } else if (typeof touchpointDate === "string") {
            touchpointDateObj = new Date(touchpointDate);
          } else {
            throw new Error("Invalid touchpoint date format");
          }

          // Default to 1 hour duration
          const startTime = new Date(touchpointDateObj);
          const endTime = new Date(touchpointDateObj);
          endTime.setHours(endTime.getHours() + 1);

          // Get the event to retrieve etag
          const eventsCollection = adminDb
            .collection("users")
            .doc(userId)
            .collection("calendarEvents");
          
          const eventDoc = await eventsCollection.doc(linkedEventId).get();
          
          if (eventDoc.exists) {
            const eventData = eventDoc.data();
            const etag = eventData?.etag;

            // Update Google Calendar event
            await updateGoogleEvent({
              userId,
              googleEventId: linkedEventId,
              startTime,
              endTime,
              description: updatedContact.nextTouchpointMessage || undefined,
              etag,
            });

            // Update Firestore cache with new times
            await eventDoc.ref.update({
              startTime: Timestamp.fromDate(startTime),
              endTime: Timestamp.fromDate(endTime),
              description: updatedContact.nextTouchpointMessage || null,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          // Not linked to Google event, use existing sync logic
          await syncTouchpointToCalendar(adminDb, userId, {
            ...updatedContact,
            contactId: updatedDoc.id,
          });
        }
        
        // Invalidate calendar events cache
        revalidateTag(`calendar-events-${userId}`, "max");
      } catch (error) {
        // Log error but don't fail the contact update
        reportException(error, {
          context: "Syncing touchpoint to calendar after contact update",
          tags: { component: "contacts-api", userId, contactId },
        });
      }
    }

    // Invalidate Next.js server cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    return NextResponse.json({ contact: updatedContact });
  } catch (error) {
    reportException(error, {
      context: "Updating contact",
      tags: { component: "contacts-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[contactId]
 * Delete a contact for the authenticated user
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const userId = await getUserId();
    const { contactId: contactIdParam } = await params;
    const contactId = decodeURIComponent(contactIdParam);

    // Validate that contact exists
    const existingContact = await getContactForUser(userId, contactId);
    if (!existingContact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Delete contact document
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("contacts")
      .doc(contactId)
      .delete();

    // Invalidate Next.js server cache
    revalidateTag("contacts", "max");
    revalidateTag(`contacts-${userId}`, "max");
    revalidateTag(`contact-${userId}-${contactId}`, "max");
    revalidateTag(`dashboard-stats-${userId}`, "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    reportException(error, {
      context: "Deleting contact",
      tags: { component: "contacts-api" },
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

