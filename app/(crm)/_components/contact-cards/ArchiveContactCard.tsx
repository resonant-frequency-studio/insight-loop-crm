"use client";

import { useEffect, useState, useRef } from "react";
import { useContact } from "@/hooks/useContact";
import { useArchiveContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { extractErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import { useSavingState } from "@/contexts/SavingStateContext";

type SaveStatus = "idle" | "saving" | "saved" | "error";
interface ArchiveContactCardProps {
  contactId: string;
  userId: string;
}

export default function ArchiveContactCard({
  contactId,
  userId,
}: ArchiveContactCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const archiveContactMutation = useArchiveContact(userId);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `archive-${contactId}`;

  const prevContactIdRef = useRef<string | null>(null);
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Register/unregister save status with context
  useEffect(() => {
    registerSaveStatus(cardId, saveStatus);
    return () => {
      unregisterSaveStatus(cardId);
    };
  }, [saveStatus, cardId, registerSaveStatus, unregisterSaveStatus]);
  
  // Reset state ONLY when contactId changes (switching to a different contact)
  // We don't update when updatedAt changes because that would reset our local state
  // during optimistic updates and refetches. The local state is the source of truth
  // until we switch to a different contact.
  useEffect(() => {
    if (!contact) return;
    
    // Only update if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      // Batch state updates to avoid cascading renders
      setIsArchived(contact.archived === true);
      setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId]);
  
  const archiveContact = (archived: boolean) => {
    setIsArchived(archived);
    setArchiveError(null);
    archiveContactMutation.mutate(
      {
        contactId,
        archived,
      },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        },
        onError: (error) => {
          reportException(error, {
            context: "Archiving contact in ArchiveContactCard",
            tags: { component: "ArchiveContactCard", contactId },
          });
          setArchiveError(extractErrorMessage(error));
        },
      }
    );
  };

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-16" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <Button
        onClick={() => {
          archiveContact(!isArchived);
        }}
        disabled={archiveContactMutation.isPending}
        loading={archiveContactMutation.isPending}
        variant="outline"
        fullWidth
        error={archiveError}
        icon={
          isArchived ? (
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
          ) : (
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
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          )
        }
        className="mb-3"
      >
        {isArchived ? "Unarchive Contact" : "Archive Contact"}
      </Button>
    </Card>
  );
}

