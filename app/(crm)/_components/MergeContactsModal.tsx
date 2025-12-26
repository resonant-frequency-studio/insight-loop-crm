"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/Modal";
import Input from "@/components/Input";
import { Button } from "@/components/Button";
import Avatar from "@/components/Avatar";
import { ErrorMessage } from "@/components/ErrorMessage";
import { getDisplayName } from "@/util/contact-utils";
import { useRouter } from "next/navigation";

interface ContactSearchResult {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string;
  secondaryEmails?: string[];
  photoUrl: string | null;
}

// Helper function to convert ContactSearchResult or primaryContact to a format getDisplayName can use
function toContactForDisplay(
  contact: ContactSearchResult | MergeContactsModalProps["primaryContact"]
): { contactId: string; firstName?: string | null; lastName?: string | null; company?: string | null; primaryEmail: string; createdAt: Date; updatedAt: Date } {
  return {
    contactId: contact.contactId,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    company: null, // Not available in search results
    primaryEmail: contact.primaryEmail,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface MergeContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryContactId: string;
  userId: string;
  primaryContact: {
    contactId: string;
    firstName?: string | null;
    lastName?: string | null;
    primaryEmail: string;
    secondaryEmails?: string[];
    photoUrl?: string | null;
  };
}

export default function MergeContactsModal({
  isOpen,
  onClose,
  primaryContactId,
  userId,
  primaryContact,
}: MergeContactsModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<ContactSearchResult[]>([]);
  const [primaryEmail, setPrimaryEmail] = useState<string>(primaryContact.primaryEmail);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(debouncedQuery)}&excludeContactId=${encodeURIComponent(primaryContactId)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to search contacts");
        }

        const data = await response.json();
        setSearchResults(data.contacts || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to search contacts";
        setError(errorMessage);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, primaryContactId]);

  // Collect all emails from primary contact and selected contacts
  const getAllEmails = useCallback(() => {
    const emails: Array<{ email: string; contactId: string; contactName: string }> = [];

    // Add primary contact emails
    if (primaryContact.primaryEmail) {
      emails.push({
        email: primaryContact.primaryEmail,
        contactId: primaryContact.contactId,
        contactName: getDisplayName(toContactForDisplay(primaryContact)),
      });
    }
    if (primaryContact.secondaryEmails) {
      primaryContact.secondaryEmails.forEach((email) => {
        emails.push({
          email,
          contactId: primaryContact.contactId,
          contactName: getDisplayName(toContactForDisplay(primaryContact)),
        });
      });
    }

    // Add selected contacts' emails
    selectedContacts.forEach((contact) => {
      if (contact.primaryEmail) {
        emails.push({
          email: contact.primaryEmail,
          contactId: contact.contactId,
          contactName: getDisplayName(toContactForDisplay(contact)),
        });
      }
      if (contact.secondaryEmails) {
        contact.secondaryEmails.forEach((email) => {
          emails.push({
            email,
            contactId: contact.contactId,
            contactName: getDisplayName(toContactForDisplay(contact)),
          });
        });
      }
    });

    // Deduplicate emails
    const uniqueEmails = new Map<string, { email: string; contactId: string; contactName: string }>();
    emails.forEach((item) => {
      const emailLower = item.email.toLowerCase().trim();
      if (!uniqueEmails.has(emailLower)) {
        uniqueEmails.set(emailLower, item);
      }
    });

    return Array.from(uniqueEmails.values());
  }, [primaryContact, selectedContacts]);

  const handleAddContact = (contact: ContactSearchResult) => {
    // Check if already selected
    if (selectedContacts.some((c) => c.contactId === contact.contactId)) {
      return;
    }

    setSelectedContacts([...selectedContacts, contact]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveContact = (contactId: string) => {
    setSelectedContacts(selectedContacts.filter((c) => c.contactId !== contactId));
  };

  const handleMerge = async () => {
    if (selectedContacts.length === 0 || !primaryEmail) {
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(primaryContactId)}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIdsToMerge: selectedContacts.map((c) => c.contactId),
          primaryEmail: primaryEmail.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to merge contacts");
      }

      // Success - invalidate React Query cache to refresh contact data
      await queryClient.invalidateQueries({
        queryKey: ["contact", userId, primaryContactId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["contacts", userId],
      });

      // Close modal and refresh page
      onClose();
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to merge contacts";
      setError(errorMessage);
    } finally {
      setIsMerging(false);
    }
  };

  const allEmails = getAllEmails();
  const canMerge = selectedContacts.length > 0 && primaryEmail.trim() !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Merge Contacts"
      maxWidth="4xl"
      closeOnBackdropClick={!isMerging}
    >
      <div className="flex flex-col max-h-[calc(100vh-12rem)]">
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Search Section */}
          <div className="relative">
            <label
              htmlFor="contact-search"
              className="block text-sm font-medium text-theme-darkest mb-2"
            >
              Search for contacts to merge
            </label>
            <Input
              id="contact-search"
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isMerging}
              className="w-full"
            />
            <div className="h-6">
              {isSearching && (
                <p className="text-sm text-theme-dark mt-2 absolute">Searching...</p>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border border-theme-lighter rounded-sm p-4 bg-card-highlight-light">
              <h3 className="text-sm font-medium text-theme-darkest mb-3">
                Search Results
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((contact) => {
                  const isSelected = selectedContacts.some(
                    (c) => c.contactId === contact.contactId
                  );
                  return (
                    <div
                      key={contact.contactId}
                      className="flex items-center gap-3 p-2 rounded-sm hover:bg-selected-active transition-colors"
                    >
                      <Avatar
                        photoUrl={contact.photoUrl}
                        firstName={contact.firstName}
                        lastName={contact.lastName}
                        primaryEmail={contact.primaryEmail}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-darkest truncate">
                          {getDisplayName(toContactForDisplay(contact))}
                        </p>
                        <p className="text-xs text-theme-dark truncate">
                          {contact.primaryEmail}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleAddContact(contact)}
                        disabled={isSelected || isMerging}
                        variant="secondary"
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
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        }
                      >
                        {isSelected ? "Added" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Selected Contacts */}
        {selectedContacts.length > 0 && (
          <div className="border border-theme-lighter rounded-sm p-4 bg-card-highlight-light">
            <h3 className="text-sm font-medium text-theme-darkest mb-3">
              Contacts to Merge ({selectedContacts.length})
            </h3>
            <div className="space-y-2">
              {selectedContacts.map((contact) => (
                <div
                  key={contact.contactId}
                  className="flex items-center gap-3 p-2 rounded-sm bg-theme-light"
                >
                  <Avatar
                    photoUrl={contact.photoUrl}
                    firstName={contact.firstName}
                    lastName={contact.lastName}
                    primaryEmail={contact.primaryEmail}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-darkest truncate">
                      {getDisplayName(toContactForDisplay(contact))}
                    </p>
                    <p className="text-xs text-theme-dark truncate">
                      {contact.primaryEmail}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleRemoveContact(contact.contactId)}
                    disabled={isMerging}
                    variant="danger"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email Selection */}
        {allEmails.length > 0 && (
          <div className="border border-theme-lighter rounded-sm p-4 bg-card-highlight-light">
            <h3 className="text-sm font-medium text-theme-darkest mb-3">
              Select Primary Email
            </h3>
            <div className="space-y-2">
              {allEmails.map((item) => (
                <label
                  key={item.email}
                  className="flex items-center gap-3 p-2 rounded-sm hover:bg-selected-active transition-colors cursor-pointer"
                >
                  <input
                    type="radio"
                    name="primaryEmail"
                    value={item.email}
                    checked={primaryEmail === item.email}
                    onChange={(e) => setPrimaryEmail(e.target.value)}
                    disabled={isMerging}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-theme-darker"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-darkest">
                      {item.email}
                    </p>
                    <p className="text-xs text-theme-dark">
                      From: {item.contactName}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {selectedContacts.length > 0 && (
          <div className="border border-theme-lighter rounded-sm p-4 bg-card-highlight-light">
            <h3 className="text-sm font-medium text-theme-darkest mb-3">
              Preview
            </h3>
            <div className="text-sm text-theme-darkest space-y-2">
              <p>
                <strong className="font-medium">Primary Contact:</strong> {getDisplayName(toContactForDisplay(primaryContact))} (
                {primaryContact.primaryEmail})
              </p>
              <p>
                <strong className="font-medium">Contacts to Merge:</strong> {selectedContacts.length} contact
                {selectedContacts.length !== 1 ? "s" : ""}
              </p>
              <p>
                <strong className="font-medium">Primary Email:</strong> {primaryEmail}
              </p>
              <p className="text-xs mt-3 pt-2 border-t border-theme-lighter text-theme-dark">
                The primary contact will be preserved. The other contact(s) will be deleted, and all their data
                (action items, threads, calendar events) will be linked to the primary contact.
              </p>
            </div>
          </div>
        )}

          {/* Error Message */}
          {error && <ErrorMessage message={error} dismissible onDismiss={() => setError(null)} />}
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex gap-3 justify-end pt-4 border-t border-theme-lighter mt-4 shrink-0">
          <Button
            onClick={onClose}
            disabled={isMerging}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!canMerge || isMerging}
            loading={isMerging}
            variant="primary"
            size="sm"
          >
            Merge Contacts
          </Button>
        </div>
      </div>
    </Modal>
  );
}

