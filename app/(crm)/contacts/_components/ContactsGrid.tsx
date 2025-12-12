"use client";

import Link from "next/link";
import Card from "@/components/Card";
import { Button } from "@/components/Button";
import ContactCard from "../../_components/ContactCard";
import Pagination from "@/components/Pagination";
import ThemedSuspense from "@/components/ThemedSuspense";
import { useContactsFilter } from "./ContactsFilterContext";

interface ContactsGridProps {
  userId: string;
}

export default function ContactsGrid({ userId }: ContactsGridProps) {
  const {
    filteredContacts,
    totalContactsCount,
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
      <ThemedSuspense>
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
            <p className="text-lg font-medium text-theme-darkest mb-2">No contacts yet</p>
            <p className="text-sm text-gray-500 mb-6">Start by importing contacts from a CSV file</p>
            <Link
              href="/contacts/import"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-sm shadow-md hover:shadow-lg transition-all duration-300 font-medium text-sm active:scale-95"
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
                  <span className="text-sm font-medium text-theme-darker">
                    Select all {filteredContacts.length}{" "}
                    {filteredContacts.length === 1 ? "contact" : "contacts"}
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
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

