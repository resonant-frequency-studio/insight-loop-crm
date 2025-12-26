"use client";

import { Timestamp } from "firebase/firestore";
import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact, useUpdateTouchpointStatus } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import TouchpointStatusActions from "../TouchpointStatusActions";
import Textarea from "@/components/Textarea";
import { formatContactDate, getDisplayName } from "@/util/contact-utils";
import { reportException } from "@/lib/error-reporting";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import SavingIndicator from "@/components/contacts/SavingIndicator";
import { Button } from "@/components/Button";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import ContactGuardedLink from "@/components/contacts/ContactGuardedLink";
import { Contact } from "@/types/firestore";

interface NextTouchpointCardProps {
  contactId: string;
  userId: string;
}

export default function NextTouchpointCard({
  contactId,
  userId,
}: NextTouchpointCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const updateTouchpointStatusMutation = useUpdateTouchpointStatus(userId);
  const { schedule, flush } = useDebouncedAutosave();
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const prevContactIdRef = useRef<string | null>(null);
  const lastSavedValuesRef = useRef<{ date: string; message: string } | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [nextTouchpointDate, setNextTouchpointDate] = useState<string>("");
  const [nextTouchpointMessage, setNextTouchpointMessage] = useState<string>("");
  const [isConvertingToEvent, setIsConvertingToEvent] = useState(false);
  const [showRestoreButton, setShowRestoreButton] = useState(false);
  const [showStatusSection, setShowStatusSection] = useState(false); // Control visibility of entire status section
  const restoreTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs to store current values so save function always reads latest state
  const nextTouchpointDateRef = useRef(nextTouchpointDate);
  const nextTouchpointMessageRef = useRef(nextTouchpointMessage);
  
  // Keep refs in sync with state
  useEffect(() => {
    nextTouchpointDateRef.current = nextTouchpointDate;
  }, [nextTouchpointDate]);
  
  useEffect(() => {
    nextTouchpointMessageRef.current = nextTouchpointMessage;
  }, [nextTouchpointMessage]);

  // Track previous status to detect changes
  const prevStatusRef = useRef<Contact["touchpointStatus"] | null>(null);

  // Helper function to check if a date is in the future (not today or past)
  const isDateInFuture = (dateString: string): boolean => {
    if (!dateString || !dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return false;
    }
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date > today;
  };

  // Check if touchpoint is active (future date + non-empty message)
  const isActiveTouchpoint = useMemo(() => {
    return (
      nextTouchpointDate.trim() !== "" &&
      isDateInFuture(nextTouchpointDate) &&
      nextTouchpointMessage.trim() !== ""
    );
  }, [nextTouchpointDate, nextTouchpointMessage]);

  // Handle status changes - show restore button for 60 seconds, then clear inputs
  useEffect(() => {
    if (!contact) return;

    const hasStatus = contact.touchpointStatus === "completed" || contact.touchpointStatus === "cancelled";
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = contact.touchpointStatus;
    
    // Detect when status changes from null/pending to completed/cancelled
    const statusJustChanged = 
      (prevStatus === null || prevStatus === "pending") && 
      (hasStatus);
    
    if (statusJustChanged) {
      // Status was just set - show restore button and status section, start timer
      setShowRestoreButton(true);
      setShowStatusSection(true);
      
      // Clear any existing timer
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
      
      // Set timer to hide status section and clear inputs after 60 seconds
      // NOTE: Only clear local state (UI), NOT database - keep date/message/status in DB for timeline
      restoreTimerRef.current = setTimeout(() => {
        setShowRestoreButton(false);
        setShowStatusSection(false); // Hide entire status section
        setNextTouchpointDate("");
        setNextTouchpointMessage("");
        // Clear the saved values ref so form doesn't repopulate
        lastSavedValuesRef.current = null;
      }, 60000); // 60 seconds
    } else if (!hasStatus && showRestoreButton) {
      // Status was cleared (restored to pending) - hide restore button and status section immediately
      setShowRestoreButton(false);
      setShowStatusSection(false);
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    }

    // Cleanup timer on unmount
    return () => {
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.touchpointStatus, showRestoreButton]);
  
  // Reset form state only when contactId changes (switching to a different contact)
  // Don't reset when contact data updates from our own save
  // KEY: Don't populate form if touchpointStatus is completed/cancelled
  useEffect(() => {
    if (!contact) return;
    
    // KEY CHANGE: If touchpointStatus is completed or cancelled, don't populate form fields
    // This keeps fields clear even after refresh/navigation for completed/skipped touchpoints
    const isCompletedOrCancelled = 
      contact.touchpointStatus === "completed" || 
      contact.touchpointStatus === "cancelled";
    
    if (isCompletedOrCancelled) {
      // Don't populate form - keep fields empty for completed/skipped touchpoints
      // User must manually type to create a new active touchpoint
      return;
    }
    
    // Only reset if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      lastSavedValuesRef.current = null; // Clear saved values when switching contacts
      // Batch state updates to avoid cascading renders
      const dateValue =
        contact.nextTouchpointDate instanceof Timestamp
          ? contact.nextTouchpointDate.toDate().toISOString().split("T")[0]
          : typeof contact.nextTouchpointDate === "string"
          ? contact.nextTouchpointDate.split("T")[0]
          : "";
      setNextTouchpointDate(dateValue);
      setNextTouchpointMessage(contact.nextTouchpointMessage ?? "");
      return;
    }
    
    // If contact data updated but it matches what we just saved, don't reset
    if (lastSavedValuesRef.current) {
      const saved = lastSavedValuesRef.current;
      const contactDate =
        contact.nextTouchpointDate instanceof Timestamp
          ? contact.nextTouchpointDate.toDate().toISOString().split("T")[0]
          : typeof contact.nextTouchpointDate === "string"
          ? contact.nextTouchpointDate.split("T")[0]
          : "";
      const contactMessage = contact.nextTouchpointMessage ?? "";
      
      if (contactDate === saved.date && contactMessage === saved.message) {
        // This update came from our save, don't reset form
        return;
      }
    }
    
    // Only update if form values match the old contact values (user hasn't made changes)
    const contactDate =
      contact.nextTouchpointDate instanceof Timestamp
        ? contact.nextTouchpointDate.toDate().toISOString().split("T")[0]
        : typeof contact.nextTouchpointDate === "string"
        ? contact.nextTouchpointDate.split("T")[0]
        : "";
    const contactMessage = contact.nextTouchpointMessage ?? "";
    
    if (nextTouchpointDate === contactDate && nextTouchpointMessage === contactMessage) {
      // Form hasn't been edited, safe to update from contact
      setNextTouchpointDate(contactDate);
      setNextTouchpointMessage(contactMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.nextTouchpointDate, contact?.nextTouchpointMessage, contact?.touchpointStatus]);

  // Save function for autosave - reads from refs to always get latest values
  const saveTouchpoint = useMemo(() => {
    return async () => {
      if (!contact) return;
      
      // Read current form values from refs (always latest, even if scheduled before state update)
      const currentDate = nextTouchpointDateRef.current || null;
      const currentMessage = nextTouchpointMessageRef.current || null;
      
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          {
            contactId,
            updates: {
              nextTouchpointDate: currentDate,
              nextTouchpointMessage: currentMessage,
            },
          },
          {
            onSuccess: () => {
              // Remember what we saved so we don't reset form when contact refetches
              lastSavedValuesRef.current = {
                date: currentDate ?? "",
                message: currentMessage ?? "",
              };
              resolve();
            },
            onError: (error) => {
              reportException(error, {
                context: "Saving next touchpoint in NextTouchpointCard",
                tags: { component: "NextTouchpointCard", contactId },
              });
              reject(error);
            },
          }
        );
      });
    };
  }, [contact, contactId, updateMutation]);

  // Check if touchpoint is linked to a calendar event
  const isLinkedToEvent = useMemo(() => {
    if (!contact) return false;
    return contact.linkedGoogleEventId && contact.linkStatus === "linked";
  }, [contact]);

  const handleConvertToMeeting = async () => {
    if (!contact || !nextTouchpointDate) {
      alert("Please set a touchpoint date first");
      return;
    }

    // Flush any pending saves first
    await flush("touchpoint");

    setIsConvertingToEvent(true);
    try {
      const response = await fetch("/api/touchpoints/convert-to-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contactId: contact.contactId,
          touchpointDate: nextTouchpointDate,
          message: nextTouchpointMessage || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to convert touchpoint to meeting");
      }

      const data = await response.json();
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

      // Navigate to calendar or show success
      if (data.event?.eventId) {
        router.push(`/calendar?eventId=${data.event.eventId}`);
      }
    } catch (error) {
      reportException(error, {
        context: "Converting touchpoint to calendar event",
        tags: { component: "NextTouchpointCard", contactId },
      });
      alert(error instanceof Error ? error.message : "Failed to convert touchpoint to meeting");
    } finally {
      setIsConvertingToEvent(false);
    }
  };

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-48" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md" className="relative">
      <SavingIndicator cardKey="touchpoint" />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-theme-darkest flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400"
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
            Next Touchpoint
          </h2>
          {isLinkedToEvent && (
            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-md">
              Linked to Meeting
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-theme-dark mb-4">
        Schedule and plan your next interaction with this contact. Set a date and add notes about what to discuss to maintain consistent, meaningful engagement.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="next-touchpoint-date" className="block text-sm font-medium text-theme-darker mb-2">
            Date
          </label>
          <input
            id="next-touchpoint-date"
            type="date"
            className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            value={nextTouchpointDate}
            onChange={(e) => {
              const dateValue = e.target.value;
              // Cancel restore timer if user is typing
              if (restoreTimerRef.current) {
                clearTimeout(restoreTimerRef.current);
                restoreTimerRef.current = null;
              }
              
              // Clear status if user edits date and there's a status (creating new active touchpoint)
              if (contact?.touchpointStatus === "completed" || contact?.touchpointStatus === "cancelled") {
                updateTouchpointStatusMutation.mutate({
                  contactId,
                  status: null,
                });
                setShowRestoreButton(false);
              }
              
              if (dateValue && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                setNextTouchpointDate(dateValue);
                schedule("touchpoint", saveTouchpoint, 0); // Save immediately on date change
              } else if (!dateValue) {
                setNextTouchpointDate("");
                schedule("touchpoint", saveTouchpoint, 0);
              }
            }}
            onBlur={() => flush("touchpoint")}
          />
        </div>
        <div>
          <label htmlFor="next-touchpoint-message" className="block text-sm font-medium text-theme-darker mb-2">
            Message
          </label>
          <Textarea
            id="next-touchpoint-message"
            name="next-touchpoint-message"
            rows={3}
            value={nextTouchpointMessage}
            onChange={(e) => {
              // Cancel restore timer if user is typing
              if (restoreTimerRef.current) {
                clearTimeout(restoreTimerRef.current);
                restoreTimerRef.current = null;
              }
              
              // Clear status if user edits message and there's a status (creating new active touchpoint)
              if (contact?.touchpointStatus === "completed" || contact?.touchpointStatus === "cancelled") {
                updateTouchpointStatusMutation.mutate({
                  contactId,
                  status: null,
                });
                setShowRestoreButton(false);
              }
              
              setNextTouchpointMessage(e.target.value);
              schedule("touchpoint", saveTouchpoint);
            }}
            onBlur={() => flush("touchpoint")}
            placeholder="What should you discuss in the next touchpoint?"
          />
        </div>
      </div>

      {/* Convert to Meeting Button */}
      {nextTouchpointDate && !isLinkedToEvent && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button
            onClick={handleConvertToMeeting}
            disabled={isConvertingToEvent || !nextTouchpointDate}
            loading={isConvertingToEvent}
            variant="primary"
            fullWidth
          >
            Convert to Meeting
          </Button>
          <p className="text-xs text-theme-dark mt-2 text-center">
            Create a Google Calendar event from this touchpoint
          </p>
        </div>
      )}

      {/* Linked Event Info */}
      {isLinkedToEvent && contact.linkedGoogleEventId && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-darkest">Linked to Calendar Event</p>
              <p className="text-xs text-theme-dark mt-1">
                This touchpoint is connected to a Google Calendar event
              </p>
            </div>
            <ContactGuardedLink
              href={`/calendar?eventId=${contact.linkedGoogleEventId}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Event →
            </ContactGuardedLink>
          </div>
        </div>
      )}

      {/* Touchpoint Status Management */}
      {/* Show status section only if: active touchpoint (future date + message) OR status section should be shown */}
      {/* After 60 seconds, showStatusSection becomes false, hiding everything and returning to empty state */}
      {(isActiveTouchpoint || showStatusSection) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <TouchpointStatusActions
            contactId={contactId}
            contactName={getDisplayName(contact)}
            userId={userId}
            showRestoreButton={showRestoreButton}
            onStatusUpdate={() => {
              // When status is restored, cancel timer and hide status section
              if (restoreTimerRef.current) {
                clearTimeout(restoreTimerRef.current);
                restoreTimerRef.current = null;
              }
              setShowRestoreButton(false);
              setShowStatusSection(false);
            }}
          />
          {showStatusSection && contact.touchpointStatusUpdatedAt != null && (
            <p className="text-xs text-gray-500 mt-2">
              Status updated:{" "}
              {formatContactDate(contact.touchpointStatusUpdatedAt, {
                relative: true,
              })}
            </p>
          )}
          {showStatusSection && contact.touchpointStatusReason && (
            <div className="mt-3 p-3 bg-theme-lighter border border-gray-200 rounded-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                {contact.touchpointStatus === "completed" ? "Note" : "Reason"}
              </p>
              <p className="text-sm text-theme-darker">
                {contact.touchpointStatusReason}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

