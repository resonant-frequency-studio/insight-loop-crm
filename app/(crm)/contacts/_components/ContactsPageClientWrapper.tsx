"use client";

import { useContacts } from "@/hooks/useContacts";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Contact } from "@/types/firestore";
import ContactsPageClient from "../ContactsPageClient";

interface ContactWithId extends Contact {
  id: string;
  displayName: string;
  initials: string;
}

export default function ContactsPageClientWrapper({ userId }: { userId: string }) {
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: contacts = [] } = useContacts(userId);

  // Pre-compute displayName and initials for each contact
  const contactsWithComputed: ContactWithId[] = contacts.map((contact) => {
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

  // Use prefetched data - should not be loading on initial render
  return <ContactsPageClient initialContacts={contactsWithComputed} />;
}

