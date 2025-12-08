"use client";

import { useState, Suspense } from "react";
import Card from "@/components/Card";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import { ActionItem, Contact } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import ActionItemCard from "../_components/ActionItemCard";
import { useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";
import { useAuth } from "@/hooks/useAuth";

type FilterStatus = "all" | "pending" | "completed";
type FilterDate = "all" | "overdue" | "today" | "thisWeek" | "upcoming";

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

interface ActionItemsPageClientProps {
  initialActionItems: EnrichedActionItem[];
  contacts: Array<[string, Contact]>;
}

export default function ActionItemsPageClient({
  initialActionItems,
  contacts,
}: ActionItemsPageClientProps) {
  const { user } = useAuth();
  const updateActionItemMutation = useUpdateActionItem(user?.uid);
  const deleteActionItemMutation = useDeleteActionItem(user?.uid);
  
  // Use enriched action items from wrapper (which uses React Query)
  const actionItems = initialActionItems;
  
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterDate, setFilterDate] = useState<FilterDate>("all");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const contactsMap = new Map(contacts);

  const handleComplete = async (item: EnrichedActionItem) => {
    setCompleting(item.actionItemId);
    setCompleteError(null);

    const newStatus = item.status === "completed" ? "pending" : "completed";

    try {
      await updateActionItemMutation.mutateAsync({
        contactId: item.contactId,
        actionItemId: item.actionItemId,
        updates: { status: newStatus },
      });
      setCompleteError(null);
      // React Query will automatically invalidate and refetch
    } catch (error) {
      reportException(error, {
        context: "Completing action item",
        tags: { component: "ActionItemsPageClient", actionItemId: item.actionItemId },
      });
      setCompleteError(extractErrorMessage(error));
    } finally {
      setCompleting(null);
    }
  };

  const handleEdit = async (
    item: EnrichedActionItem,
    text: string,
    dueDate?: string | null
  ) => {
    setCompleting(item.actionItemId);
    setCompleteError(null);
    try {
      await updateActionItemMutation.mutateAsync({
        contactId: item.contactId,
        actionItemId: item.actionItemId,
        updates: { text, dueDate },
      });
      setCompleteError(null);
      // React Query will automatically invalidate and refetch
    } catch (error) {
      reportException(error, {
        context: "Editing action item",
        tags: { component: "ActionItemsPageClient", actionItemId: item.actionItemId },
      });
      setCompleteError(extractErrorMessage(error));
    } finally {
      setCompleting(null);
    }
  };

  const handleDelete = async (item: EnrichedActionItem) => {
    if (!confirm("Are you sure you want to delete this action item?")) {
      return;
    }

    setDeleting(item.actionItemId);
    setDeleteError(null);

    try {
      await deleteActionItemMutation.mutateAsync({
        contactId: item.contactId,
        actionItemId: item.actionItemId,
      });
      setDeleteError(null);
      // React Query will automatically invalidate and refetch
    } catch (error) {
      reportException(error, {
        context: "Deleting action item",
        tags: { component: "ActionItemsPageClient", actionItemId: item.actionItemId },
      });
      setDeleteError(extractErrorMessage(error));
    } finally {
      setDeleting(null);
    }
  };

  const filteredItems = actionItems.filter((item) => {
    // Status filter
    if (filterStatus !== "all" && item.status !== filterStatus) {
      return false;
    }

    // Contact filter
    if (selectedContactId && item.contactId !== selectedContactId) {
      return false;
    }

    // Date filter
    if (filterDate !== "all" && item.status === "pending") {
      if (filterDate === "overdue" && item.dateCategory !== "overdue") return false;
      if (filterDate === "today" && item.dateCategory !== "today") return false;
      if (filterDate === "thisWeek" && !["today", "thisWeek"].includes(item.dateCategory))
        return false;
      if (filterDate === "upcoming" && item.dateCategory === "overdue") return false;
    } else if (filterDate !== "all" && item.status === "completed") {
      return false; // Don't show completed items in date filters
    }

    return true;
  });

  // Recalculate stats from current actionItems state
  const pendingItems = actionItems.filter((i) => i.status === "pending");
  const stats = {
    total: actionItems.length,
    pending: pendingItems.length,
    overdue: pendingItems.filter((i) => i.isOverdue).length,
    today: pendingItems.filter((i) => i.dateCategory === "today").length,
  };

  const uniqueContactIds = Array.from(new Set(actionItems.map((i) => i.contactId)));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Action Items</h1>
        <p className="text-gray-600 text-lg">
          Manage tasks and action items across all your contacts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm font-medium text-gray-500 mb-1">Due Today</p>
          <p className="text-2xl font-bold text-amber-600">{stats.today}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Date
            </label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as FilterDate)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="thisWeek">Due This Week</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Contact
            </label>
            <select
              value={selectedContactId || ""}
              onChange={(e) => setSelectedContactId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Contacts</option>
              {uniqueContactIds.map((contactId) => {
                const contact = contactsMap.get(contactId);
                const name = contact
                  ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                    contact.primaryEmail
                  : "Unknown";
                return (
                  <option key={contactId} value={contactId}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </Card>

      {/* Action Items List - Only the list is suspended */}
      <Card padding="md">
        <Suspense
          fallback={
            <div>
              <div className="h-6 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {filteredItems.length} Action Item{filteredItems.length !== 1 ? "s" : ""}
          </h2>
          {filteredItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No action items match your filters
            </p>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                return (
                  <ActionItemCard
                    key={`${item.contactId}_${item.actionItemId}`}
                    actionItem={item}
                    contactId={item.contactId}
                    contactName={item.contactName}
                    contactEmail={item.contactEmail}
                    contactFirstName={item.contactFirstName}
                    contactLastName={item.contactLastName}
                    onComplete={() => handleComplete(item)}
                    onDelete={() => handleDelete(item)}
                    onEdit={(text, dueDate) => handleEdit(item, text, dueDate)}
                    disabled={completing === item.actionItemId || deleting === item.actionItemId}
                    isOverdue={item.isOverdue}
                    displayName={item.displayName}
                    initials={item.initials}
                  />
                );
              })}
            </div>
          )}
          {(completeError || deleteError) && (
            <div className="mt-4 space-y-2">
              {completeError && (
                <ErrorMessage
                  message={completeError}
                  dismissible
                  onDismiss={() => setCompleteError(null)}
                />
              )}
              {deleteError && (
                <ErrorMessage
                  message={deleteError}
                  dismissible
                  onDismiss={() => setDeleteError(null)}
                />
              )}
            </div>
          )}
        </Suspense>
      </Card>
    </div>
  );
}

