"use client";

import { useState } from "react";
import { ActionItem } from "@/types/firestore";
import ActionItemCard from "./ActionItemCard";
import { Button } from "@/components/Button";
import Modal from "@/components/Modal";
import { ErrorMessage, extractErrorMessage } from "@/components/ErrorMessage";
import Textarea from "@/components/Textarea";
import Input from "@/components/Input";
import { reportException } from "@/lib/error-reporting";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Contact } from "@/types/firestore";
import { useActionItems } from "@/hooks/useActionItems";
import { useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";

interface ActionItemsListProps {
  userId: string;
  contactId: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactCompany?: string;
  onActionItemUpdate?: () => void;
  // Pre-fetched action items (for SSR)
  initialActionItems?: ActionItem[];
  initialContact?: Contact;
}

type FilterStatus = "all" | "pending" | "completed";

export default function ActionItemsList({
  userId,
  contactId,
  contactEmail,
  contactFirstName,
  contactLastName,
  contactCompany,
  onActionItemUpdate,
  initialActionItems,
  initialContact,
}: ActionItemsListProps) {
  const { data: actionItems = [], isLoading } = useActionItems(userId, contactId, initialActionItems);
  const createActionItemMutation = useCreateActionItem();
  const updateActionItemMutation = useUpdateActionItem();
  const deleteActionItemMutation = useDeleteActionItem();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newText.trim()) return;

    setSaving(true);
    setAddError(null);
    
    const textToSave = newText.trim();
    const dueDateToSave = newDueDate;
    
    setNewText("");
    setNewDueDate("");
    setIsAdding(false);
    
    try {
      await createActionItemMutation.mutateAsync({
        contactId,
        text: textToSave,
        dueDate: dueDateToSave || null,
      });

      setAddError(null);
      onActionItemUpdate?.();
    } catch (error) {
      reportException(error, {
        context: "Adding action item",
        tags: { component: "ActionItemsList", contactId },
      });
      setAddError(extractErrorMessage(error));
      // Restore the form state so user can try again
      setNewText(textToSave);
      setNewDueDate(dueDateToSave);
      setIsAdding(true);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (actionItemId: string) => {
    setUpdating(actionItemId);
    setUpdateError(null);
    
    const currentItem = actionItems.find(item => item.actionItemId === actionItemId);
    if (!currentItem) return;
    
    const newStatus = currentItem.status === "completed" ? "pending" : "completed";

    try {
      await updateActionItemMutation.mutateAsync({
        contactId,
        actionItemId,
        updates: { status: newStatus },
      });

      setUpdateError(null);
      onActionItemUpdate?.();
    } catch (error) {
      reportException(error, {
        context: "Completing action item",
        tags: { component: "ActionItemsList", contactId, actionItemId },
      });
      setUpdateError(extractErrorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteClick = (actionItemId: string) => {
    setDeleteConfirmItemId(actionItemId);
    setUpdateError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItemId) return;

    setUpdating(deleteConfirmItemId);
    setUpdateError(null);

    try {
      await deleteActionItemMutation.mutateAsync({
        contactId,
        actionItemId: deleteConfirmItemId,
      });

      setUpdateError(null);
      setDeleteConfirmItemId(null);
      onActionItemUpdate?.();
    } catch (error) {
      reportException(error, {
        context: "Deleting action item",
        tags: { component: "ActionItemsList", contactId },
      });
      setUpdateError(extractErrorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const handleEdit = async (
    actionItemId: string,
    text: string,
    dueDate: string | null
  ) => {
    setUpdating(actionItemId);
    setUpdateError(null);
    try {
      await updateActionItemMutation.mutateAsync({
        contactId,
        actionItemId,
        updates: {
          text: text.trim(),
          dueDate: dueDate || null,
        },
      });

      setUpdateError(null);
      onActionItemUpdate?.();
    } catch (error) {
      reportException(error, {
        context: "Updating action item",
        tags: { component: "ActionItemsList", contactId, actionItemId },
      });
      setUpdateError(extractErrorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const filteredItems = actionItems.filter((item) => {
    if (filterStatus === "all") return true;
    return item.status === filterStatus;
  });

  const pendingCount = actionItems.filter((i) => i.status === "pending").length;
  const completedCount = actionItems.filter(
    (i) => i.status === "completed"
  ).length;

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Loading action items...</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmItemId !== null}
        onClose={() => {
          if (!deleteActionItemMutation.isPending) {
            setDeleteConfirmItemId(null);
            setUpdateError(null);
          }
        }}
        title="Delete Action Item"
        closeOnBackdropClick={!deleteActionItemMutation.isPending}
      >
        <p className="text-theme-dark mb-6">
          Are you sure you want to delete this action item? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => {
              setDeleteConfirmItemId(null);
              setUpdateError(null);
            }}
            disabled={deleteActionItemMutation.isPending}
            variant="secondary"
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
            error={updateError}
          >
            Delete
          </Button>
        </div>
      </Modal>

      <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Header with filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-theme-darkest">
            Action Items
          </h3>
        </div>
        
        {/* Filter tabs - segmented control style with responsive design */}
        <div className="flex flex-wrap gap-2" role="tablist">
          <button
            onClick={() => setFilterStatus("all")}
            role="tab"
            aria-selected={filterStatus === "all"}
            className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm text-foreground font-medium rounded-sm transition-all duration-200 border border-theme-medium ${
              filterStatus === "all"
                ? "bg-theme-light"
                : "hover:bg-theme-light hover:bg-opacity-10"
            }`}
          >
            All
            <span className={`ml-1 ${
              filterStatus === "all" ? "text-theme-dark" : "text-gray-400"
            }`}>
              ({actionItems.length})
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            role="tab"
            aria-selected={filterStatus === "pending"}
            className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm text-foreground font-medium rounded-sm transition-all duration-200 border border-theme-medium ${
              filterStatus === "pending"
                ? "bg-theme-light"
                : "hover:bg-theme-light hover:bg-opacity-10"
            }`}
          >
            Pending
            <span className={`ml-1 ${
              filterStatus === "pending" ? "text-theme-dark" : "text-gray-400"
            }`}>
              ({pendingCount})
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            role="tab"
            aria-selected={filterStatus === "completed"}
            className={`cursor-pointer px-3 py-1.5 text-xs sm:text-sm text-foreground font-medium rounded-sm transition-all duration-200 border border-theme-medium ${
              filterStatus === "completed"
                ? "bg-theme-light"
                : "hover:bg-theme-light hover:bg-opacity-10"
            }`}
          >
            Completed
            <span className={`ml-1 ${
              filterStatus === "completed" ? "text-theme-dark" : "text-gray-400"
            }`}>
              ({completedCount})
            </span>
          </button>
        </div>
      </div>

      {/* Add new action item */}
      {isAdding ? (
        <div className="p-3 rounded-sm border border-gray-200 space-y-3">
          <Textarea
            id="action-item-new-text"
            name="action-item-new-text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter action item..."
            className="px-3 py-2"
            rows={2}
            disabled={saving}
          />
          <Input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            placeholder="Due date (optional)"
            className="px-3 py-2"
            disabled={saving}
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={saving || !newText.trim()}
                loading={saving}
                variant="success"
                size="sm"
                error={addError}
              >
                Add
              </Button>
              <Button
                onClick={() => {
                  setIsAdding(false);
                  setNewText("");
                  setNewDueDate("");
                  setAddError(null);
                }}
                disabled={saving}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setIsAdding(true)}
          size="sm"
          fullWidth
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          Add Action Item
        </Button>
      )}
      {updateError && (
        <div className="mt-2">
          <ErrorMessage message={updateError} dismissible onDismiss={() => setUpdateError(null)} />
        </div>
      )}

      {/* Action items list */}
      {filteredItems.length === 0 ? (
        <p className="text-sm text-theme-medium text-center py-4">
          {filterStatus === "all"
            ? "No action items yet"
            : `No ${filterStatus} action items`}
        </p>
      ) : (
        <div className="space-y-2 min-w-0 overflow-hidden">
          {filteredItems.map((item) => {
            // Pre-compute values if we have initialContact, otherwise let ActionItemCard compute
            const contactForUtils: Contact = initialContact || {
              contactId: contactId,
              firstName: contactFirstName,
              lastName: contactLastName,
              company: contactCompany,
              primaryEmail: contactEmail || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            const displayName = getDisplayName(contactForUtils);
            const initials = getInitials(contactForUtils);
            // Compute isOverdue on client (ActionItemCard will also compute if not provided)
            const isOverdue =
              item.status === "pending" && item.dueDate
                ? (() => {
                    const dueDate = item.dueDate;
                    if (!dueDate) return false;
                    if (dueDate instanceof Date) return dueDate < new Date();
                    if (typeof dueDate === "string") return new Date(dueDate) < new Date();
                    if (typeof dueDate === "object" && "toDate" in dueDate) {
                      return (dueDate as { toDate: () => Date }).toDate() < new Date();
                    }
                    return false;
                  })()
                : false;

            return (
              <ActionItemCard
                key={item.actionItemId}
                actionItem={item}
                contactId={contactId}
                contactEmail={contactEmail}
                contactFirstName={contactFirstName}
                contactLastName={contactLastName}
                onComplete={() => handleComplete(item.actionItemId)}
                onDelete={() => handleDeleteClick(item.actionItemId)}
                onEdit={(text, dueDate) =>
                  handleEdit(item.actionItemId, text, dueDate ?? null)
                }
                disabled={updating === item.actionItemId}
                compact={true}
                isOverdue={isOverdue}
                displayName={displayName}
                initials={initials}
              />
            );
          })}
        </div>
      )}
      </div>
    </>
  );
}

