"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { useMemo, useState, useEffect } from "react";
import { 
  useLinkEventToContact, 
  useUnlinkEventFromContact, 
  useGenerateEventContext,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  UpdateEventInput
} from "@/hooks/useCalendarEvents";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import ConflictResolutionModal, { ConflictData } from "./ConflictResolutionModal";
import EventModalHeader from "./EventModalHeader";
import EventNextActions from "./EventNextActions";
import LinkedContactCard from "./LinkedContactCard";
import EventMeetingInsights from "./EventMeetingInsights";
import EventDetailsSection from "./EventDetailsSection";
import EventAttendeesSection from "./EventAttendeesSection";
import EventJoinInfoSection from "./EventJoinInfoSection";
import CollapsibleSection from "./CollapsibleSection";
import { reportException } from "@/lib/error-reporting";

interface CalendarEventCardProps {
  event: CalendarEvent;
  onClose: () => void;
  contacts?: Contact[]; // Optional - will fetch if not provided
}

export default function CalendarEventCard({ event: eventProp, onClose, contacts: providedContacts }: CalendarEventCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const linkMutation = useLinkEventToContact();
  const unlinkMutation = useUnlinkEventFromContact();
  const generateContextMutation = useGenerateEventContext();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  // Use event prop directly - Firebase listeners will update it automatically
  const event = eventProp;
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  
  // Fetch contacts if not provided
  const { contacts: fetchedContacts = [] } = useContactsRealtime(user?.uid || null);
  const contacts = providedContacts || fetchedContacts;
  
  // Convert Firestore timestamp to Date
  const getDate = (timestamp: unknown): Date => {
    if (timestamp instanceof Date) return timestamp;
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (typeof timestamp === "string") {
      return new Date(timestamp);
    }
    return new Date();
  };

  const startTime = getDate(event.startTime);
  const endTime = getDate(event.endTime);

  // Check if this is an all-day event
  // All-day events are stored in UTC at midnight (00:00:00 UTC) for start
  // and 23:59:59.999 UTC for end (even for multi-day events)
  const startUTC = new Date(startTime.toISOString());
  const endUTC = new Date(endTime.toISOString());
  const startIsMidnightUTC = startUTC.getUTCHours() === 0 && startUTC.getUTCMinutes() === 0 && startUTC.getUTCSeconds() === 0;
  const endIsEndOfDayUTC = endUTC.getUTCHours() === 23 && endUTC.getUTCMinutes() === 59 && endUTC.getUTCSeconds() === 59;
  
  // If start is midnight UTC and end is end of day UTC, it's an all-day event
  const isAllDay = startIsMidnightUTC && endIsEndOfDayUTC;

  // Edit form state - initialized after date calculations
  const [editForm, setEditForm] = useState<UpdateEventInput>({
    title: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    attendees: event.attendees?.map(a => a.email) || [],
    isAllDay: isAllDay,
  });
  
  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if description is long (needs accordion) - removed duplicate, using one below

  // Parse description to convert URLs to links and handle HTML content
  const parseDescription = useMemo(() => {
    if (!event.description) return null;

    const description = event.description;

    // Check if description contains HTML
    const hasHTML = /<[a-z][\s\S]*>/i.test(description);

    if (hasHTML) {
      // Process HTML content: ensure all links have target="_blank" and rel="noopener noreferrer"
      let processedHTML = description;

      // Update existing <a> tags to ensure they open in new tabs
      processedHTML = processedHTML.replace(
        /<a\s+([^>]*?)>/gi,
        (match, attributes) => {
          // Check if target and rel are already present
          const hasTarget = /target\s*=/i.test(attributes);
          const hasRel = /rel\s*=/i.test(attributes);

          let newAttributes = attributes;

          if (!hasTarget) {
            newAttributes += ' target="_blank"';
          } else {
            newAttributes = newAttributes.replace(
              /target\s*=\s*["']?([^"'\s>]+)["']?/gi,
              'target="_blank"'
            );
          }

          if (!hasRel) {
            newAttributes += ' rel="noopener noreferrer"';
          } else {
            newAttributes = newAttributes.replace(
              /rel\s*=\s*["']?([^"'\s>]+)["']?/gi,
              (relMatch: string, relValue: string) => {
                const relParts = relValue.split(/\s+/);
                if (!relParts.includes('noopener')) relParts.push('noopener');
                if (!relParts.includes('noreferrer')) relParts.push('noreferrer');
                return `rel="${relParts.join(' ')}"`;
              }
            );
          }

          // Add styling class if not present
          if (!/class\s*=/i.test(newAttributes)) {
            newAttributes += ' class="text-blue-600 dark:text-blue-400 underline break-all"';
          } else {
            // Add break-all class to existing class
            newAttributes = newAttributes.replace(
              /class\s*=\s*["']([^"']+)["']/gi,
              (classMatch: string, classValue: string) => {
                const classes = classValue.split(/\s+/);
                if (!classes.includes('break-all')) classes.push('break-all');
                if (!classes.includes('underline')) classes.push('underline');
                return `class="${classes.join(' ')}"`;
              }
            );
          }

          return `<a ${newAttributes}>`;
        }
      );

      // Also find plain text URLs that are not already inside <a> tags and convert them to links
      // We need to process text nodes that are outside of HTML tags
      // Strategy: split by HTML tags, process text parts, then reassemble
      const htmlTagRegex = /<[^>]+>/g;
      const parts: Array<{ text: string; isHTML: boolean }> = [];
      let lastIndex = 0;
      let tagMatch;

      while ((tagMatch = htmlTagRegex.exec(processedHTML)) !== null) {
        // Add text before tag
        if (tagMatch.index > lastIndex) {
          const textBefore = processedHTML.substring(lastIndex, tagMatch.index);
          if (textBefore.trim()) {
            parts.push({ text: textBefore, isHTML: false });
          }
        }
        // Add HTML tag
        parts.push({ text: tagMatch[0], isHTML: true });
        lastIndex = tagMatch.index + tagMatch[0].length;
      }

      // Add remaining text
      if (lastIndex < processedHTML.length) {
        const textAfter = processedHTML.substring(lastIndex);
        if (textAfter.trim()) {
          parts.push({ text: textAfter, isHTML: false });
        }
      }

      // Process text parts to convert URLs to links
      const finalParts: string[] = [];

      parts.forEach((part) => {
        if (part.isHTML) {
          finalParts.push(part.text);
        } else {
          // Convert URLs in text to HTML links
          const text = part.text;
          const urlMatches: Array<{ index: number; url: string }> = [];

          // Collect all URL matches (reset regex for each text part)
          const textUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;
          let urlMatch;
          while ((urlMatch = textUrlRegex.exec(text)) !== null) {
            urlMatches.push({
              index: urlMatch.index,
              url: urlMatch[0],
            });
          }

          // Build HTML string with URLs converted to links
          let processedText = '';
          let currentIndex = 0;

          urlMatches.forEach((urlMatch) => {
            // Add text before URL
            processedText += text.substring(currentIndex, urlMatch.index);
            // Add link for URL
            processedText += `<a href="${urlMatch.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline break-all" style="word-break: break-all;">${urlMatch.url}</a>`;
            currentIndex = urlMatch.index + urlMatch.url.length;
          });

          // Add remaining text
          processedText += text.substring(currentIndex);
          finalParts.push(processedText);
        }
      });

      return { __html: finalParts.join('') };
    } else {
      // Plain text - convert URLs to links
      const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
      const parts: (string | React.ReactElement)[] = [];
      let lastIndex = 0;
      let match;
      let keyCounter = 0;

      while ((match = urlRegex.exec(description)) !== null) {
        // Add text before URL
        if (match.index > lastIndex) {
          parts.push(description.substring(lastIndex, match.index));
        }

        // Add link for URL
        const url = match[0];
        parts.push(
          <a
            key={`url-${keyCounter++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline break-all"
            style={{ wordBreak: 'break-all' }}
          >
            {url}
          </a>
        );

        lastIndex = match.index + url.length;
      }

      // Add remaining text
      if (lastIndex < description.length) {
        parts.push(description.substring(lastIndex));
      }

      return parts.length > 0 ? parts : description;
    }
  }, [event.description]);


  // Extract Zoom/Meet links from description
  const joinLinks = useMemo(() => {
    if (!event.description) return [];
    const text = event.description.replace(/<[^>]*>/g, " "); // Strip HTML tags
    const links: Array<{ url: string; type: "zoom" | "meet" | "teams" | "other" }> = [];
    
    // Zoom links
    const zoomRegex = /(https?:\/\/[^\s]*zoom\.us\/[^\s<>"']*)/gi;
    let match;
    while ((match = zoomRegex.exec(text)) !== null) {
      links.push({ url: match[0], type: "zoom" });
    }
    
    // Google Meet links
    const meetRegex = /(https?:\/\/[^\s]*meet\.google\.com\/[^\s<>"']*)/gi;
    while ((match = meetRegex.exec(text)) !== null) {
      links.push({ url: match[0], type: "meet" });
    }
    
    // Microsoft Teams links
    const teamsRegex = /(https?:\/\/[^\s]*teams\.microsoft\.com\/[^\s<>"']*)/gi;
    while ((match = teamsRegex.exec(text)) !== null) {
      links.push({ url: match[0], type: "teams" });
    }
    
    return links;
  }, [event.description]);

  // Find exact email match contact (for auto-linking)
  const exactEmailMatchContact = useMemo(() => {
    if (!contacts.length || event.matchedContactId) return null;
    
    const userEmail = user?.email?.toLowerCase().trim() || null;
    const eventEmails = new Set<string>();
    
    // Collect emails from attendees (excluding user's email)
    if (event.attendees) {
      for (const attendee of event.attendees) {
        const email = attendee.email?.toLowerCase().trim();
        if (email && (!userEmail || email !== userEmail)) {
          eventEmails.add(email);
        }
      }
    }
    
    // Check for exact email match (primary or secondary)
    for (const contact of contacts) {
      // Skip if this contact's email matches the user's email
      if (userEmail && contact.primaryEmail?.toLowerCase().trim() === userEmail) {
        continue;
      }
      
      // Check primary email
      if (contact.primaryEmail && eventEmails.has(contact.primaryEmail.toLowerCase().trim())) {
        return contact;
      }
      
      // Check secondary emails
      if (contact.secondaryEmails) {
        for (const secondaryEmail of contact.secondaryEmails) {
          if (eventEmails.has(secondaryEmail.toLowerCase().trim())) {
            return contact;
          }
        }
      }
    }
    
    return null;
  }, [contacts, event, user?.email]);

  // Auto-link exact email matches
  useEffect(() => {
    if (exactEmailMatchContact && !event.matchedContactId && !linkMutation.isPending) {
      linkMutation.mutate({ 
        eventId: event.eventId, 
        contactId: exactEmailMatchContact.contactId 
      });
    }
  }, [exactEmailMatchContact, event.matchedContactId, event.eventId, linkMutation]);

  // Find contact suggestions based on attendees (excluding user's email and exact matches)
  const contactSuggestions = useMemo(() => {
    if (!contacts.length || event.matchedContactId) return [];
    
    const userEmail = user?.email?.toLowerCase().trim() || null;
    const suggestions: Array<{ contact: Contact; reason: string }> = [];
    const eventEmails = new Set<string>();
    let extractedFirstName: string | null = null;
    let extractedLastName: string | null = null;
    
    // Collect emails from attendees (excluding user's email)
    if (event.attendees) {
      for (const attendee of event.attendees) {
        const email = attendee.email?.toLowerCase().trim();
        if (email && (!userEmail || email !== userEmail)) {
          eventEmails.add(email);
          
          // Try to extract name from attendee displayName (excluding user)
          if (attendee.displayName && !extractedFirstName && !extractedLastName) {
            const nameParts = attendee.displayName.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              extractedFirstName = nameParts[0];
              extractedLastName = nameParts[nameParts.length - 1];
            }
          }
        }
      }
    }
    
    // Fallback: Extract names from title (only capitalized first+last name pattern)
    if (!extractedFirstName || !extractedLastName) {
      const title = event.title || "";
      const namePattern = /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
      const matches = Array.from(title.matchAll(namePattern));
      
      // Try to get user's name to exclude it
      let userLastName: string | null = null;
      if (userEmail && event.attendees) {
        const userAttendee = event.attendees.find(
          (a) => a.email?.toLowerCase().trim() === userEmail
        );
        if (userAttendee?.displayName) {
          const userNameParts = userAttendee.displayName.trim().split(/\s+/);
          if (userNameParts.length >= 2) {
            userLastName = userNameParts[userNameParts.length - 1];
          }
        }
      }
      
      // Use first name that doesn't match user's last name
      for (const match of matches) {
        const firstName = match[1];
        const lastName = match[2];
        
        // Skip if this matches the user's last name
        if (userLastName && lastName.toLowerCase() === userLastName.toLowerCase()) {
          continue;
        }
        
        if (!extractedFirstName) extractedFirstName = firstName;
        if (!extractedLastName) extractedLastName = lastName;
        break;
      }
    }
    
    // Note: Exact email matches are handled separately and auto-linked, so we skip them here
    // We only show name-based suggestions (last name, first name) - not email matches
    
    // Second pass: Exact last name matches (only if not already suggested and not exact email match)
    if (extractedLastName) {
      const lastNameLower = extractedLastName.toLowerCase().trim();
      for (const contact of contacts) {
        // Skip if already suggested
        if (suggestions.some((s) => s.contact.contactId === contact.contactId)) continue;
        
        // Skip if this is the exact email match contact (it will be auto-linked)
        if (exactEmailMatchContact && contact.contactId === exactEmailMatchContact.contactId) continue;
        
        // Skip if this contact's email matches the user's email
        if (userEmail && contact.primaryEmail?.toLowerCase().trim() === userEmail) {
          continue;
        }
        
        // Only match exact last name
        if (contact.lastName && contact.lastName.toLowerCase().trim() === lastNameLower) {
          suggestions.push({ contact, reason: "Last name match" });
        }
      }
    }
    
    // Third pass: Exact first name matches (only if not already suggested)
    if (extractedFirstName) {
      const firstNameLower = extractedFirstName.toLowerCase().trim();
      for (const contact of contacts) {
        // Skip if already suggested
        if (suggestions.some((s) => s.contact.contactId === contact.contactId)) continue;
        
        // Skip if this is the exact email match contact (it will be auto-linked)
        if (exactEmailMatchContact && contact.contactId === exactEmailMatchContact.contactId) continue;
        
        // Skip if this contact's email matches the user's email
        if (userEmail && contact.primaryEmail?.toLowerCase().trim() === userEmail) {
          continue;
        }
        
        // Only match exact first name
        if (contact.firstName && contact.firstName.toLowerCase().trim() === firstNameLower) {
          suggestions.push({ contact, reason: "First name match" });
        }
      }
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }, [contacts, event, user?.email, exactEmailMatchContact]);

  // Get linked contact
  const linkedContact = useMemo(() => {
    if (!event.matchedContactId) return null;
    return contacts.find((c) => c.contactId === event.matchedContactId) || null;
  }, [contacts, event.matchedContactId]);

  // Check if event is linked to a touchpoint
  const isLinkedToTouchpoint = useMemo(() => {
    if (!linkedContact) return false;
    return linkedContact.linkedGoogleEventId === event.eventId && 
           linkedContact.linkStatus === "linked";
  }, [linkedContact, event.eventId]);


  // Handlers for edit/delete
  const handleEdit = () => {
    setIsEditMode(true);
    setFormErrors({});
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setFormErrors({});
    // Reset form to original values
    setEditForm({
      title: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: event.attendees?.map(a => a.email) || [],
      isAllDay: isAllDay,
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editForm.title || editForm.title.trim() === "") {
      errors.title = "Title is required";
    }
    
    if (!editForm.startTime) {
      errors.startTime = "Start time is required";
    }
    
    if (!editForm.endTime) {
      errors.endTime = "End time is required";
    }
    
    if (editForm.startTime && editForm.endTime) {
      const start = new Date(editForm.startTime);
      const end = new Date(editForm.endTime);
      if (start >= end) {
        errors.endTime = "End time must be after start time";
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        eventId: event.eventId,
        updates: editForm,
      });
      setIsEditMode(false);
      setFormErrors({});
      setConflictData(null);
    } catch (error) {
      // Check if it's a conflict error
      const conflictError = error as Error & { conflict?: boolean; conflictData?: unknown };
      if (conflictError.conflict && conflictError.conflictData) {
        setConflictData(conflictError.conflictData as ConflictData);
        setShowConflictModal(true);
      }
    }
  };

  const handleResolveConflict = async (
    resolution: "keep-google" | "overwrite-google" | "merge",
    mergedData?: Partial<{
      title?: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      attendees?: string[];
    }>
  ) => {
    try {
      const response = await fetch(`/api/calendar/events/${event.eventId}/resolve-conflict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resolution, mergedData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to resolve conflict");
      }

      const data = await response.json();
      
      // Event will update automatically via Firebase listener

      // Close conflict modal and edit mode
      setShowConflictModal(false);
      setConflictData(null);
      setIsEditMode(false);
      setFormErrors({});

      // If overwrite-google, show message that user needs to edit again
      if (resolution === "overwrite-google" && data.message) {
        // Could show a toast notification here
      }
    } catch (error) {
      reportException(error, {
        context: "Resolving calendar event conflict",
        tags: { component: "CalendarEventCard", eventId: event.eventId },
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(event.eventId);
      onClose(); // Close modal after successful delete
    } catch {
      // Error handling is done by the mutation hook
    }
  };


  // Handlers for next actions
  const handleCreateFollowUp = () => {
    if (linkedContact) {
      const eventDate = new Date(startTime);
      const dateStr = eventDate.toISOString().split('T')[0];
      router.push(`/contacts/${linkedContact.contactId}?touchpointDate=${dateStr}`);
      onClose();
    }
  };

  const handleDraftEmail = () => {
    if (linkedContact?.primaryEmail) {
      const subject = encodeURIComponent(`Follow-up: ${event.title}`);
      window.open(
        `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(linkedContact.primaryEmail)}&su=${subject}`,
        "_blank"
      );
    }
  };

  const handleViewContact = () => {
    if (linkedContact) {
      router.push(`/contacts/${linkedContact.contactId}`);
      onClose();
    }
  };

  // Check if description is long (needs collapsible)
  const isDescriptionLong = useMemo(() => {
    if (!event.description) return false;
    const textLength = event.description.replace(/<[^>]*>/g, "").length;
    return textLength > 240;
  }, [event.description]);

  return (
    <div className="w-full max-w-full overflow-hidden calendar-event-card flex flex-col">
      {/* 1. Header */}
      <EventModalHeader
        event={event}
        linkedContact={linkedContact}
        onClose={onClose}
        onEdit={handleEdit}
        onDelete={() => setShowDeleteConfirm(true)}
        conflictData={conflictData}
      />

      <div className="space-y-6 min-w-0 flex-1 overflow-y-auto">

        {/* Delete Confirmation */}
        {showDeleteConfirm ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-darkest">Delete Event</h3>
            <p className="text-theme-dark">
              Are you sure you want to delete &quot;{event.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        ) : showUnlinkConfirm && linkedContact ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-darkest">Unlink Contact</h3>
            <p className="text-theme-dark">
              Unlink this event from {linkedContact.firstName || linkedContact.lastName
                ? `${linkedContact.firstName || ""} ${linkedContact.lastName || ""}`.trim()
                : linkedContact.primaryEmail}? This will remove follow-up associations.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowUnlinkConfirm(false)}
                disabled={unlinkMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await unlinkMutation.mutateAsync(event.eventId);
                    setShowUnlinkConfirm(false);
                    // Firebase listener will update the event prop, which will trigger
                    // contactSuggestions memo to recalculate and show suggestions
                  } catch (error) {
                    // Error handling is done by the mutation hook
                  }
                }}
                disabled={unlinkMutation.isPending}
              >
                {unlinkMutation.isPending ? "Unlinking..." : "Unlink"}
              </Button>
            </div>
          </div>
        ) : isEditMode ? (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Event title"
              />
              {formErrors.title && (
                <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>
              )}
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-darkest mb-1">
                  Start <span className="text-red-500">*</span>
                </label>
                <Input
                  type={editForm.isAllDay ? "date" : "datetime-local"}
                  value={editForm.isAllDay 
                    ? editForm.startTime?.split('T')[0] || ""
                    : editForm.startTime?.slice(0, 16) || ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    const newStartTime = editForm.isAllDay 
                      ? `${value}T00:00:00`
                      : value;
                    setEditForm({ ...editForm, startTime: newStartTime });
                  }}
                />
                {formErrors.startTime && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.startTime}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-darkest mb-1">
                  End <span className="text-red-500">*</span>
                </label>
                <Input
                  type={editForm.isAllDay ? "date" : "datetime-local"}
                  value={editForm.isAllDay 
                    ? editForm.endTime?.split('T')[0] || ""
                    : editForm.endTime?.slice(0, 16) || ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    const newEndTime = editForm.isAllDay 
                      ? `${value}T23:59:59`
                      : value;
                    setEditForm({ ...editForm, endTime: newEndTime });
                  }}
                />
                {formErrors.endTime && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.endTime}</p>
            )}
          </div>
        </div>

            {/* All-day toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAllDay"
                checked={editForm.isAllDay || false}
                onChange={(e) => setEditForm({ ...editForm, isAllDay: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isAllDay" className="text-sm font-medium text-theme-darkest">
                All-day event
              </label>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Location
              </label>
              <Input
                value={editForm.location || ""}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Event location"
              />
          </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Description
              </label>
              <Textarea
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Event description"
                rows={4}
              />
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-sm font-medium text-theme-darkest mb-1">
                Attendees (one email per line)
              </label>
              <Textarea
                value={editForm.attendees?.join('\n') || ""}
                onChange={(e) => {
                  const emails = e.target.value.split('\n').filter(email => email.trim() !== '');
                  setEditForm({ ...editForm, attendees: emails });
                }}
                placeholder="email@example.com"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 2. Next Actions Row */}
            <EventNextActions
              event={event}
              linkedContact={linkedContact}
              onCreateFollowUp={handleCreateFollowUp}
              onDraftEmail={handleDraftEmail}
              onAddActionItem={() => {
                if (linkedContact) {
                  router.push(`/contacts/${linkedContact.contactId}?actionItem=true`);
                }
              }}
              onViewContact={handleViewContact}
              followUpEmailDraft={generateContextMutation.data?.followUpEmailDraft || null}
            />

            {/* 3. Linked Contact Card */}
            <LinkedContactCard
              event={event}
              linkedContact={linkedContact}
              contactSuggestions={contactSuggestions}
              onLink={(contactId) => linkMutation.mutate({ eventId: event.eventId, contactId })}
              onUnlink={() => setShowUnlinkConfirm(true)}
              onViewContact={handleViewContact}
              contacts={contacts}
              showContactSearch={showContactSearch}
              contactSearchQuery={contactSearchQuery}
              onToggleSearch={() => setShowContactSearch(!showContactSearch)}
              onSearchQueryChange={setContactSearchQuery}
              isLinking={linkMutation.isPending}
              isLinkedToTouchpoint={isLinkedToTouchpoint}
            />

            {/* 4. Meeting Insights (renamed from AI Context) */}
            <EventMeetingInsights
              event={event}
              linkedContact={linkedContact}
              storedInsights={event.meetingInsights || null}
              aiContext={generateContextMutation.data || null}
              isGenerating={generateContextMutation.isPending}
              error={generateContextMutation.error as Error | null}
              onGenerate={(regenerate) => generateContextMutation.mutate({ eventId: event.eventId, regenerate })}
              onClose={onClose}
            />

            {/* 5. Meeting Details */}
            <EventDetailsSection
              event={event}
              startTime={startTime}
              endTime={endTime}
            />

            {/* 6. Description (collapsible if >240 chars) */}
          {event.description && (
              <CollapsibleSection
                title="Description"
                defaultExpanded={!isDescriptionLong}
                icon={
                  <svg
                    className="w-5 h-5 text-theme-medium"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
                }
              >
                <div>
                {parseDescription && typeof parseDescription === 'object' && '__html' in parseDescription ? (
                  <div
                    className="text-theme-darkest whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere word-break-break-word prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={parseDescription}
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  />
                ) : parseDescription ? (
                  <p className="text-theme-darkest whitespace-pre-wrap wrap-break-word overflow-wrap-anywhere word-break-break-word">
                    {Array.isArray(parseDescription) ? (
                      parseDescription.map((part, index) => (
                        <span key={index}>{part}</span>
                      ))
                    ) : (
                      parseDescription
                    )}
                  </p>
                ) : null}
              </div>
              </CollapsibleSection>
          )}

            {/* 7. Attendees (collapsible if >2) */}
          {event.attendees && event.attendees.length > 0 && (
              <EventAttendeesSection
                attendees={event.attendees}
                defaultExpanded={event.attendees.length <= 2}
              />
            )}

            {/* 8. Join Info (always collapsed, last) */}
          {joinLinks.length > 0 && (
              <EventJoinInfoSection
                joinLinks={joinLinks}
                defaultExpanded={false}
              />
            )}
          </>
        )}

          </div>

      {/* Conflict Resolution Modal */}
      {conflictData && (
        <ConflictResolutionModal
          isOpen={showConflictModal}
          onClose={() => {
            setShowConflictModal(false);
            setConflictData(null);
          }}
          conflictData={conflictData}
          onResolve={handleResolveConflict}
        />
      )}
    </div>
  );
}

