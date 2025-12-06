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
import { getInitials, getDisplayName, formatContactDate } from "@/util/contact-utils";
import { bulkUpdateContactSegments } from "@/lib/firestore-crud";
import Modal from "@/components/Modal";
import SegmentSelect from "@/components/SegmentSelect";

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
  const { filteredContacts, hasActiveFilters, onClearFilters } = filterContacts;
  
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
      <ContactsFilter contacts={contacts} {...filterContacts} />

      {/* Bulk Action Bar */}
      {selectedContactIds.size > 0 && filteredContacts.length > 0 && (
        <Card padding="md" className="bg-blue-50 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedContactIds.size} {selectedContactIds.size === 1 ? "contact" : "contacts"} selected
              </span>
            </div>
            <button
              onClick={() => setShowBulkSegmentModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm active:scale-95"
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
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              Reassign Segment
            </button>
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
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm active:scale-95"
          >
            Clear Filters
          </button>
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
                <div
                  key={contact.id}
                  className={`flex items-start gap-3 bg-gray-50 rounded-lg p-3 lg:p-4 hover:bg-gray-100 hover:shadow-sm transition-all duration-200 group ${
                    isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleContactSelection(contact.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Contact Card Content */}
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="flex-1 flex items-start lg:items-center gap-3"
                  >
                    {/* Avatar */}
                    <div className="shrink-0">
                      <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                        {getInitials(contact)}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm lg:text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {getDisplayName(contact)}
                      </h3>
                      <p className="text-xs lg:text-sm text-gray-500 truncate mb-1">{contact.primaryEmail}</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {contact.lastEmailDate != null && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="truncate">Last email: {formatContactDate(contact.lastEmailDate, { relative: true })}</span>
                          </p>
                        )}
                        {contact.updatedAt != null && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3 shrink-0"
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
                            <span className="truncate">Updated: {formatContactDate(contact.updatedAt, { relative: true })}</span>
                          </p>
                        )}
                      </div>

                      {/* Tags - Mobile: show below, Desktop: show on right */}
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 lg:hidden">
                          {contact.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                            >
                              {tag}
                            </span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-xs font-medium text-gray-500">
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Segment - Mobile only */}
                      {contact.segment && (
                        <div className="lg:hidden mt-2">
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                            {contact.segment}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tags - Desktop only */}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="hidden lg:flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
                        {contact.tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="px-2 py-1 text-xs font-medium text-gray-500">
                            +{contact.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Arrow Icon - Desktop only */}
                    <div className="hidden lg:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                </div>
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
                <button
                  onClick={() => {
                    setShowBulkSegmentModal(false);
                    setSelectedNewSegment("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={bulkUpdating}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newSegment = selectedNewSegment.trim() || null;
                    handleBulkSegmentUpdate(newSegment);
                    setSelectedNewSegment("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                  disabled={bulkUpdating}
                >
                  Update Segment
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
