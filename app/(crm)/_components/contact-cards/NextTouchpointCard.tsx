"use client";

import { Timestamp } from "firebase/firestore";
import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import SaveButtonWithIndicator from "./SaveButtonWithIndicator";
import TouchpointStatusActions from "../TouchpointStatusActions";
import Textarea from "@/components/Textarea";
import { formatContactDate, getDisplayName } from "@/util/contact-utils";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `next-touchpoint-${contactId}`;
  
  const prevContactIdRef = useRef<string | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [nextTouchpointDate, setNextTouchpointDate] = useState<string>("");
  const [nextTouchpointMessage, setNextTouchpointMessage] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  // Register/unregister save status with context
  useEffect(() => {
    registerSaveStatus(cardId, saveStatus);
    return () => {
      unregisterSaveStatus(cardId);
    };
  }, [saveStatus, cardId, registerSaveStatus, unregisterSaveStatus]);
  
  // Reset form state ONLY when contactId changes (switching to a different contact)
  // We don't update when updatedAt changes because that would reset our local state
  // during optimistic updates and refetches. The local state is the source of truth
  // until we switch to a different contact.
  useEffect(() => {
    if (!contact) return;
    
    // Only update if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      // Batch state updates to avoid cascading renders
      const dateValue =
        contact.nextTouchpointDate instanceof Timestamp
          ? contact.nextTouchpointDate.toDate().toISOString().split("T")[0]
          : typeof contact.nextTouchpointDate === "string"
          ? contact.nextTouchpointDate.split("T")[0]
          : "";
      setNextTouchpointDate(dateValue);
      setNextTouchpointMessage(contact.nextTouchpointMessage ?? "");
      setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId]);

  // Track changes using useMemo instead of useEffect
  const hasUnsavedChanges = useMemo(() => {
    if (!contact) return false;
    const contactDate =
      contact.nextTouchpointDate instanceof Timestamp
        ? contact.nextTouchpointDate.toDate().toISOString().split("T")[0]
        : typeof contact.nextTouchpointDate === "string"
        ? contact.nextTouchpointDate.split("T")[0]
        : "";
    const dateChanged = nextTouchpointDate !== contactDate;
    const messageChanged =
      nextTouchpointMessage !== (contact.nextTouchpointMessage ?? "");
    return dateChanged || messageChanged;
  }, [nextTouchpointDate, nextTouchpointMessage, contact]);

  const saveChanges = () => {
    if (!hasUnsavedChanges || !contact) return;

    setSaveStatus("saving");
    updateMutation.mutate(
      {
        contactId,
        updates: {
          nextTouchpointDate: nextTouchpointDate || null,
          nextTouchpointMessage: nextTouchpointMessage || null,
        },
      },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        },
        onError: (error) => {
          setSaveStatus("error");
          reportException(error, {
            context: "Saving next touchpoint in NextTouchpointCard",
            tags: { component: "NextTouchpointCard", contactId },
          });
          setTimeout(() => setSaveStatus("idle"), 3000);
        },
      }
    );
  };

  // Autosave every 30 seconds when there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const interval = setInterval(() => {
      if (hasUnsavedChanges) {
        saveChanges();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [hasUnsavedChanges, saveChanges]);

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-48" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-2">
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
        <SaveButtonWithIndicator
          saveStatus={saveStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={saveChanges}
        />
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
              if (dateValue && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                setNextTouchpointDate(dateValue);
              } else if (!dateValue) {
                setNextTouchpointDate("");
              }
            }}
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
            onChange={(e) => setNextTouchpointMessage(e.target.value)}
            placeholder="What should you discuss in the next touchpoint?"
          />
        </div>
      </div>

      {/* Touchpoint Status Management */}
      {(nextTouchpointDate || contact.touchpointStatus) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <TouchpointStatusActions
            contactId={contactId}
            contactName={getDisplayName(contact)}
            userId={userId}
            onStatusUpdate={() => {
              // No-op: React Query will automatically update the contact data
            }}
          />
          {contact.touchpointStatusUpdatedAt != null && (
            <p className="text-xs text-gray-500 mt-2">
              Status updated:{" "}
              {formatContactDate(contact.touchpointStatusUpdatedAt, {
                relative: true,
              })}
            </p>
          )}
          {contact.touchpointStatusReason && (
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

