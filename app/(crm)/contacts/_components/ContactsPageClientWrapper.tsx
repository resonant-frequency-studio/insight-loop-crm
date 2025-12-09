"use client";

import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Contact } from "@/types/firestore";
import ContactsPageClient from "../ContactsPageClient";

interface ContactWithId extends Contact {
  id: string;
  displayName: string;
  initials: string;
}

export default function ContactsPageClientWrapper({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  // Use userId prop if provided (from SSR), otherwise get from client auth (for E2E mode or if SSR didn't have it)
  // In production, userId prop should always be provided from SSR
  // In E2E mode, it might be empty, so we wait for auth to load and use user?.uid
  const effectiveUserId = userId || (authLoading ? "" : user?.uid || "");
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: contacts = [] } = useContacts(effectiveUserId);

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

