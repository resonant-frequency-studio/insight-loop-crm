"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Contact } from "@/types/firestore";
import ExportContactsButton from "../_components/ExportContactsButton";
import ContactsFilter from "../_components/ContactsFilter";
import { Button } from "@/components/Button";
import { useContacts } from "@/hooks/useContacts";
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
        <Link href="/contacts/new" className="w-full sm:w-auto">
          <Button
            size="sm"
            fullWidth
            className="whitespace-nowrap shadow-[rgba(34,32,29,0.1)_0px_2px_4px]
"
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
  const { data: contactsData = [], isLoading } = useContacts(userId);
  const contacts: ContactWithId[] = useMemo(() => {
    return contactsData.map((contact) => ({
      ...contact,
      id: contact.contactId,
      displayName: getDisplayName(contact),
      initials: getInitials(contact),
    }));
  }, [contactsData]);

  // When loading (suspense mode), render structure but let ThemedSuspense show loading
  // We need to provide context even when loading so components don't crash
  return (
    <ContactsFilterProvider contacts={contacts} itemsPerPage={ITEMS_PER_PAGE} isLoading={isLoading}>
      <div className="space-y-6">
        <ContactsPageHeader contacts={contacts} />
        {!isLoading && <ContactsFilter contacts={contacts} />}
        {!isLoading && <ContactsBulkActions userId={userId} contacts={contacts} />}
        <ContactsGrid userId={userId} />
      </div>
    </ContactsFilterProvider>
  );
}

