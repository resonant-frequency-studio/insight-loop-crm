"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { Contact } from "@/types/firestore";
import ExportContactsButton from "../_components/ExportContactsButton";
import ContactsFilter from "../_components/ContactsFilter";
import Card from "@/components/Card";
import { useFilterContacts } from "@/hooks/useFilterContacts";
import Modal from "@/components/Modal";
import SegmentSelect from "../_components/SegmentSelect";
import ContactCard from "../_components/ContactCard";
import { Button } from "@/components/Button";
import { reportException, reportMessage, ErrorLevel } from "@/lib/error-reporting";
import { bulkUpdateContactSegments } from "@/lib/firestore-crud";
import { useAuth } from "@/hooks/useAuth";
import { useContacts } from "@/hooks/useContacts";
import { useBulkArchiveContacts } from "@/hooks/useContactMutations";
import { getInitials, getDisplayName } from "@/util/contact-utils";

interface ContactWithId extends Contact {
  id: string;
  displayName?: string;
  initials?: string;
}

interface ContactsPageClientProps {
  initialContacts: ContactWithId[];
}

export default function ContactsPageClient({
  initialContacts,
}: ContactsPageClientProps) {
  const { user } = useAuth();
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showBulkSegmentModal, setShowBulkSegmentModal] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState({ completed: 0, total: 0 });
  const [selectedNewSegment, setSelectedNewSegment] = useState<string>("");

  // Use React Query hook for contacts (will use cached data if available)
  const { data: contactsData = [] } = useContacts(user?.uid || "");
  
  // Map contacts to include id, displayName, and initials
  const contacts: ContactWithId[] = (contactsData.length > 0 ? contactsData : initialContacts).map((contact) => {
    const contactForUtils: Contact = {
      ...contact,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return {
      ...contact,
      id: contact.contactId,
      displayName: getDisplayName(contactForUtils),
      initials: getInitials(contactForUtils),
    };
  });

  // Use mutation hook for bulk archive
  const bulkArchiveMutation = useBulkArchiveContacts(user?.uid);

  // Use filtering hook
  const filterContacts = useFilterContacts(contacts);
  const {
    filteredContacts,
    hasActiveFilters,
    onClearFilters,
    showArchived,
    setShowArchived,
  } = filterContacts;

  // Get unique segments from all contacts for the bulk update dropdown
  const uniqueSegments = useMemo(
    () =>
      Array.from(new Set(initialContacts.map((c) => c.segment).filter(Boolean) as string[])).sort(),
    [initialContacts]
  );

  // Check if all filtered contacts are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredContacts.length === 0) return false;
    return filteredContacts.every((contact) => selectedContactIds.has(contact.id));
  }, [filteredContacts, selectedContactIds]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedContactIds(new Set());
  }, [
    filterContacts.selectedSegment,
    filterContacts.selectedTags,
    filterContacts.emailSearch,
    filterContacts.firstNameSearch,
    filterContacts.lastNameSearch,
  ]);

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleBulkSegmentUpdate = async (newSegment: string | null) => {
    if (!user || selectedContactIds.size === 0) return;

    setBulkUpdating(true);
    setBulkUpdateProgress({ completed: 0, total: selectedContactIds.size });

    try {
      const contactIdsArray = Array.from(selectedContactIds);
      const result = await bulkUpdateContactSegments(
        user.uid,
        contactIdsArray,
        newSegment,
        (completed, total) => {
          setBulkUpdateProgress({ completed, total });
        }
      );

      if (result.errors > 0) {
        alert(
          `Updated ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
        );
        reportMessage("Bulk update errors occurred", ErrorLevel.WARNING, {
          tags: { component: "ContactsPageClient" },
          extra: { errorDetails: result.errorDetails },
        });
      } else {
        reportMessage(`Successfully updated ${result.success} contact(s)`, ErrorLevel.INFO, {
          tags: { component: "ContactsPageClient" },
        });
      }

      setSelectedContactIds(new Set());
      setShowBulkSegmentModal(false);
      setSelectedNewSegment("");
      // React Query will automatically refetch contacts after mutation
    } catch (error) {
      reportException(error, {
        context: "Bulk segment update",
        tags: { component: "ContactsPageClient" },
      });
      alert("Failed to update contacts. Please try again.");
    } finally {
      setBulkUpdating(false);
      setBulkUpdateProgress({ completed: 0, total: 0 });
    }
  };

  const handleBulkArchive = async (archived: boolean) => {
    if (!user || selectedContactIds.size === 0) return;

    setBulkUpdating(true);
    setBulkUpdateProgress({ completed: 0, total: selectedContactIds.size });

    try {
      const contactIdsArray = Array.from(selectedContactIds);
      const result = await bulkArchiveMutation.mutateAsync({
        contactIds: contactIdsArray,
        archived: archived,
      });

      if (result.errors > 0) {
        alert(
          `${archived ? "Archived" : "Unarchived"} ${result.success} contact(s), but ${result.errors} failed. Check console for details.`
        );
        reportMessage("Bulk archive errors occurred", ErrorLevel.WARNING, {
          tags: { component: "ContactsPageClient" },
          extra: { errorDetails: result.errorDetails },
        });
      } else {
        // Success - clear selection
        setSelectedContactIds(new Set());
      }
      // React Query will automatically invalidate and refetch contacts
    } catch (error) {
      reportException(error, {
        context: "Bulk archiving contacts",
        tags: { component: "ContactsPageClient" },
        extra: { archived },
      });
      alert(`Failed to ${archived ? "archive" : "unarchive"} contacts. Please try again.`);
    } finally {
      setBulkUpdating(false);
      setBulkUpdateProgress({ completed: 0, total: 0 });
    }
  };

  // Read the rest of the component from the original file to get the full JSX
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contacts</h1>
          <p className="text-gray-600 text-lg">
            {filteredContacts.length} of {initialContacts.length}{" "}
            {initialContacts.length === 1 ? "contact" : "contacts"}
            {hasActiveFilters && " (filtered)"}
          </p>
        </div>
        {/* Buttons - Mobile: below header, Desktop: right side */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:shrink-0 w-full sm:w-auto">
          <ExportContactsButton contacts={filteredContacts} />
          <Link href="/contacts/new" className="w-full sm:w-auto">
            <Button
              variant="gradient-blue"
              size="md"
              fullWidth
              className="whitespace-nowrap"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              Add Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Section */}
      <ContactsFilter
        contacts={initialContacts}
        {...filterContacts}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      {/* Bulk Action Bar */}
      {selectedContactIds.size > 0 && filteredContacts.length > 0 && (
        <Card padding="md" className="bg-blue-50 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedContactIds.size}{" "}
                {selectedContactIds.size === 1 ? "contact" : "contacts"} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowBulkSegmentModal(true)}
                variant="gradient-blue"
                size="sm"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                }
              >
                Reassign Segment
              </Button>
              {!showArchived ? (
                <Button
                  onClick={() => handleBulkArchive(true)}
                  disabled={bulkUpdating}
                  loading={bulkUpdating}
                  variant="gradient-gray"
                  size="sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                  }
                >
                  Archive ({selectedContactIds.size})
                </Button>
              ) : (
                <Button
                  onClick={() => handleBulkArchive(false)}
                  disabled={bulkUpdating}
                  loading={bulkUpdating}
                  variant="gradient-green"
                  size="sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  }
                >
                  Unarchive ({selectedContactIds.size})
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Contacts Grid - Only the list is suspended */}
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-2/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      >
        {filteredContacts.length === 0 && initialContacts.length > 0 ? (
          <Card padding="xl" className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">No contacts match your filters</p>
            <p className="text-sm text-gray-500 mb-6">
              Try adjusting your search criteria or clear filters to see all contacts
            </p>
            <Button onClick={onClearFilters} variant="gradient-blue" size="sm">
              Clear Filters
            </Button>
          </Card>
        ) : filteredContacts.length === 0 ? (
          <Card padding="xl" className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">No contacts yet</p>
            <p className="text-sm text-gray-500 mb-6">Start by importing contacts from a CSV file</p>
            <Link
              href="/contacts/import"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Import Contacts
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select All Checkbox */}
            {filteredContacts.length > 0 && (
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select all {filteredContacts.length}{" "}
                    {filteredContacts.length === 1 ? "contact" : "contacts"}
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.has(contact.id);
                return (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    showCheckbox={true}
                    isSelected={isSelected}
                    onSelectChange={toggleContactSelection}
                    variant={isSelected ? "selected" : "default"}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Suspense>

      {/* Bulk Segment Reassignment Modal */}
      <Modal
        isOpen={showBulkSegmentModal}
        onClose={() => !bulkUpdating && setShowBulkSegmentModal(false)}
        title="Reassign Segment"
        closeOnBackdropClick={!bulkUpdating}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Update the segment for{" "}
            <strong className="font-semibold text-gray-900">{selectedContactIds.size}</strong>{" "}
            selected {selectedContactIds.size === 1 ? "contact" : "contacts"}.
          </p>

          {bulkUpdating ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg
                  className="animate-spin h-5 w-5 text-blue-600"
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
                <span className="text-sm font-medium text-gray-900">
                  Updating {bulkUpdateProgress.completed} of {bulkUpdateProgress.total} contacts...
                </span>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  New Segment
                </label>
                <SegmentSelect
                  value={selectedNewSegment || null}
                  onChange={(value) => setSelectedNewSegment(value || "")}
                  existingSegments={uniqueSegments}
                  placeholder="Enter or select segment..."
                />
                <p className="mt-2 text-xs text-gray-600">
                  Select an existing segment from the dropdown, or type a new segment name to create
                  it. Choose &quot;No Segment&quot; to clear.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  onClick={() => {
                    setShowBulkSegmentModal(false);
                    setSelectedNewSegment("");
                  }}
                  disabled={bulkUpdating}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const newSegment = selectedNewSegment.trim() || null;
                    handleBulkSegmentUpdate(newSegment);
                    setSelectedNewSegment("");
                  }}
                  disabled={bulkUpdating}
                  loading={bulkUpdating}
                  variant="gradient-blue"
                  size="sm"
                >
                  Update Segment
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

