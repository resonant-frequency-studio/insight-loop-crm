"use client";

import { useActionItems } from "@/hooks/useActionItems";
import { useContacts } from "@/hooks/useContacts";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { computeIsOverdue, getDateCategory } from "@/util/date-utils-server";
import { ActionItem, Contact } from "@/types/firestore";
import ActionItemsPageClient from "../ActionItemsPageClient";

interface EnrichedActionItem extends ActionItem {
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  displayName: string;
  initials: string;
  isOverdue: boolean;
  dateCategory: "overdue" | "today" | "thisWeek" | "upcoming";
}

export default function ActionItemsPageClientWrapper({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  // Use userId prop if provided (from SSR), otherwise get from client auth (for E2E mode or if SSR didn't have it)
  // In production, userId prop should always be provided from SSR
  // In E2E mode, it might be empty, so we wait for auth to load and use user?.uid
  const effectiveUserId = userId || (authLoading ? "" : user?.uid || "");
  // React Query automatically uses prefetched data from HydrationBoundary
  const { data: actionItems = [] } = useActionItems(effectiveUserId);
  const { data: contacts = [] } = useContacts(effectiveUserId);

  // Convert contacts array to Map for efficient lookup
  const contactsMap = new Map<string, Contact>();
  contacts.forEach((contact) => {
    contactsMap.set(contact.contactId, contact);
  });

  // Use consistent server time for all calculations
  const serverTime = new Date();

  // Pre-compute all derived values
  const enrichedItems: EnrichedActionItem[] = actionItems.map((item) => {
    const contact = contactsMap.get(item.contactId);
    
    // Create contact object for utility functions
    const contactForUtils: Contact = {
      contactId: item.contactId,
      firstName: contact?.firstName,
      lastName: contact?.lastName,
      primaryEmail: contact?.primaryEmail || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const contactName = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        contact.primaryEmail
      : "Unknown Contact";

    const displayName = getDisplayName(contactForUtils);
    const initials = getInitials(contactForUtils);
    const isOverdue = computeIsOverdue(item, serverTime);
    const dateCategory = getDateCategory(item.dueDate, serverTime);

    return {
      ...item,
      contactName,
      contactEmail: contact?.primaryEmail,
      contactFirstName: contact?.firstName || undefined,
      contactLastName: contact?.lastName || undefined,
      displayName,
      initials,
      isOverdue,
      dateCategory,
    };
  });

  // Convert contacts Map to array for serialization
  const contactsArray: Array<[string, Contact]> = Array.from(contactsMap.entries());

  return (
    <ActionItemsPageClient
      initialActionItems={enrichedItems}
      contacts={contactsArray}
    />
  );
}

