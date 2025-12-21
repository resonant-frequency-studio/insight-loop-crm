"use client";

import { useActionItemsRealtime } from "@/hooks/useActionItemsRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { computeIsOverdue, getDateCategory } from "@/util/date-utils-server";
import { ActionItem, Contact } from "@/types/firestore";
import ActionItemsPageClient from "../ActionItemsPageClient";
import EmptyState from "@/components/dashboard/EmptyState";
import ThemedSuspense from "@/components/ThemedSuspense";

interface EnrichedActionItem extends ActionItem {
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  displayName: string | null;
  initials: string;
  isOverdue: boolean;
  dateCategory: "overdue" | "today" | "thisWeek" | "upcoming";
}

type ActionItemWithContactFields = ActionItem & {
  contactId: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string;
};

export default function ActionItemsPageClientWrapper() {
  const { user, loading: authLoading } = useAuth();
  
  // Get userId from auth (no longer passed as prop from SSR)
  // For Firebase listeners, null is acceptable - the hook will handle it
  const userId = !authLoading && user?.uid ? user.uid : null;
  
  // Use Firebase real-time listeners
  const { actionItems = [], loading: actionItemsLoading } = useActionItemsRealtime(userId);
  const { contacts = [], loading: contactsLoading } = useContactsRealtime(userId);
  
  // Show empty state only after loading completes AND there's no data
  // Wrap in ThemedSuspense to show skeletons while loading
  if (contacts.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Action Items</h1>
          <p className="text-theme-dark text-lg">Manage tasks and action items across all your contacts</p>
        </div>
        <ThemedSuspense isLoading={contactsLoading || actionItemsLoading}>
          {!contactsLoading && !actionItemsLoading && (
            <EmptyState wrapInCard={true} size="lg" />
          )}
        </ThemedSuspense>
      </div>
    );
  }

  // Use consistent server time for all calculations
  const serverTime = new Date();

  // Enrich action items with contact data from contacts array (client-side enrichment)
  const enrichedItems: EnrichedActionItem[] = actionItems.map((item) => {
    // Find matching contact for this action item
    const contact = contacts.find((c) => c.contactId === item.contactId);
    
    // Create contact object for utility functions
    const contactForUtils: Contact = {
      contactId: item.contactId,
      firstName: contact?.firstName || null,
      lastName: contact?.lastName || null,
      company: contact?.company || null,
      primaryEmail: contact?.primaryEmail || "",
      createdAt: contact?.createdAt || new Date(),
      updatedAt: contact?.updatedAt || new Date(),
    };

    const displayName = getDisplayName(contactForUtils);
    const contactName = displayName || contact?.primaryEmail || "";
    const initials = getInitials(contactForUtils);
    const isOverdue = computeIsOverdue(item, serverTime);
    const dateCategory = getDateCategory(item.dueDate, serverTime);

    return {
      ...item,
      contactName,
      contactEmail: contact?.primaryEmail || undefined,
      contactFirstName: contact?.firstName || undefined,
      contactLastName: contact?.lastName || undefined,
      displayName,
      initials,
      isOverdue,
      dateCategory,
    };
  });

  // Extract unique contact IDs for filters
  const uniqueContactIds = Array.from(
    new Set(enrichedItems.map((i) => i.contactId))
  );

  // Create contacts array for filters (minimal data needed)
  const contactsArray: Array<[string, Contact]> = uniqueContactIds.map((contactId) => {
    const item = enrichedItems.find((i) => i.contactId === contactId);
    return [
      contactId,
      {
        contactId,
        primaryEmail: item?.contactEmail || "",
        firstName: item?.contactFirstName || null,
        lastName: item?.contactLastName || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Contact,
    ];
  });

  return (
    <ActionItemsPageClient
      initialActionItems={enrichedItems}
      contacts={contactsArray}
    />
  );
}

