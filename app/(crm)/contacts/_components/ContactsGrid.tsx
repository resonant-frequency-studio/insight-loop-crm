"use client";

import { useState, useEffect } from "react";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import ContactCard from "../../_components/ContactCard";
import Pagination from "@/components/Pagination";
import ThemedSuspense from "@/components/ThemedSuspense";
import { useContactsFilter } from "./ContactsFilterContext";
import EmptyState from "@/components/dashboard/EmptyState";
import { InlineNudge } from "@/components/guidance/InlineNudge";
import { useAuth } from "@/hooks/useAuth";
import { getUserGuidancePreferences, updateUserGuidancePreferences } from "@/src/guidance/user-preferences";

interface ContactsGridProps {
  userId: string;
}

export default function ContactsGrid({ userId }: ContactsGridProps) {
  const { user } = useAuth();
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeLoaded, setNudgeLoaded] = useState(false);

  const {
    filteredContacts,
    totalContactsCount,
    isLoading,
    hasConfirmedNoContacts,
    onClearFilters,
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedContacts,
    startIndex,
    endIndex,
    selectedContactIds,
    allFilteredSelected,
    toggleContactSelection,
    toggleSelectAll,
  } = useContactsFilter();

  // Check if nudge should be shown
  useEffect(() => {
    if (!user?.uid || nudgeLoaded) return;

    getUserGuidancePreferences(user.uid)
      .then((prefs) => {
        const shouldShow = !prefs.dismissedNudges?.contactsEmpty;
        setShowNudge(shouldShow);
        setNudgeLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load guidance preferences:", error);
        setNudgeLoaded(true);
      });
  }, [user?.uid, nudgeLoaded]);

  const handleDismissNudge = async () => {
    if (!user?.uid) return;
    setShowNudge(false);
    try {
      await updateUserGuidancePreferences(user.uid, {
        dismissedNudges: {
          contactsEmpty: true,
        },
      });
    } catch (error) {
      console.error("Failed to save nudge dismissal:", error);
    }
  };

  // Show skeletons only when loading AND no contacts available
  // If contacts exist (even from cache), show them immediately
  const showSkeletons = (isLoading || !userId) && totalContactsCount === 0;

  // Show skeletons when loading and no data
  if (showSkeletons) {
    return (
      <Card padding="md">
        <ThemedSuspense isLoading={true} variant="default" />
      </Card>
    );
  }

  // Show "No Contacts" EmptyState only when both cache and server confirm no contacts
  if (hasConfirmedNoContacts && totalContactsCount === 0) {
    return (
      <Card padding="md">
        <div className="space-y-6">
          {showNudge && (
            <InlineNudge
              title="Start small."
              body="Add 3 people you care about staying close to. This system works best when it begins with real relationships—not a full import."
              ctaLabel="Add a contact"
              ctaHref="/contacts/new"
              onDismiss={handleDismissNudge}
            />
          )}
          <EmptyState wrapInCard={false} size="lg" />
        </div>
      </Card>
    );
  }

  // Show "No contacts match your filters" when filters are active but no matches
  if (filteredContacts.length === 0 && totalContactsCount > 0) {
    return (
      <Card padding="md">
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
          <p className="text-lg font-medium text-theme-darkest mb-2">No contacts match your filters</p>
          <p className="text-sm text-gray-500 mb-6">
            Try adjusting your search criteria or clear filters to see all contacts
          </p>
          <Button onClick={onClearFilters} size="sm">
            Clear Filters
          </Button>
        </Card>
      </Card>
    );
  }

  // Show contacts grid
  return (
    <Card padding="md">
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
              <span className="text-sm font-medium text-theme-darker">
                Select all {filteredContacts.length}{" "}
                {filteredContacts.length === 1 ? "contact" : "contacts"}
              </span>
            </label>
          </div>
        )}

        {/* Top Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredContacts.length}
          startIndex={startIndex}
          endIndex={endIndex}
          itemLabel="contact"
          onPageChange={setCurrentPage}
          hideItemCount={true}
        />

        <div className="grid grid-cols-1 gap-4">
          {paginatedContacts.map((contact) => {
            const isSelected = selectedContactIds.has(contact.id);
            return (
              <ContactCard
                key={contact.id}
                contact={contact}
                showCheckbox={true}
                isSelected={isSelected}
                onSelectChange={toggleContactSelection}
                variant={isSelected ? "selected" : "default"}
                userId={userId}
              />
            );
          })}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredContacts.length}
          startIndex={startIndex}
          endIndex={endIndex}
          itemLabel="contact"
          onPageChange={setCurrentPage}
        />
      </div>
    </Card>
  );
}

