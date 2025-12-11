"use client";

import { useContact } from "@/hooks/useContact";
import Card from "@/components/Card";
import ActionItemsList from "../ActionItemsList";
import type { ActionItem, Contact } from "@/types/firestore";

interface ActionItemsCardProps {
  contactId: string;
  userId: string;
  initialActionItems?: ActionItem[];
  initialContact?: Contact;
}

export default function ActionItemsCard({
  contactId,
  userId,
  initialActionItems,
  initialContact,
}: ActionItemsCardProps) {
  const { data: contact } = useContact(userId, contactId);
  const displayContact = contact || initialContact;

  if (!displayContact) {
    return (
      <Card padding="md">
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h2 className="text-xl font-semibold text-theme-darkest mb-2">Action Items</h2>
      <p className="text-sm text-theme-dark mb-6">
        Track tasks and follow-ups for this contact. Create action items with due dates to stay organized and never miss an important next step in your relationship.
      </p>
      <ActionItemsList
        userId={userId}
        contactId={contactId}
        contactEmail={displayContact.primaryEmail}
        contactFirstName={displayContact.firstName || undefined}
        contactLastName={displayContact.lastName || undefined}
        contactCompany={displayContact.company || undefined}
        onActionItemUpdate={() => {
          // Trigger a refresh if needed
        }}
        initialActionItems={initialActionItems}
        initialContact={displayContact}
      />
    </Card>
  );
}

