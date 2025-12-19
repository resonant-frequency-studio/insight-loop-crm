import { createHash } from "crypto";
import { CalendarEvent, Contact } from "@/types/firestore";

/**
 * Generate a data signature for meeting insights
 * This signature is used to detect when insights have become stale
 * 
 * @param event - The calendar event
 * @param contact - The linked contact (if any)
 * @param timelineItemCount - Number of timeline items for the contact
 * @returns SHA256 hash of the relevant data
 */
export function generateInsightsSignature(
  event: CalendarEvent,
  contact: Contact | null,
  timelineItemCount: number
): string {
  // Build signature string from relevant data
  const parts: string[] = [];
  
  // Event data
  parts.push(event.title || "");
  parts.push(event.description || "");
  
  // Attendees (sorted for consistency)
  const attendeeEmails = (event.attendees || [])
    .map((a) => a.email?.toLowerCase() || "")
    .filter((email) => email.length > 0)
    .sort()
    .join(",");
  parts.push(attendeeEmails);
  
  // Contact data (if linked)
  if (contact) {
    parts.push(contact.contactId || "");
    parts.push(contact.segment || "");
    parts.push((contact.tags || []).sort().join(","));
    parts.push(String(contact.engagementScore ?? ""));
  } else {
    parts.push(""); // No contact
  }
  
  // Timeline item count
  parts.push(String(timelineItemCount));
  
  // Create hash
  const signatureString = parts.join("|");
  return createHash("sha256").update(signatureString).digest("hex");
}

