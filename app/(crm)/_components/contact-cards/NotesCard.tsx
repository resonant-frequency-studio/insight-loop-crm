"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import SaveButtonWithIndicator from "./SaveButtonWithIndicator";
import Textarea from "@/components/Textarea";
import { reportException } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";
import { useSavingState } from "@/contexts/SavingStateContext";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NotesCardProps {
  contactId: string;
  userId: string;
}

export default function NotesCard({ contactId, userId }: NotesCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `notes-${contactId}`;
  
  const prevContactIdRef = useRef<Contact | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [notes, setNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  // Register/unregister save status with context
  useEffect(() => {
    registerSaveStatus(cardId, saveStatus);
    return () => {
      unregisterSaveStatus(cardId);
    };
  }, [saveStatus, cardId, registerSaveStatus, unregisterSaveStatus]);
  
  // Reset form state when contactId changes (different contact loaded)
  // Using contactId prop as dependency ensures we only update when switching contacts
  useEffect(() => {
    if (!contact) return;
    if (prevContactIdRef.current !== contact) {
      prevContactIdRef.current = contact;
      // Batch state updates to avoid cascading renders
      setNotes(contact.notes ?? "");
      setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.updatedAt]);

  // Track changes using useMemo instead of useEffect
  const hasUnsavedChanges = useMemo(() => {
    if (!contact) return false;
    return notes !== (contact.notes ?? "");
  }, [notes, contact]);

  const saveChanges = () => {
    if (!hasUnsavedChanges || !contact) return;

    setSaveStatus("saving");
    updateMutation.mutate(
      {
        contactId,
        updates: {
          notes: notes || null,
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
            context: "Saving notes in NotesCard",
            tags: { component: "NotesCard", contactId },
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
        <Skeleton height="h-32" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Notes
        </h2>
        <SaveButtonWithIndicator
          saveStatus={saveStatus}
          hasUnsavedChanges={hasUnsavedChanges}
          onSave={saveChanges}
        />
      </div>
      <Textarea
        id="contact-notes"
        name="contact-notes"
        rows={6}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this contact..."
      />
    </Card>
  );
}

