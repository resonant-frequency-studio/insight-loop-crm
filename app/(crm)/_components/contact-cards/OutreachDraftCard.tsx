"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useContact } from "@/hooks/useContact";
import { useUpdateContact } from "@/hooks/useContactMutations";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import Card from "@/components/Card";
import SavingIndicator from "./SavingIndicator";
import { Button } from "@/components/Button";
import Modal from "@/components/Modal";
import { reportException } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";
import { useSavingState } from "@/contexts/SavingStateContext";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  const { registerSaveStatus, unregisterSaveStatus } = useSavingState();
  const cardId = `outreach-draft-${contactId}`;
  
  const prevContactIdRef = useRef<Contact | null>(null);
  
  const [localDraft, setLocalDraft] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [modalContent, setModalContent] = useState<"no-email" | "no-draft" | null>(null);
  
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
      setLocalDraft(contact.outreachDraft ?? "");
      setSaveStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.contactId, contact?.updatedAt]);

  // Track changes using useMemo instead of useEffect
  const hasUnsavedChanges = useMemo(() => {
    if (!contact) return false;
    return localDraft !== (contact.outreachDraft ?? "");
  }, [localDraft, contact]);

  const saveChanges = () => {
    if (!hasUnsavedChanges || !contact) return;

    setSaveStatus("saving");
    updateMutation.mutate(
      {
        contactId,
        updates: { outreachDraft: localDraft || null },
      },
      {
        onSuccess: () => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        },
        onError: (error) => {
          setSaveStatus("error");
          reportException(error, {
            context: "Saving outreach draft in OutreachDraftCard",
            tags: { component: "OutreachDraftCard", contactId },
          });
          setTimeout(() => setSaveStatus("idle"), 3000);
        },
      }
    );
  };

  const debouncedSave = useDebouncedSave(saveChanges, 500);

  const handleBlur = () => {
    if (hasUnsavedChanges) {
      debouncedSave();
    }
  };

  const openGmailCompose = () => {
    if (!contact?.primaryEmail) {
      setModalContent("no-email");
      return;
    }

    if (!localDraft.trim()) {
      setModalContent("no-draft");
      return;
    }

    // Auto-save the draft before opening Gmail (if there are unsaved changes)
    if (hasUnsavedChanges) {
      setSaveStatus("saving");
      updateMutation.mutate(
        {
          contactId,
          updates: { outreachDraft: localDraft || null },
        },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            // Open Gmail after save completes
            const email = encodeURIComponent(contact.primaryEmail);
            const body = encodeURIComponent(localDraft);
            const subject = encodeURIComponent("Follow up");
            const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${email}&body=${body}&su=${subject}`;
            window.open(gmailUrl, "_blank");
            setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: (error) => {
            setSaveStatus("error");
            reportException(error, {
              context: "Auto-saving outreach draft before opening Gmail in OutreachDraftCard",
              tags: { component: "OutreachDraftCard", contactId },
            });
            // Continue anyway - don't block user from opening Gmail
            const email = encodeURIComponent(contact.primaryEmail);
            const body = encodeURIComponent(localDraft);
            const subject = encodeURIComponent("Follow up");
            const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${email}&body=${body}&su=${subject}`;
            window.open(gmailUrl, "_blank");
            setTimeout(() => setSaveStatus("idle"), 3000);
          },
        }
      );
    } else {
      // No changes, just open Gmail
      const email = encodeURIComponent(contact.primaryEmail);
      const body = encodeURIComponent(localDraft);
      const subject = encodeURIComponent("Follow up");
      const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${email}&body=${body}&su=${subject}`;
      window.open(gmailUrl, "_blank");
    }
  };

  if (!contact) {
    return (
      <Card padding="md">
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
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
        <p className="text-gray-600 mb-6">
          {modalContent === "no-email"
            ? "This contact does not have an email address."
            : "Please add a draft message before continuing in Gmail."}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setModalContent(null)}
            variant="secondary"
            size="sm"
          >
            OK
          </Button>
        </div>
      </Modal>

      <Card padding="md">
        <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
          Outreach Draft
        </h2>
        <div className="flex items-center gap-3">
          <SavingIndicator status={saveStatus} />
          {localDraft.trim() && contact.primaryEmail && (
            <Button
              onClick={openGmailCompose}
              variant="gradient-blue"
              size="sm"
              title="Open this draft in Gmail"
              icon={
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              }
            >
              Continue in Gmail
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Draft and refine your email messages before sending. Your draft is automatically saved and can be opened directly in Gmail when ready to send.
      </p>
      <textarea
        id="outreach-draft"
        name="outreach-draft"
        value={localDraft}
        onChange={(e) => setLocalDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write your outreach draft here..."
        className="w-full min-h-[120px] px-4 py-3 text-gray-900 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 resize-y font-sans text-sm leading-relaxed"
      />
      </Card>
    </>
  );
}

