"use client";

import { useState, useRef, useEffect } from "react";
import { useDeleteContact, useArchiveContact } from "@/hooks/useContactMutations";
import { useContact } from "@/hooks/useContact";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { extractErrorMessage, ErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import { getDisplayName } from "@/util/contact-utils";
import { isOwnerContact } from "@/lib/contacts/owner-utils";
import MergeContactsModal from "./MergeContactsModal";

interface ContactDetailMenuProps {
  contactId: string;
  userId: string;
}

export default function ContactDetailMenu({
  contactId,
  userId,
}: ContactDetailMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncGmailError, setSyncGmailError] = useState<string | null>(null);
  const [syncGmailSuccess, setSyncGmailSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: contact } = useContact(userId, contactId);
  const { user } = useAuth();

  const deleteContactMutation = useDeleteContact();
  const archiveContactMutation = useArchiveContact(userId);

  // Check if this is the owner contact
  const isOwner = contact?.primaryEmail && user?.email
    ? isOwnerContact(user.email, contact.primaryEmail)
    : false;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleArchive = () => {
    if (!contact) return;
    setArchiveError(null);
    archiveContactMutation.mutate(
      {
        contactId,
        archived: !contact.archived,
      },
      {
        onSuccess: () => {
          setShowArchiveModal(false);
          setIsOpen(false);
        },
        onError: (error) => {
          reportException(error, {
            context: "Archiving contact in ContactDetailMenu",
            tags: { component: "ContactDetailMenu", contactId },
          });
          setArchiveError(extractErrorMessage(error));
        },
      }
    );
  };

  const handleDelete = () => {
    setDeleteError(null);
    deleteContactMutation.mutate(contactId, {
      onSuccess: () => {
        setShowDeleteModal(false);
        setIsOpen(false);
        // Navigate to contacts page
        window.location.href = "/contacts";
      },
      onError: (error) => {
        reportException(error, {
          context: "Deleting contact in ContactDetailMenu",
          tags: { component: "ContactDetailMenu", contactId },
        });
        setDeleteError(extractErrorMessage(error));
      },
    });
  };

  const handleSyncGmail = async () => {
    if (!contact?.primaryEmail) {
      setSyncGmailError("Contact does not have an email address");
      return;
    }

    setSyncingGmail(true);
    setSyncGmailError(null);
    setSyncGmailSuccess(false);
    setIsOpen(false);

    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/sync-gmail`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = `Sync failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.ok) {
        const errorMsg = data.error || "Gmail sync failed. Please try again.";
        throw new Error(errorMsg);
      }

      // Invalidate React Query cache to trigger a refetch of contact data
      // This ensures the contact insights and outreach draft appear immediately
      queryClient.invalidateQueries({ queryKey: ["contact", userId, contactId] });
      queryClient.invalidateQueries({ queryKey: ["contacts", userId] });

      // Show success message
      setSyncGmailSuccess(true);
      // Clear success message after 5 seconds to allow reading
      setTimeout(() => setSyncGmailSuccess(false), 5000);
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      setSyncGmailError(errorMessage);
      reportException(error, {
        context: "Syncing Gmail for contact in ContactDetailMenu",
        tags: { component: "ContactDetailMenu", contactId },
      });
    } finally {
      setSyncingGmail(false);
    }
  };

  if (!contact) return null;

  const contactName = getDisplayName(contact);
  const isArchived = contact.archived || false;

  return (
    <>
      {/* Merge Contacts Modal */}
      {contact && (
        <MergeContactsModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          primaryContactId={contactId}
          userId={userId}
          primaryContact={{
            contactId: contact.contactId,
            firstName: contact.firstName,
            lastName: contact.lastName,
            primaryEmail: contact.primaryEmail,
            secondaryEmails: contact.secondaryEmails,
            photoUrl: contact.photoUrl,
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Contact"
        closeOnBackdropClick={!deleteContactMutation.isPending}
      >
        <p className="text-theme-dark mb-6">
          Are you sure you want to delete <strong>{contactName}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setShowDeleteModal(false)}
            disabled={deleteContactMutation.isPending}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteContactMutation.isPending}
            loading={deleteContactMutation.isPending}
            variant="danger"
            size="sm"
            error={deleteError}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Archive/Unarchive Confirmation Modal */}
      <Modal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title={isArchived ? "Unarchive Contact" : "Archive Contact"}
        closeOnBackdropClick={!archiveContactMutation.isPending}
      >
        <p className="text-theme-dark mb-6">
          {isArchived
            ? `Are you sure you want to unarchive ${contactName}? They will appear in your contacts list again.`
            : `Are you sure you want to archive ${contactName}? They will be hidden from your main contacts view but can be restored later.`}
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setShowArchiveModal(false)}
            disabled={archiveContactMutation.isPending}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleArchive}
            disabled={archiveContactMutation.isPending}
            loading={archiveContactMutation.isPending}
            variant="primary"
            size="sm"
            error={archiveError}
          >
            {isArchived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </Modal>

      {/* Sync Gmail Loading State - Persistent while generating insights */}
      {syncingGmail && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 flex items-start gap-3 shadow-lg">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-800">Generating Contact Insights</p>
              <p className="text-sm text-blue-700 mt-1">
                Syncing email threads and generating AI insights. You can continue using the app—the page will update automatically when complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Gmail Error Message */}
      {syncGmailError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <ErrorMessage
            message={syncGmailError}
            dismissible
            onDismiss={() => setSyncGmailError(null)}
          />
        </div>
      )}

      {/* Sync Gmail Success Message */}
      {syncGmailSuccess && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className="bg-green-50 border border-green-200 rounded-sm p-4 flex items-start gap-3 shadow-lg">
            <svg
              className="w-5 h-5 text-green-600 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-800">Contact Insights Generated</p>
              <p className="text-sm text-green-700 mt-1">
                Email threads synced and contact insights generated. The contact page has been updated automatically.
              </p>
            </div>
            <button
              onClick={() => setSyncGmailSuccess(false)}
              className="text-green-600 hover:text-green-800 shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-1.5 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isOpen 
              ? "bg-card-light" 
              : "hover:bg-card-light"
          }`}
          aria-label="Contact options"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute right-0 top-full mt-1 z-20 w-48 bg-card-highlight-light border border-theme-lighter rounded-sm shadow-lg py-1"
              role="menu"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (!isOwner) {
                    handleSyncGmail();
                  }
                }}
                disabled={syncingGmail || !contact?.primaryEmail || isOwner}
                title={isOwner ? "Gmail insights are not available for owner contacts" : undefined}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-selected-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                role="menuitem"
              >
                {syncingGmail ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
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
                    Sync Gmail
                  </>
                )}
              </button>
              <div className="border-t border-theme-lighter my-1" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setShowMergeModal(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-selected-active transition-colors"
                role="menuitem"
              >
                Merge Contacts
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setShowArchiveModal(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-selected-active transition-colors"
                role="menuitem"
              >
                {isArchived ? "Unarchive" : "Archive"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setShowDeleteModal(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-error-red-text hover:bg-selected-active transition-colors"
                role="menuitem"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

