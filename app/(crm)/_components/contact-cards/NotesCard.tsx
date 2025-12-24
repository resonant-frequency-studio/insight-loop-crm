"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import Textarea from "@/components/Textarea";
import { reportException } from "@/lib/error-reporting";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import SavingIndicator from "@/components/contacts/SavingIndicator";

interface NotesCardProps {
  contactId: string;
  userId: string;
}

export default function NotesCard({ contactId, userId }: NotesCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { schedule, flush } = useDebouncedAutosave();
  
  const prevContactIdRef = useRef<string | null>(null);
  const lastSavedValuesRef = useRef<string | null>(null);
  
  // Initialize form state from contact using lazy initialization
  const [notes, setNotes] = useState("");
  
  // Use ref to store current value so save function always reads latest state
  const notesRef = useRef(notes);
  
  // Keep ref in sync with state
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  
  // Reset form state only when contactId changes (switching to a different contact)
  // Don't reset when contact data updates from our own save
  useEffect(() => {
    if (!contact) return;
    
    // Only reset if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      lastSavedValuesRef.current = null; // Clear saved values when switching contacts
      setNotes(contact.notes ?? "");
      return;
    }
    
    // If contact data updated but it matches what we just saved, don't reset
    if (lastSavedValuesRef.current !== null) {
      const contactNotes = contact.notes ?? "";
      if (contactNotes === lastSavedValuesRef.current) {
        // This update came from our save, don't reset form
        return;
      }
    }
    
    // Only update if form value matches the old contact value (user hasn't made changes)
    if (notes === (contact.notes ?? "")) {
      // Form hasn't been edited, safe to update from contact
      setNotes(contact.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.notes]);

  // Save function for autosave - reads from ref to always get latest value
  const saveNotes = useMemo(() => {
    return async () => {
      if (!contact) return;
      
      // Read current form value from ref (always latest, even if scheduled before state update)
      const currentNotes = notesRef.current || null;
      
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          {
            contactId,
            updates: {
              notes: currentNotes,
            },
          },
          {
            onSuccess: () => {
              // Remember what we saved so we don't reset form when contact refetches
              lastSavedValuesRef.current = currentNotes ?? "";
              resolve();
            },
            onError: (error) => {
              reportException(error, {
                context: "Saving notes in NotesCard",
                tags: { component: "NotesCard", contactId },
              });
              reject(error);
            },
          }
        );
      });
    };
  }, [contact, contactId, updateMutation]);

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-32" width="w-full" />
      </Card>
    );
  }

  return (
    <Card padding="md" className="relative">
      <SavingIndicator cardKey="notes" />
      <div className="mb-4">
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
      </div>
      <Textarea
        id="contact-notes"
        name="contact-notes"
        rows={6}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          schedule("notes", saveNotes);
        }}
        onBlur={() => flush("notes")}
        placeholder="Add notes about this contact..."
      />
    </Card>
  );
}

