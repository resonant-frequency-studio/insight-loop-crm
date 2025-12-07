"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase-client";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Contact } from "@/types/firestore";
import ExportContactsButton from "@/components/ExportContactsButton";
import ContactsFilter from "@/components/ContactsFilter";
import Card from "@/components/Card";
import { useFilterContacts } from "@/hooks/useFilterContacts";
import Loading from "@/components/Loading";
import { bulkUpdateContactSegments } from "@/lib/firestore-crud";
import Modal from "@/components/Modal";
import SegmentSelect from "@/components/SegmentSelect";
import ContactCard from "@/components/ContactCard";
import { Button } from "@/components/Button";

interface ContactWithId extends Contact {
  id: string;
}

export default function ContactsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactWithId[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showBulkSegmentModal, setShowBulkSegmentModal] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState({ completed: 0, total: 0 });
  const [selectedNewSegment, setSelectedNewSegment] = useState<string>("");
  
  // Use filtering hook
  const filterContacts = useFilterContacts(contacts);
  const { filteredContacts, hasActiveFilters, onClearFilters, showArchived, setShowArchived } = filterContacts;
  
  // Get unique segments from all contacts for the bulk update dropdown
  const uniqueSegments = useMemo(() => 
    Array.from(new Set(contacts.map(c => c.segment).filter(Boolean) as string[])).sort(),
    [contacts]
  );
  
  // Check if all filtered contacts are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredContacts.length === 0) return false;
    return filteredContacts.every(contact => selectedContactIds.has(contact.id));
  }, [filteredContacts, selectedContactIds]);
  
  // Clear selection when filters change
  useEffect(() => {
    setSelectedContactIds(new Set());
  }, [filterContacts.selectedSegment, filterContacts.selectedTags, filterContacts.emailSearch, filterContacts.firstNameSearch, filterContacts.lastNameSearch]);
  
  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
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
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
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
        alert(`Updated ${result.success} contact(s), but ${result.errors} failed. Check console for details.`);
        console.error("Bulk update errors:", result.errorDetails);
      } else {
        // Success - clear selection and close modal
        setSelectedContactIds(new Set());
        setShowBulkSegmentModal(false);
      }
    } catch (error) {
      console.error("Error updating contacts:", error);
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
      const response = await fetch("/api/contacts/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: contactIdsArray,
          archived: archived,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to archive contacts");
      }

      const result = await response.json();
      
      if (result.errors > 0) {
        alert(`${archived ? "Archived" : "Unarchived"} ${result.success} contact(s), but ${result.errors} failed. Check console for details.`);
        console.error("Bulk archive errors:", result.errorDetails);
      } else {
        // Success - clear selection
        setSelectedContactIds(new Set());
      }
    } catch (error) {
      console.error("Error archiving contacts:", error);
      alert(`Failed to ${archived ? "archive" : "unarchive"} contacts. Please try again.`);
    } finally {
      setBulkUpdating(false);
      setBulkUpdateProgress({ completed: 0, total: 0 });
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/contacts`),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ContactWithId));
      setContacts(contactsData);
    });

    return () => unsub();
  }, [user, loading, router]);



  if (loading) {
    return <Loading />;
  }
  
  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contacts</h1>
          <p className="text-gray-600 text-lg">
            {filteredContacts.length} of {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
            {hasActiveFilters && " (filtered)"}
          </p>
        </div>
        {/* Buttons - Mobile: below header, Desktop: right side */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:shrink-0 w-full sm:w-auto">
          <ExportContactsButton contacts={filteredContacts} />
          <Link
            href="/contacts/new"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium active:scale-95"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Contact
          </Link>
        </div>
      </div>

      {/* Filters Section */}
      <ContactsFilter 
        contacts={contacts} 
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
                {selectedContactIds.size} {selectedContactIds.size === 1 ? "contact" : "contacts"} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowBulkSegmentModal(true)}
                variant="gradient-blue"
                size="sm"
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
                  }
                >
                  Unarchive ({selectedContactIds.size})
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Contacts Grid */}
      {filteredContacts.length === 0 && contacts.length > 0 ? (
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
          <Button
            onClick={onClearFilters}
            variant="gradient-blue"
            size="sm"
          >
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
          <p className="text-sm text-gray-500 mb-6">
            Start by importing contacts from a CSV file
          </p>
          <Link
            href="/contacts/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm active:scale-95"
          >
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
                  Select all {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
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

      {/* Bulk Segment Reassignment Modal */}
      <Modal
        isOpen={showBulkSegmentModal}
        onClose={() => !bulkUpdating && setShowBulkSegmentModal(false)}
        title="Reassign Segment"
        closeOnBackdropClick={!bulkUpdating}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Update the segment for <strong className="font-semibold text-gray-900">{selectedContactIds.size}</strong> selected {selectedContactIds.size === 1 ? "contact" : "contacts"}.
          </p>
          
          {bulkUpdating ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                  Select an existing segment from the dropdown, or type a new segment name to create it. Choose &quot;No Segment&quot; to clear.
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
