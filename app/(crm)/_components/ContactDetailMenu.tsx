"use client";

import { useState, useRef, useEffect } from "react";
import { useDeleteContact, useArchiveContact } from "@/hooks/useContactMutations";
import { useContact } from "@/hooks/useContact";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { extractErrorMessage } from "@/components/ErrorMessage";
import { reportException } from "@/lib/error-reporting";
import { getDisplayName } from "@/util/contact-utils";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: contact } = useContact(userId, contactId);

  const deleteContactMutation = useDeleteContact();
  const archiveContactMutation = useArchiveContact(userId);

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
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-selected-active transition-colors"
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

