"use client";

import { useState, useMemo } from "react";
import BulkActionsBar from "@/components/BulkActionsBar";
import BulkActionModal from "./BulkActionModal";
import { useContactsFilter } from "./ContactsFilterContext";
import { useBulkArchiveContacts, useBulkUpdateSegments, useBulkUpdateTags, useBulkUpdateCompanies } from "@/hooks/useContactMutations";
import { reportException, reportMessage, ErrorLevel } from "@/lib/error-reporting";
import { Contact } from "@/types/firestore";

interface ContactWithId extends Contact {
  id: string;
}

interface ContactsBulkActionsProps {
  userId: string;
  contacts: ContactWithId[];
}

export default function ContactsBulkActions({ userId, contacts }: ContactsBulkActionsProps) {
  const [modalType, setModalType] = useState<"segment" | "tags" | "company" | null>(null);
  const [selectedNewSegment, setSelectedNewSegment] = useState<string>("");
  const [selectedNewTags, setSelectedNewTags] = useState<string>("");
  const [selectedNewCompany, setSelectedNewCompany] = useState<string>("");

  const {
    filteredContacts,
    selectedContactIds,
    setSelectedContactIds,
    showArchived,
  } = useContactsFilter();

  // Use mutation hooks for bulk operations
  const bulkArchiveMutation = useBulkArchiveContacts();
  const bulkSegmentMutation = useBulkUpdateSegments();
  const bulkTagsMutation = useBulkUpdateTags();
  const bulkCompanyMutation = useBulkUpdateCompanies();

  // Get unique segments from all contacts for the bulk update dropdown
  const uniqueSegments = useMemo(
    () =>
      Array.from(new Set(contacts.map((c) => c.segment).filter(Boolean) as string[])).sort(),
    [contacts]
  );

  const handleBulkSegmentUpdate = async (newSegment: string | null) => {
    if (!userId || selectedContactIds.size === 0) return;

    const contactIdsArray = Array.from(selectedContactIds);
    
    bulkSegmentMutation.mutate(
      { contactIds: contactIdsArray, segment: newSegment },
      {
        onSuccess: (result) => {
          if (result.errors > 0) {
            alert(
              `Updated ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
            );
            reportMessage("Bulk update errors occurred", ErrorLevel.WARNING, {
              tags: { component: "ContactsBulkActions" },
              extra: { errorDetails: result.errorDetails },
            });
          } else {
            reportMessage(`Successfully updated ${result.success} contact(s)`, ErrorLevel.INFO, {
              tags: { component: "ContactsBulkActions" },
            });
          }

          setSelectedContactIds(new Set());
          setModalType(null);
          setSelectedNewSegment("");
        },
        onError: (error) => {
          reportException(error, {
            context: "Bulk segment update",
            tags: { component: "ContactsBulkActions" },
          });
          alert("Failed to update contacts. Please try again.");
        },
      }
    );
  };

  const handleBulkTagsUpdate = async (tagsString: string) => {
    if (!userId || selectedContactIds.size === 0) return;

    // Parse comma-separated tags
    const tags = tagsString
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const contactIdsArray = Array.from(selectedContactIds);
    
    bulkTagsMutation.mutate(
      { contactIds: contactIdsArray, tags },
      {
        onSuccess: (result) => {
          if (result.errors > 0) {
            alert(
              `Updated ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
            );
            reportMessage("Bulk tag update errors occurred", ErrorLevel.WARNING, {
              tags: { component: "ContactsBulkActions" },
              extra: { errorDetails: result.errorDetails },
            });
          } else {
            reportMessage(`Successfully updated ${result.success} contact(s)`, ErrorLevel.INFO, {
              tags: { component: "ContactsBulkActions" },
            });
          }

          setSelectedContactIds(new Set());
          setModalType(null);
          setSelectedNewTags("");
        },
        onError: (error) => {
          reportException(error, {
            context: "Bulk tag update",
            tags: { component: "ContactsBulkActions" },
          });
          alert("Failed to update contacts. Please try again.");
        },
      }
    );
  };

  const handleBulkCompanyUpdate = async (newCompany: string | null) => {
    if (!userId || selectedContactIds.size === 0) return;

    const contactIdsArray = Array.from(selectedContactIds);
    
    bulkCompanyMutation.mutate(
      { contactIds: contactIdsArray, company: newCompany },
      {
        onSuccess: (result) => {
          if (result.errors > 0) {
            alert(
              `Updated ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
            );
            reportMessage("Bulk company update errors occurred", ErrorLevel.WARNING, {
              tags: { component: "ContactsBulkActions" },
              extra: { errorDetails: result.errorDetails },
            });
          } else {
            reportMessage(`Successfully updated ${result.success} contact(s)`, ErrorLevel.INFO, {
              tags: { component: "ContactsBulkActions" },
            });
          }

          setSelectedContactIds(new Set());
          setModalType(null);
          setSelectedNewCompany("");
        },
        onError: (error) => {
          reportException(error, {
            context: "Bulk company update",
            tags: { component: "ContactsBulkActions" },
          });
          alert("Failed to update contacts. Please try again.");
        },
      }
    );
  };

  const handleBulkArchive = async (archived: boolean) => {
    if (!userId || selectedContactIds.size === 0) return;

    const contactIdsArray = Array.from(selectedContactIds);
    
    bulkArchiveMutation.mutate(
      { contactIds: contactIdsArray, archived },
      {
        onSuccess: (result) => {
          if (result.errors > 0) {
            alert(
              `${archived ? "Archived" : "Unarchived"} ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
            );
            reportMessage("Bulk archive errors occurred", ErrorLevel.WARNING, {
              tags: { component: "ContactsBulkActions" },
              extra: { errorDetails: result.errorDetails },
            });
          } else {
            // Success - clear selection
            setSelectedContactIds(new Set());
          }
        },
        onError: (error) => {
          reportException(error, {
            context: "Bulk archiving contacts",
            tags: { component: "ContactsBulkActions" },
            extra: { archived },
          });
          alert(`Failed to ${archived ? "archive" : "unarchive"} contacts. Please try again.`);
        },
      }
    );
  };

  const handleModalClose = () => {
    setModalType(null);
    if (modalType === "segment") setSelectedNewSegment("");
    if (modalType === "tags") setSelectedNewTags("");
    if (modalType === "company") setSelectedNewCompany("");
  };

  return (
    <div>
      {/* Bulk Action Bar */}
      {selectedContactIds.size > 0 && filteredContacts.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedContactIds.size}
          itemLabel="contact"
          actions={[
            {
              label: "Reassign Segment",
              onClick: () => setModalType("segment"),
              variant: "primary",
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              ),
            },
            {
              label: "Reassign Company",
              onClick: () => setModalType("company"),
              variant: "primary",
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              ),
            },
            {
              label: "Update Tags",
              onClick: () => setModalType("tags"),
              variant: "primary",
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              ),
            },
            ...(!showArchived
              ? [
                  {
                    label: "Archive",
                    onClick: () => handleBulkArchive(true),
                    variant: "outline" as const,
                    disabled: bulkArchiveMutation.isPending,
                    loading: bulkArchiveMutation.isPending,
                    showCount: true,
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                        />
                      </svg>
                    ),
                  },
                ]
              : [
                  {
                    label: "Unarchive",
                    onClick: () => handleBulkArchive(false),
                    variant: "secondary" as const,
                    disabled: bulkArchiveMutation.isPending,
                    loading: bulkArchiveMutation.isPending,
                    showCount: true,
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    ),
                  },
                ]),
          ]}
        />
      )}

      {/* Bulk Action Modal */}
      <BulkActionModal
        modalType={modalType}
        onClose={handleModalClose}
        selectedCount={selectedContactIds.size}
        selectedNewSegment={selectedNewSegment}
        setSelectedNewSegment={setSelectedNewSegment}
        uniqueSegments={uniqueSegments}
        bulkSegmentMutation={bulkSegmentMutation}
        onSegmentUpdate={handleBulkSegmentUpdate}
        selectedNewTags={selectedNewTags}
        setSelectedNewTags={setSelectedNewTags}
        bulkTagsMutation={bulkTagsMutation}
        onTagsUpdate={handleBulkTagsUpdate}
        selectedNewCompany={selectedNewCompany}
        setSelectedNewCompany={setSelectedNewCompany}
        bulkCompanyMutation={bulkCompanyMutation}
        onCompanyUpdate={handleBulkCompanyUpdate}
      />
    </div>
  );
}

