"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useLinkEventToContact, 
  useUnlinkEventFromContact, 
  useGenerateEventContext,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  UpdateEventInput
} from "@/hooks/useCalendarEvents";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { useCreateActionItem } from "@/hooks/useActionItemMutations";
import { formatContactDate } from "@/util/contact-utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import ConflictResolutionModal, { ConflictData } from "./ConflictResolutionModal";

interface CalendarEventCardProps {
  event: CalendarEvent;
  onClose: () => void;
  contacts?: Contact[]; // Optional - will fetch if not provided
}

export default function CalendarEventCard({ event, onClose, contacts: providedContacts }: CalendarEventCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const linkMutation = useLinkEventToContact();
  const unlinkMutation = useUnlinkEventFromContact();
  const generateContextMutation = useGenerateEventContext();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();
  const createActionItemMutation = useCreateActionItem();
  const [joinInfoExpanded, setJoinInfoExpanded] = useState(false);
  const [aiContextExpanded, setAiContextExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isConvertingToTouchpoint, setIsConvertingToTouchpoint] = useState(false);
  
  // Fetch contacts if not provided
  const { data: fetchedContacts = [] } = useContacts(user?.uid || "", undefined);
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

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Check if this is an all-day event
  // All-day events are stored in UTC at midnight (00:00:00 UTC) for start
  // and 23:59:59.999 UTC for end (even for multi-day events)
  const startUTC = new Date(startTime.toISOString());
  const endUTC = new Date(endTime.toISOString());
  const startIsMidnightUTC = startUTC.getUTCHours() === 0 && startUTC.getUTCMinutes() === 0 && startUTC.getUTCSeconds() === 0;
  const endIsEndOfDayUTC = endUTC.getUTCHours() === 23 && endUTC.getUTCMinutes() === 59 && endUTC.getUTCSeconds() === 59;
  
  // Extract UTC date components (year, month, day) - these are the actual dates
  const startYear = startUTC.getUTCFullYear();
  const startMonth = startUTC.getUTCMonth();
  const startDay = startUTC.getUTCDate();
  const endYear = endUTC.getUTCFullYear();
  const endMonth = endUTC.getUTCMonth();
  const endDay = endUTC.getUTCDate();
  
  // If start is midnight UTC and end is end of day UTC, it's an all-day event
  const isAllDay = startIsMidnightUTC && endIsEndOfDayUTC;

  // For all-day events, use UTC date components to create display date in local timezone
  // This preserves the correct date without timezone shifts
  const displayDate = isAllDay 
    ? new Date(startYear, startMonth, startDay, 0, 0, 0, 0)
    : startTime;
  
  // For multi-day all-day events, show the date range
  const isMultiDayAllDay = isAllDay && (startYear !== endYear || startMonth !== endMonth || startDay !== endDay);

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

  // Check if description is long (needs accordion)
  const isDescriptionLong = useMemo(() => {
    if (!event.description) return false;
    // Strip HTML tags for length calculation
    const textLength = event.description.replace(/<[^>]*>/g, "").length;
    return textLength > 200;
  }, [event.description]);

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

  // Get segment color (simple mapping - can be enhanced later)
  const getSegmentColor = (segment: string | null | undefined): string => {
    if (!segment) return "";
    const segmentLower = segment.toLowerCase();
    // Simple color mapping - can be made configurable later
    const colorMap: Record<string, string> = {
      vip: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      prospect: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      customer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      lead: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };
    return colorMap[segmentLower] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

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

  // Find contact suggestions based on attendees
  const contactSuggestions = useMemo(() => {
    if (!contacts.length || event.matchedContactId) return [];
    
    const suggestions: Array<{ contact: Contact; reason: string }> = [];
    const eventEmails = new Set<string>();
    const eventLastNames = new Set<string>();
    
    // Collect emails from attendees
    if (event.attendees) {
      event.attendees.forEach((a) => {
        if (a.email) eventEmails.add(a.email.toLowerCase());
      });
    }
    
    // Also check description for emails
    if (event.description) {
      const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
      let match;
      while ((match = emailRegex.exec(event.description)) !== null) {
        eventEmails.add(match[0].toLowerCase());
      }
    }
    
    // Extract last names from event text (full words only)
    const eventText = `${event.title} ${event.description || ""}`;
    // Match full last names (word boundaries, case-insensitive)
    const words = eventText.toLowerCase().split(/\s+/);
    words.forEach(word => {
      // Remove punctuation and check if it's a potential last name (2+ characters)
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length >= 2) {
        eventLastNames.add(cleanWord);
      }
    });
    
    // First pass: Exact email matches (highest priority)
    for (const contact of contacts) {
      if (contact.primaryEmail && eventEmails.has(contact.primaryEmail.toLowerCase())) {
        suggestions.push({ contact, reason: "Email match" });
      }
    }
    
    // Second pass: Full last name matches (only if not already suggested)
    for (const contact of contacts) {
      if (suggestions.some((s) => s.contact.contactId === contact.contactId)) continue;
      
      // Only match full last name (exact match, not partial)
      if (contact.lastName) {
        const lastNameLower = contact.lastName.toLowerCase().trim();
        if (eventLastNames.has(lastNameLower)) {
          suggestions.push({ contact, reason: "Last name match" });
        }
      }
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }, [contacts, event]);

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

  // Format sync metadata
  const syncMetadata = useMemo(() => {
    if (!event.lastSyncedAt) return null;
    return formatContactDate(event.lastSyncedAt, { relative: true });
  }, [event.lastSyncedAt]);

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
      
      // Invalidate queries to refresh the event
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      // Close conflict modal and edit mode
      setShowConflictModal(false);
      setConflictData(null);
      setIsEditMode(false);
      setFormErrors({});

      // If overwrite-google, show message that user needs to edit again
      if (resolution === "overwrite-google" && data.message) {
        // Could show a toast notification here
        console.log(data.message);
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
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

  const handleConvertToTouchpoint = async () => {
    if (!linkedContact) {
      // If no linked contact, we need to link one first
      // For now, show an error or prompt to link
      alert("Please link a contact first before converting to touchpoint");
      return;
    }

    setIsConvertingToTouchpoint(true);
    try {
      const response = await fetch(`/api/calendar/events/${event.eventId}/convert-to-touchpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contactId: linkedContact.contactId,
          markAsFollowUp: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to convert event to touchpoint");
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      // Show success message or navigate
      router.push(`/contacts/${linkedContact.contactId}`);
      onClose();
    } catch (error) {
      console.error("Failed to convert event to touchpoint:", error);
      alert(error instanceof Error ? error.message : "Failed to convert event to touchpoint");
    } finally {
      setIsConvertingToTouchpoint(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden calendar-event-card flex flex-col">
      <div className="flex items-start justify-between mb-6 gap-2 flex-shrink-0 relative">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-theme-darkest flex-shrink-0">Event Details</h2>
          {conflictData && (
            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-md">
              Conflict
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                disabled={updateMutation.isPending || deleteMutation.isPending}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={updateMutation.isPending || deleteMutation.isPending}
              >
                Delete
              </Button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-sm hover:bg-theme-light transition-colors text-theme-medium hover:text-theme-darkest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Close event details"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-4 min-w-0 flex-1 overflow-y-auto">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-theme-darkest mb-2 break-words overflow-wrap-anywhere word-break-break-word">
            {event.title}
          </h3>
          
          {/* Visual Indicators */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {/* isDirty Badge */}
            {event.isDirty && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs font-medium rounded">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Unsaved Changes
              </span>
            )}

            {/* Linked Contact Indicator */}
            {event.matchedContactId && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs font-medium rounded">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Linked
              </span>
            )}

            {/* Segment Pill */}
            {event.contactSnapshot?.segment && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${getSegmentColor(event.contactSnapshot.segment)}`}>
                {event.contactSnapshot.segment}
              </span>
            )}

            {/* Touchpoint Badge */}
            {event.sourceOfTruth === "crm_touchpoint" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs font-medium rounded border border-orange-300 dark:border-orange-700 border-dashed">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Touchpoint
              </span>
            )}
          </div>
        </div>

        {/* Edit Form or Display Mode */}
        {isEditMode ? (
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
            <div className="space-y-2 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <svg
              className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-theme-darkest font-medium break-words">
                {isMultiDayAllDay 
                  ? `${formatDate(displayDate)} - ${formatDate(new Date(endYear, endMonth, endDay, 0, 0, 0, 0))}`
                  : formatDate(displayDate)
                }
              </p>
              {!isAllDay && (
                <p className="text-theme-dark text-sm break-words">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </p>
              )}
              {isAllDay && (
                <p className="text-theme-dark text-sm">
                  {isMultiDayAllDay ? "All day (multi-day)" : "All day"}
                </p>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-theme-darkest break-words overflow-wrap-anywhere word-break-break-word min-w-0 flex-1">{event.location}</p>
            </div>
          )}

          {event.description && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
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
              <div className="min-w-0 flex-1">
                {isDescriptionLong ? (
                  <div className="border border-theme-lighter rounded-sm">
                    <button
                      onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-theme-light transition-colors"
                      aria-expanded={descriptionExpanded}
                    >
                      <span className="text-sm font-medium text-theme-darkest">Description</span>
                      <svg
                        className={`w-5 h-5 text-theme-medium transition-transform ${descriptionExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {descriptionExpanded && (
                      <div className="p-3 pt-0 border-t border-theme-lighter">
                        {parseDescription && typeof parseDescription === 'object' && '__html' in parseDescription ? (
                          <div
                            className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={parseDescription}
                            style={{
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}
                          />
                        ) : parseDescription ? (
                          <p className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word">
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
                    )}
                  </div>
                ) : (
                  <>
                    {parseDescription && typeof parseDescription === 'object' && '__html' in parseDescription ? (
                      <div
                        className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={parseDescription}
                        style={{
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      />
                    ) : parseDescription ? (
                      <p className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word">
                        {Array.isArray(parseDescription) ? (
                          parseDescription.map((part, index) => (
                            <span key={index}>{part}</span>
                          ))
                        ) : (
                          parseDescription
                        )}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-theme-darkest font-medium mb-1">Attendees</p>
                <ul className="space-y-1">
                  {event.attendees.map((attendee, index) => (
                    <li key={index} className="text-theme-dark text-sm break-words overflow-wrap-anywhere">
                      {attendee.displayName || attendee.email}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Join Info Accordion */}
          {joinLinks.length > 0 && (
            <div className="border border-theme-light rounded-sm">
              <button
                onClick={() => setJoinInfoExpanded(!joinInfoExpanded)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-theme-light transition-colors"
              >
                <div className="flex items-center gap-2">
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-theme-darkest font-medium">Join Info</span>
                  <span className="text-theme-dark text-sm">({joinLinks.length})</span>
                </div>
                <svg
                  className={`w-5 h-5 text-theme-medium transition-transform ${joinInfoExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {joinInfoExpanded && (
                <div className="p-3 pt-0 border-t border-theme-light">
                  <div className="space-y-2">
                    {joinLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-sm hover:bg-theme-light transition-colors text-blue-600 dark:text-blue-400 break-all"
                      >
                        <svg
                          className="w-4 h-4 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <span className="text-sm font-medium capitalize">{link.type}</span>
                        <span className="text-xs text-theme-dark truncate">{link.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Linked Contact Section */}
          <div className="border border-theme-light rounded-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-theme-darkest font-medium flex items-center gap-2">
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Linked Contact
              </h4>
            </div>
            
            {linkedContact ? (
              <div className="space-y-2">
                <Link
                  href={`/contacts/${linkedContact.contactId}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                      {linkedContact.firstName?.[0] || linkedContact.lastName?.[0] || linkedContact.primaryEmail[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-theme-darkest font-medium">
                          {linkedContact.firstName || linkedContact.lastName
                            ? `${linkedContact.firstName || ""} ${linkedContact.lastName || ""}`.trim()
                            : linkedContact.primaryEmail}
                        </p>
                        {isLinkedToTouchpoint && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-md">
                            Touchpoint
                          </span>
                        )}
                      </div>
                      <p className="text-theme-dark text-xs">{linkedContact.primaryEmail}</p>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {!isLinkedToTouchpoint && (
                    <Button
                      onClick={handleConvertToTouchpoint}
                      disabled={isConvertingToTouchpoint}
                      variant="secondary"
                      size="xs"
                      loading={isConvertingToTouchpoint}
                    >
                      Convert to Touchpoint
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      // Format event date as YYYY-MM-DD for query parameter
                      const eventDate = new Date(startTime);
                      const dateStr = eventDate.toISOString().split('T')[0];
                      router.push(`/contacts/${linkedContact.contactId}?touchpointDate=${dateStr}`);
                      onClose(); // Close modal after navigation
                    }}
                    variant="primary"
                    size="xs"
                  >
                    Create Touchpoint
                  </Button>
                  <Button
                    onClick={() => unlinkMutation.mutate(event.eventId)}
                    disabled={unlinkMutation.isPending}
                    variant="outline"
                    size="xs"
                  >
                    Unlink
                  </Button>
                </div>
                {event.contactSnapshot?.segment && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getSegmentColor(event.contactSnapshot.segment)}`}>
                      {event.contactSnapshot.segment}
                    </span>
                    {event.contactSnapshot.tags && event.contactSnapshot.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.contactSnapshot.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-xs text-theme-dark bg-theme-light px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {contactSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-theme-dark text-sm mb-2">Suggested contacts:</p>
                    {contactSuggestions.map((suggestion) => (
                      <div key={suggestion.contact.contactId} className="flex items-center justify-between p-2 rounded-sm hover:bg-theme-light transition-colors">
                        <Link
                          href={`/contacts/${suggestion.contact.contactId}`}
                          className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium">
                            {suggestion.contact.firstName?.[0] || suggestion.contact.lastName?.[0] || suggestion.contact.primaryEmail[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-theme-darkest text-sm font-medium truncate">
                              {suggestion.contact.firstName || suggestion.contact.lastName
                                ? `${suggestion.contact.firstName || ""} ${suggestion.contact.lastName || ""}`.trim()
                                : suggestion.contact.primaryEmail}
                            </p>
                            <p className="text-theme-dark text-xs truncate">{suggestion.contact.primaryEmail}</p>
                          </div>
                          <span className="text-xs text-theme-dark">{suggestion.reason}</span>
                        </Link>
                        <Button
                          onClick={() => linkMutation.mutate({ eventId: event.eventId, contactId: suggestion.contact.contactId })}
                          disabled={linkMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="ml-2"
                        >
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {contactSuggestions.length === 0 && (
                  <p className="text-theme-dark text-sm">No contact linked. No suggestions available.</p>
                )}
                {contacts.length > 0 && (
                  <div>
                    {!showContactSearch ? (
                      <Button
                        onClick={() => setShowContactSearch(true)}
                        variant="outline"
                        size="sm"
                        fullWidth
                      >
                        {contactSuggestions.length > 0 ? "Search for Different Contact" : "Search for Contact"}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Search by name or email..."
                          value={contactSearchQuery}
                          onChange={(e) => setContactSearchQuery(e.target.value)}
                          className="w-full"
                        />
                        <div className="max-h-48 overflow-y-auto space-y-1 border border-theme-lighter rounded-sm p-2">
                          {contacts
                            .filter((contact) => {
                              if (!contactSearchQuery.trim()) return true;
                              const query = contactSearchQuery.toLowerCase();
                              const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim().toLowerCase();
                              const email = contact.primaryEmail?.toLowerCase() || "";
                              return (
                                fullName.includes(query) ||
                                email.includes(query) ||
                                (contact.firstName?.toLowerCase().includes(query)) ||
                                (contact.lastName?.toLowerCase().includes(query))
                              );
                            })
                            .slice(0, 10)
                            .map((contact) => (
                              <div
                                key={contact.contactId}
                                className="flex items-center justify-between p-2 rounded-sm hover:bg-theme-light transition-colors cursor-pointer"
                                onClick={() => {
                                  linkMutation.mutate({ eventId: event.eventId, contactId: contact.contactId });
                                  setShowContactSearch(false);
                                  setContactSearchQuery("");
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                    {contact.firstName?.[0] || contact.lastName?.[0] || contact.primaryEmail[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-theme-darkest text-sm font-medium truncate">
                                      {contact.firstName || contact.lastName
                                        ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                                        : contact.primaryEmail}
                                    </p>
                                    <p className="text-theme-dark text-xs truncate">{contact.primaryEmail}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          {contacts.filter((contact) => {
                            if (!contactSearchQuery.trim()) return false;
                            const query = contactSearchQuery.toLowerCase();
                            const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim().toLowerCase();
                            const email = contact.primaryEmail?.toLowerCase() || "";
                            return (
                              fullName.includes(query) ||
                              email.includes(query) ||
                              (contact.firstName?.toLowerCase().includes(query)) ||
                              (contact.lastName?.toLowerCase().includes(query))
                            );
                          }).length === 0 && contactSearchQuery.trim() && (
                            <p className="text-theme-dark text-sm text-center py-2">No contacts found</p>
                          )}
                        </div>
                        <Button
                          onClick={() => {
                            setShowContactSearch(false);
                            setContactSearchQuery("");
                          }}
                          variant="outline"
                          size="sm"
                          fullWidth
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Context Section */}
          <div className="border border-theme-light rounded-sm">
            <button
              onClick={() => {
                if (!aiContextExpanded && !generateContextMutation.data) {
                  // Generate context when first expanded
                  generateContextMutation.mutate(event.eventId);
                }
                setAiContextExpanded(!aiContextExpanded);
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-theme-light transition-colors"
            >
              <div className="flex items-center gap-2">
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
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="text-theme-darkest font-medium">AI Context</span>
              </div>
              <svg
                className={`w-5 h-5 text-theme-medium transition-transform ${aiContextExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {aiContextExpanded && (
              <div className="p-3 pt-0 border-t border-theme-light">
                {generateContextMutation.isPending && (
                  <div className="flex items-center gap-2 text-theme-dark text-sm py-4">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Generating context...</span>
                  </div>
                )}
                {generateContextMutation.isError && (
                  <div className="space-y-2">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      {generateContextMutation.error instanceof Error
                        ? generateContextMutation.error.message
                        : "Failed to generate AI context"}
                    </p>
                    <Button
                      onClick={() => generateContextMutation.mutate(event.eventId)}
                      variant="outline"
                      size="sm"
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {generateContextMutation.data && (
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-theme-darkest font-medium text-sm mb-1">Summary</h5>
                      <p className="text-theme-dark text-sm whitespace-pre-line">
                        {generateContextMutation.data.summary}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-theme-darkest font-medium text-sm mb-1">Suggested Next Step</h5>
                      <p className="text-theme-dark text-sm">
                        {generateContextMutation.data.suggestedNextStep}
                      </p>
                    </div>

                    {/* Suggested Touchpoint */}
                    {generateContextMutation.data.suggestedTouchpointDate && event.matchedContactId && (
                      <div className="border-t border-theme-light pt-3">
                        <h5 className="text-theme-darkest font-medium text-sm mb-1">Suggested Touchpoint</h5>
                        <p className="text-theme-dark text-sm mb-2">
                          Date: {new Date(generateContextMutation.data.suggestedTouchpointDate).toLocaleDateString()}
                        </p>
                        {generateContextMutation.data.suggestedTouchpointRationale && (
                          <p className="text-theme-dark text-xs mb-2 italic">
                            {generateContextMutation.data.suggestedTouchpointRationale}
                          </p>
                        )}
                        <Button
                          onClick={() => {
                            if (event.matchedContactId) {
                              const dateStr = generateContextMutation.data.suggestedTouchpointDate;
                              router.push(`/contacts/${event.matchedContactId}?touchpointDate=${dateStr}`);
                              onClose();
                            }
                          }}
                          variant="primary"
                          size="sm"
                          disabled={!event.matchedContactId}
                        >
                          Create Touchpoint
                        </Button>
                      </div>
                    )}

                    {/* Suggested Action Items */}
                    {generateContextMutation.data.suggestedActionItems && 
                     generateContextMutation.data.suggestedActionItems.length > 0 && 
                     event.matchedContactId && (
                      <div className="border-t border-theme-light pt-3">
                        <h5 className="text-theme-darkest font-medium text-sm mb-2">Suggested Action Items</h5>
                        <ul className="list-disc list-inside space-y-1 mb-3">
                          {generateContextMutation.data.suggestedActionItems.map((item: string, idx: number) => (
                            <li key={idx} className="text-theme-dark text-sm">
                              {item}
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                          {generateContextMutation.data.suggestedActionItems.map((item: string, idx: number) => (
                            <Button
                              key={idx}
                              onClick={() => {
                                if (event.matchedContactId) {
                                  createActionItemMutation.mutate({
                                    contactId: event.matchedContactId,
                                    text: item,
                                  });
                                }
                              }}
                              variant="outline"
                              size="sm"
                              disabled={!event.matchedContactId || createActionItemMutation.isPending}
                            >
                              Add &quot;{item.substring(0, 30)}{item.length > 30 ? "..." : ""}&quot;
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Email Draft */}
                    {generateContextMutation.data.followUpEmailDraft && event.matchedContactId && linkedContact?.primaryEmail && (
                      <div className="border-t border-theme-light pt-3">
                        <h5 className="text-theme-darkest font-medium text-sm mb-1">Follow-up Email Draft</h5>
                        <p className="text-theme-dark text-sm whitespace-pre-line mb-3 p-2 bg-theme-light rounded">
                          {generateContextMutation.data.followUpEmailDraft}
                        </p>
                        <Button
                          onClick={() => {
                            if (linkedContact?.primaryEmail) {
                              const subject = encodeURIComponent(`Follow-up: ${event.title}`);
                              const body = encodeURIComponent(generateContextMutation.data.followUpEmailDraft || "");
                              window.open(
                                `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(linkedContact.primaryEmail)}&su=${subject}&body=${body}`,
                                "_blank"
                              );
                            }
                          }}
                          variant="primary"
                          size="sm"
                        >
                          Use to Draft Email
                        </Button>
                      </div>
                    )}

                    <div className="border-t border-theme-light pt-3">
                      <Button
                        onClick={() => generateContextMutation.mutate(event.eventId)}
                        variant="outline"
                        size="sm"
                        disabled={generateContextMutation.isPending}
                      >
                        Regenerate
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sync Metadata */}
          {syncMetadata && (
            <div className="flex items-center gap-2 text-theme-dark text-xs">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Last synced {syncMetadata}</span>
            </div>
          )}
        </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-theme-darkest mb-4">Delete Event</h3>
              <p className="text-theme-dark mb-6">
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
          </div>
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

