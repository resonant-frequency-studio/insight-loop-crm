"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Contact } from "@/types/firestore";
import ExportContactsButton from "../_components/ExportContactsButton";
import ContactsFilter from "../_components/ContactsFilter";
import { Button } from "@/components/Button";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { ContactsFilterProvider, useContactsFilter } from "./_components/ContactsFilterContext";
import ContactsGrid from "./_components/ContactsGrid";
import ContactsBulkActions from "./_components/ContactsBulkActions";


interface ContactWithId extends Contact {
  id: string;
  displayName?: string;
  initials?: string;
}

interface ContactsPageClientProps {
  userId: string;
}

const ITEMS_PER_PAGE = 20;

function ContactsPageHeader({ contacts }: { contacts: ContactWithId[] }) {
  const { filteredContacts, hasActiveFilters } = useContactsFilter();

  return (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Contacts</h1>
        {contacts.length === 0 ? (
          <p className="text-theme-dark text-lg">No contacts yet</p>
        ) : (
          <p className="text-theme-dark text-lg">
            {filteredContacts.length} of {contacts.length}{" "}
            {contacts.length === 1 ? "contact" : "contacts"}
            {hasActiveFilters && " (filtered)"}
          </p>
        )}
      </div>
      {/* Buttons - Mobile: below header, Desktop: right side */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 xl:shrink-0 w-full sm:w-auto">
        <ExportContactsButton contacts={filteredContacts} />
        <Link href="/contacts/new" className="w-full sm:w-auto flex items-center">
          <Button
            size="sm"
            fullWidth
            className="whitespace-nowrap shadow-sm"
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
  );
}

export default function ContactsPageClient({
  userId,
}: ContactsPageClientProps) {
  // Use Firebase real-time listeners
  const { contacts: contactsData = [], loading: isLoading, hasConfirmedNoContacts } = useContactsRealtime(userId || null);
  const contacts: ContactWithId[] = useMemo(() => {
    return contactsData.map((contact) => ({
      ...contact,
      id: contact.contactId,
      displayName: getDisplayName(contact),
      initials: getInitials(contact),
    }));
  }, [contactsData]);

  // Always render structure - provide context even when loading so components don't crash
  return (
    <ContactsFilterProvider contacts={contacts} itemsPerPage={ITEMS_PER_PAGE} isLoading={isLoading} hasConfirmedNoContacts={hasConfirmedNoContacts}>
      <div className="space-y-6">
        <ContactsPageHeader contacts={contacts} />
        {/* Always render Filter & Search - disabled only when no userId or no contacts (enable as soon as cached data is available) */}
        <ContactsFilter contacts={contacts} disabled={!userId || contacts.length === 0} />
        {/* Always render Bulk Actions - it handles its own visibility */}
        <ContactsBulkActions userId={userId} contacts={contacts} />
        <ContactsGrid userId={userId} />
      </div>
    </ContactsFilterProvider>
  );
}

