"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import Skeleton from "@/components/Skeleton";
import Modal from "@/components/Modal";
import Textarea from "@/components/Textarea";
import { reportException } from "@/lib/error-reporting";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import SavingIndicator from "@/components/contacts/SavingIndicator";

interface OutreachDraftCardProps {
  contactId: string;
  userId: string;
}

export default function OutreachDraftCard({
  contactId,
  userId,
}: OutreachDraftCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const updateMutation = useUpdateContact(userId);
  const { schedule, flush } = useDebouncedAutosave();
  
  const prevContactIdRef = useRef<string | null>(null);
  const lastSavedValuesRef = useRef<string | null>(null);
  
  const [localDraft, setLocalDraft] = useState<string>("");
  const [modalContent, setModalContent] = useState<"no-email" | "no-draft" | null>(null);
  
  // Use ref to store current value so save function always reads latest state
  const localDraftRef = useRef(localDraft);
  
  // Keep ref in sync with state
  useEffect(() => {
    localDraftRef.current = localDraft;
  }, [localDraft]);
  
  // Reset form state only when contactId changes (switching to a different contact)
  // Don't reset when contact data updates from our own save
  useEffect(() => {
    if (!contact) return;
    
    // Only reset if we're switching to a different contact
    if (prevContactIdRef.current !== contact.contactId) {
      prevContactIdRef.current = contact.contactId;
      lastSavedValuesRef.current = null; // Clear saved values when switching contacts
      setLocalDraft(contact.outreachDraft ?? "");
      return;
    }
    
    // If contact data updated but it matches what we just saved, don't reset
    if (lastSavedValuesRef.current !== null) {
      const contactDraft = contact.outreachDraft ?? "";
      if (contactDraft === lastSavedValuesRef.current) {
        // This update came from our save, don't reset form
        return;
      }
    }
    
    // Only update if form value matches the old contact value (user hasn't made changes)
    if (localDraft === (contact.outreachDraft ?? "")) {
      // Form hasn't been edited, safe to update from contact
      setLocalDraft(contact.outreachDraft ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.outreachDraft]);

  // Save function for autosave - reads from ref to always get latest value
  const saveDraft = useMemo(() => {
    return async () => {
      if (!contact) return;
      
      // Read current form value from ref (always latest, even if scheduled before state update)
      const currentDraft = localDraftRef.current || null;
      
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          {
            contactId,
            updates: { outreachDraft: currentDraft },
          },
          {
            onSuccess: () => {
              // Remember what we saved so we don't reset form when contact refetches
              lastSavedValuesRef.current = currentDraft ?? "";
              resolve();
            },
            onError: (error) => {
              reportException(error, {
                context: "Saving outreach draft in OutreachDraftCard",
                tags: { component: "OutreachDraftCard", contactId },
              });
              reject(error);
            },
          }
        );
      });
    };
  }, [contact, contactId, updateMutation]);

  const openGmailCompose = async () => {
    if (!contact?.primaryEmail) {
      setModalContent("no-email");
      return;
    }

    if (!localDraft.trim()) {
      setModalContent("no-draft");
      return;
    }

    // Flush any pending saves before opening Gmail
    try {
      await flush("draft");
    } catch (error) {
      // Continue anyway - don't block user from opening Gmail
      reportException(error as Error, {
        context: "Auto-saving outreach draft before opening Gmail in OutreachDraftCard",
        tags: { component: "OutreachDraftCard", contactId },
      });
    }

    // Open Gmail
    const email = encodeURIComponent(contact.primaryEmail);
    const body = encodeURIComponent(localDraft);
    const subject = encodeURIComponent("Follow up");
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${email}&body=${body}&su=${subject}`;
    window.open(gmailUrl, "_blank");
  };

  if (!contact) {
    return (
      <Card padding="md">
        <Skeleton height="h-32" width="w-full" />
      </Card>
    );
  }

  return (
    <>
      {/* Error Modal */}
      <Modal
        isOpen={modalContent !== null}
        onClose={() => setModalContent(null)}
        title={modalContent === "no-email" ? "No Email Address" : "No Draft Message"}
      >
        <p className="text-theme-dark mb-6">
          {modalContent === "no-email"
            ? "This contact does not have an email address."
            : "Please add a draft message before continuing in Gmail."}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setModalContent(null)}
            variant="outline"
            size="sm"
          >
            OK
          </Button>
        </div>
      </Modal>

      <Card padding="md" className="relative">
        <SavingIndicator cardKey="draft" />
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold text-theme-darkest flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gray-400 shrink-0"
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
            <span className="truncate">Outreach Draft</span>
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            {localDraft.trim() && contact.primaryEmail && (
              <Button
                onClick={openGmailCompose}
                variant="link"
                size="sm"
                aria-label="Open this draft in Gmail"
                className="whitespace-nowrap"
                icon={
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                }
              >
                <span className="hidden sm:inline">Continue in Gmail</span>
                <span className="sm:hidden">Gmail</span>
              </Button>
            )}
          </div>
        </div>
      <p className="text-sm text-theme-dark mb-4">
        Draft and refine your email messages before sending. Your draft is automatically saved and can be opened directly in Gmail when ready to send.
      </p>
      <Textarea
        id="outreach-draft"
        name="outreach-draft"
        value={localDraft}
        onChange={(e) => {
          setLocalDraft(e.target.value);
          schedule("draft", saveDraft);
        }}
        onBlur={() => flush("draft")}
        placeholder="Write your outreach draft here..."
        className="min-h-[120px] text-foreground resize-y font-sans text-sm leading-relaxed"
      />
      </Card>
    </>
  );
}

