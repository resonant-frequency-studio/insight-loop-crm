"use client";

import Card from "@/components/Card";
import { Button } from "@/components/Button";
import ContactCard from "../../_components/ContactCard";
import Pagination from "@/components/Pagination";
import ThemedSuspense from "@/components/ThemedSuspense";
import { useContactsFilter } from "./ContactsFilterContext";
import EmptyState from "@/components/dashboard/EmptyState";

interface ContactsGridProps {
  userId: string;
}

export default function ContactsGrid({ userId }: ContactsGridProps) {
  const {
    filteredContacts,
    totalContactsCount,
    isLoading,
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

  return (
    <Card padding="md">
      <ThemedSuspense isLoading={isLoading}>
        {filteredContacts.length === 0 && totalContactsCount > 0 ? (
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
        ) : filteredContacts.length === 0 ? (
          <EmptyState wrapInCard={false} size="lg" />
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
        )}
      </ThemedSuspense>
    </Card>
  );
}

