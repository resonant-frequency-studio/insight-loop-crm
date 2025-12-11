"use client";

import { ActionItem, Contact } from "@/types/firestore";
import ActionItemsStats from "./_components/ActionItemsStats";
import ActionItemsFilters from "./_components/ActionItemsFilters";
import ActionItemsListSection from "./_components/ActionItemsListSection";
import { ActionItemsFiltersProvider } from "./_components/ActionItemsFiltersContext";

export interface EnrichedActionItem extends ActionItem {
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  displayName: string | null;
  initials: string;
  isOverdue: boolean;
  dateCategory: "overdue" | "today" | "thisWeek" | "upcoming";
  contactLoading?: boolean;
}

interface ActionItemsPageClientProps {
  initialActionItems: EnrichedActionItem[];
  contacts: Array<[string, Contact]>;
}

export default function ActionItemsPageClient({
  initialActionItems,
  contacts,
}: ActionItemsPageClientProps) {
  // Recalculate stats from current actionItems state
  const pendingItems = initialActionItems.filter((i) => i.status === "pending");
  const stats = {
    total: initialActionItems.length,
    pending: pendingItems.length,
    overdue: pendingItems.filter((i) => i.isOverdue).length,
    today: pendingItems.filter((i) => i.dateCategory === "today").length,
  };

  const uniqueContactIds = Array.from(
    new Set(initialActionItems.map((i) => i.contactId))
  );

  return (
    <ActionItemsFiltersProvider>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Action Items</h1>
          <p className="text-theme-dark text-lg">
            Manage tasks and action items across all your contacts
          </p>
        </div>

        {/* Stats */}
        <ActionItemsStats
          total={stats.total}
          pending={stats.pending}
          overdue={stats.overdue}
          today={stats.today}
        />

        {/* Filters */}
        <ActionItemsFilters
          contacts={contacts}
          uniqueContactIds={uniqueContactIds}
        />

        {/* Action Items List */}
        <ActionItemsListSection actionItems={initialActionItems} />
      </div>
    </ActionItemsFiltersProvider>
  );
}

