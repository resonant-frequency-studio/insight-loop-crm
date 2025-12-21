"use client";

import { useState, useEffect, useMemo } from "react";
import ThemedSuspense from "@/components/ThemedSuspense";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import { Button } from "@/components/Button";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import { ActionItem } from "@/types/firestore";
import { reportException } from "@/lib/error-reporting";
import ActionItemCard from "../../_components/ActionItemCard";
import { useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";
import { useActionItemsFilters } from "./ActionItemsFiltersContext";
import { EnrichedActionItem } from "../ActionItemsPageClient";
import Pagination from "@/components/Pagination";

interface ActionItemsListSectionProps {
  actionItems: EnrichedActionItem[];
  isLoading?: boolean;
  hasConfirmedNoActionItems?: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function ActionItemsListSection({
  actionItems,
  isLoading = false,
  hasConfirmedNoActionItems = false,
}: ActionItemsListSectionProps) {
  const updateActionItemMutation = useUpdateActionItem();
  const deleteActionItemMutation = useDeleteActionItem();
  const { filterStatus, filterDate, selectedContactId } = useActionItemsFilters();
  const [currentPage, setCurrentPage] = useState(1);

  // Local state for checkbox status - UI/UX source of truth
  const [checkboxStates, setCheckboxStates] = useState<
    Map<string, { isCompleted: boolean; error?: string }>
  >(
    new Map(
      actionItems.map((item) => [
        item.actionItemId,
        { isCompleted: item.status === "completed" },
      ])
    )
  );

  // Local state for edit text and dueDate - UI/UX source of truth
  const [editStates, setEditStates] = useState<
    Map<string, { text: string; dueDate?: string | null; error?: string }>
  >(
    new Map(
      actionItems.map((item) => [
        item.actionItemId,
        {
          text: item.text,
          dueDate: item.dueDate
            ? typeof item.dueDate === "string"
              ? item.dueDate
              : item.dueDate instanceof Date
              ? item.dueDate.toISOString().split("T")[0]
              : null
            : null,
        },
      ])
    )
  );

  // Local state for deleted items - UI/UX source of truth
  const [deletedItems, setDeletedItems] = useState<Map<string, { error?: string }>>(new Map());

  // State for delete confirmation modal
  const [itemToDelete, setItemToDelete] = useState<EnrichedActionItem | null>(null);

  const handleComplete = async (item: EnrichedActionItem) => {
    const itemKey = item.actionItemId;
    const currentState = checkboxStates.get(itemKey);
    const currentIsCompleted = currentState?.isCompleted ?? item.status === "completed";
    const newIsCompleted = !currentIsCompleted;

    // Update UI immediately
    setCheckboxStates((prev) => {
      const next = new Map(prev);
      next.set(itemKey, { isCompleted: newIsCompleted });
      return next;
    });

    const newStatus = newIsCompleted ? "completed" : "pending";

    try {
      await updateActionItemMutation.mutateAsync({
        contactId: item.contactId,
        actionItemId: item.actionItemId,
        updates: { status: newStatus },
      });
      // Success - keep the checkbox state as is, no further updates
    } catch (error) {
      // Revert checkbox state on error
      setCheckboxStates((prev) => {
        const next = new Map(prev);
        const errorMessage = extractErrorMessage(error);
        next.set(itemKey, { isCompleted: currentIsCompleted, error: errorMessage });
        return next;
      });

      reportException(error, {
        context: "Completing action item",
        tags: { component: "ActionItemsListSection", actionItemId: item.actionItemId },
      });
    }
  };

  const handleEdit = async (item: EnrichedActionItem, text: string, dueDate?: string | null) => {
    const itemKey = item.actionItemId;
    const currentState = editStates.get(itemKey);
    const originalText = currentState?.text ?? item.text;
    const originalDueDate =
      currentState?.dueDate ??
      (item.dueDate
        ? typeof item.dueDate === "string"
          ? item.dueDate
          : item.dueDate instanceof Date
          ? item.dueDate.toISOString().split("T")[0]
          : null
        : null);

    // Update UI immediately
    setEditStates((prev) => {
      const next = new Map(prev);
      next.set(itemKey, { text, dueDate: dueDate || null });
      return next;
    });

    try {
      await updateActionItemMutation.mutateAsync({
        contactId: item.contactId,
        actionItemId: item.actionItemId,
        updates: { text, dueDate },
      });
      // Success - keep the edit state as is, no further updates
    } catch (error) {
      // Revert edit state on error
      setEditStates((prev) => {
        const next = new Map(prev);
        const errorMessage = extractErrorMessage(error);
        next.set(itemKey, { text: originalText, dueDate: originalDueDate, error: errorMessage });
        return next;
      });

      reportException(error, {
        context: "Editing action item",
        tags: { component: "ActionItemsListSection", actionItemId: item.actionItemId },
      });
    }
  };

  const handleDeleteClick = (item: EnrichedActionItem) => {
    setItemToDelete(item);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    const itemKey = itemToDelete.actionItemId;

    // Close modal
    setItemToDelete(null);

    // Remove from UI immediately
    setDeletedItems((prev) => {
      const next = new Map(prev);
      next.set(itemKey, {});
      return next;
    });

    try {
      await deleteActionItemMutation.mutateAsync({
        contactId: itemToDelete.contactId,
        actionItemId: itemToDelete.actionItemId,
      });
      // Success - keep the item deleted, no further updates
    } catch (error) {
      // Restore item on error
      setDeletedItems((prev) => {
        const next = new Map(prev);
        const errorMessage = extractErrorMessage(error);
        next.set(itemKey, { error: errorMessage });
        return next;
      });

      reportException(error, {
        context: "Deleting action item",
        tags: { component: "ActionItemsListSection", actionItemId: itemToDelete.actionItemId },
      });
    }
  };

  const handleDeleteCancel = () => {
    setItemToDelete(null);
  };

  const filteredItems = useMemo(() => {
    return actionItems.filter((item) => {
    // Hide items that are deleted (unless they have an error - then show them with error)
    const deletedState = deletedItems.get(item.actionItemId);
    if (deletedState && !deletedState.error) {
      return false; // Hide successfully deleted items
    }

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
  }, [actionItems, filterStatus, filterDate, selectedContactId, deletedItems]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [filterStatus, filterDate, selectedContactId]);

  // Paginate filtered items
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  return (
    <>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={handleDeleteCancel}
        title="Delete Action Item"
        closeOnBackdropClick={!deleteActionItemMutation.isPending}
      >
        <p className="text-theme-dark mb-6">
          Are you sure you want to delete this action item? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={handleDeleteCancel}
            disabled={deleteActionItemMutation.isPending}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleteActionItemMutation.isPending}
            loading={deleteActionItemMutation.isPending}
            variant="danger"
            size="sm"
          >
            Delete
          </Button>
        </div>
      </Modal>

      <Card padding="md">
        {/* Show skeletons only when loading AND no action items available */}
        {/* If action items exist (even from cache), show them immediately */}
        {isLoading && actionItems.length === 0 ? (
          <ThemedSuspense
            isLoading={true}
            fallback={
              <div>
                <div className="h-6 bg-theme-light rounded w-40 mb-4 animate-pulse" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-card-highlight-light rounded-sm p-4 animate-pulse">
                      <div className="h-5 bg-theme-light rounded w-3/4 mb-2" />
                      <div className="h-4 bg-theme-light rounded w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        ) : hasConfirmedNoActionItems && actionItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No action items</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-theme-darkest mb-4">
              {filteredItems.length} Action Item{filteredItems.length !== 1 ? "s" : ""}
            </h2>
            {filteredItems.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No action items match your filters</p>
            ) : (
            <>
              {/* Top Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                startIndex={startIndex}
                endIndex={endIndex}
                itemLabel="action item"
                onPageChange={setCurrentPage}
                hideItemCount={true}
              />

              <div className="space-y-3">
                {paginatedItems.map((item) => {
                const checkboxState = checkboxStates.get(item.actionItemId);
                const isCompleted = checkboxState?.isCompleted ?? item.status === "completed";
                const checkboxError = checkboxState?.error;

                const editState = editStates.get(item.actionItemId);
                const displayText = editState?.text ?? item.text;
                const displayDueDate =
                  editState?.dueDate !== undefined
                    ? editState.dueDate
                      ? new Date(editState.dueDate)
                      : null
                    : item.dueDate;
                const editError = editState?.error;

                const deletedState = deletedItems.get(item.actionItemId);
                const deleteError = deletedState?.error;

                // Create action item with local state for display
                const itemWithLocalState: ActionItem = {
                  ...item,
                  status: isCompleted ? "completed" : "pending",
                  text: displayText,
                  dueDate: displayDueDate,
                };

                return (
                  <div key={`${item.contactId}_${item.actionItemId}`}>
                    <ActionItemCard
                      actionItem={itemWithLocalState}
                      contactId={item.contactId}
                      contactName={item.contactName}
                      contactEmail={item.contactEmail}
                      contactFirstName={item.contactFirstName}
                      contactLastName={item.contactLastName}
                      onComplete={() => handleComplete(item)}
                      onDelete={() => handleDeleteClick(item)}
                      onEdit={(text, dueDate) => handleEdit(item, text, dueDate)}
                      disabled={!!deletedState}
                      isOverdue={item.isOverdue}
                      displayName={item.displayName}
                      initials={item.initials}
                      contactLoading={item.contactLoading}
                    />
                    {checkboxError && (
                      <div className="mt-2">
                        <ErrorMessage
                          message={checkboxError}
                          dismissible
                          onDismiss={() => {
                            setCheckboxStates((prev) => {
                              const next = new Map(prev);
                              const current = next.get(item.actionItemId);
                              if (current) {
                                next.set(item.actionItemId, { ...current, error: undefined });
                              }
                              return next;
                            });
                          }}
                        />
                      </div>
                    )}
                    {editError && (
                      <div className="mt-2">
                        <ErrorMessage
                          message={editError}
                          dismissible
                          onDismiss={() => {
                            setEditStates((prev) => {
                              const next = new Map(prev);
                              const current = next.get(item.actionItemId);
                              if (current) {
                                next.set(item.actionItemId, { ...current, error: undefined });
                              }
                              return next;
                            });
                          }}
                        />
                      </div>
                    )}
                    {deleteError && (
                      <div className="mt-2">
                        <ErrorMessage
                          message={deleteError}
                          dismissible
                          onDismiss={() => {
                            setDeletedItems((prev) => {
                              const next = new Map(prev);
                              next.delete(item.actionItemId);
                              return next;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredItems.length}
                startIndex={startIndex}
                endIndex={endIndex}
                itemLabel="action item"
                onPageChange={setCurrentPage}
              />
            </>
            )}
          </>
        )}
      </Card>
    </>
  );
}

