"use client";

import { useState, useEffect } from "react";
import { ActionItem } from "@/types/firestore";
import ActionItemCard from "./ActionItemCard";
import { Button } from "@/components/Button";
import { ErrorMessage, extractApiError, extractErrorMessage } from "@/components/ErrorMessage";
import { reportException, reportMessage, ErrorLevel } from "@/lib/error-reporting";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Contact } from "@/types/firestore";
import { useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from "@/hooks/useActionItemMutations";

interface ActionItemsListProps {
  userId: string;
  contactId: string;
  contactName?: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  onActionItemUpdate?: () => void;
  // Pre-fetched action items (for SSR)
  initialActionItems?: ActionItem[];
  initialContact?: Contact;
}

type FilterStatus = "all" | "pending" | "completed";

export default function ActionItemsList({
  userId,
  contactId,
  contactName,
  contactEmail,
  contactFirstName,
  contactLastName,
  onActionItemUpdate,
  initialActionItems,
  initialContact,
}: ActionItemsListProps) {
  const createActionItemMutation = useCreateActionItem(userId);
  const updateActionItemMutation = useUpdateActionItem(userId);
  const deleteActionItemMutation = useDeleteActionItem(userId);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems || []);
  const [loading, setLoading] = useState(!initialActionItems); // Only loading if no initial data
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(() => {
    // Check localStorage for persisted quota status
    if (typeof window !== "undefined") {
      return localStorage.getItem("firestoreQuotaExceeded") === "true";
    }
    return false;
  });

  useEffect(() => {
    // If initialActionItems provided, skip fetching (SSR mode)
    if (initialActionItems) {
      setLoading(false);
      return;
    }

    if (!userId || !contactId) {
      setLoading(false);
      return;
    }

    // Don't fetch if quota is already exceeded - prevents repeated failed requests
    if (quotaExceeded) {
      setLoading(false);
      return;
    }

    // Fetch action items via API route (uses session auth) - only if no initial data
    const fetchActionItems = async () => {
      try {
        const response = await fetch(
          `/api/action-items?contactId=${encodeURIComponent(contactId)}`
        );
        
        // Check for quota errors BEFORE trying to parse response
        if (response.status === 429) {
          setQuotaExceeded(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("firestoreQuotaExceeded", "true");
          }
          setUpdateError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
          setActionItems([]);
          setLoading(false);
          return; // Stop here, don't throw
        }
        
        if (!response.ok) {
          const errorMessage = await extractApiError(response);
          // Check if it's a quota error
          if (errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
            setQuotaExceeded(true);
            if (typeof window !== "undefined") {
              localStorage.setItem("firestoreQuotaExceeded", "true");
            }
            setUpdateError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
            setActionItems([]);
            setLoading(false);
            return; // Stop here, don't throw
          }
          throw new Error(errorMessage);
        }
        const data = await response.json();
        setActionItems(data.actionItems || []);
        setLoading(false);
        // Reset quota status if successful
        setQuotaExceeded(false);
        if (typeof window !== "undefined") {
          localStorage.removeItem("firestoreQuotaExceeded");
        }
      } catch (error) {
        reportException(error, {
          context: "Fetching action items",
          tags: { component: "ActionItemsList", contactId },
        });
        const errorMessage = extractErrorMessage(error);
        // Check for quota errors in catch block too
        if (errorMessage.includes("Quota exceeded") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
          setQuotaExceeded(true);
          if (typeof window !== "undefined") {
            localStorage.setItem("firestoreQuotaExceeded", "true");
          }
          setUpdateError("Database quota exceeded. Please wait a few hours or upgrade your plan.");
          setActionItems([]);
          setLoading(false);
          return; // Stop here
        }
        // Don't show error if it's a permissions issue - just show empty list
        if (errorMessage.includes("Permission") || errorMessage.includes("Authentication")) {
          reportMessage("Action items require proper authentication. Please ensure you're logged in.", ErrorLevel.WARNING, {
            tags: { component: "ActionItemsList" },
          });
        }
        setActionItems([]);
        setLoading(false);
      }
    };

    fetchActionItems();

    // No polling - only fetch on mount and when contactId changes
    // Updates will be triggered manually via onActionItemUpdate callback
    // Note: quotaExceeded is NOT in dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, contactId]);

  const handleAdd = async () => {
    if (!newText.trim()) return;

    setSaving(true);
    setAddError(null);
    try {
      await createActionItemMutation.mutateAsync({
        contactId,
        text: newText.trim(),
        dueDate: newDueDate || null,
      });

      setNewText("");
      setNewDueDate("");
      setIsAdding(false);
      setAddError(null);
      // React Query will automatically invalidate and refetch, or call callback
      if (!initialActionItems) {
        onActionItemUpdate?.();
      }
    } catch (error) {
      reportException(error, {
        context: "Adding action item",
        tags: { component: "ActionItemsList", contactId },
      });
      setAddError(extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (actionItemId: string) => {
    setUpdating(actionItemId);
    setUpdateError(null);
    
    // Find the current item to toggle its status
    const currentItem = actionItems.find(item => item.actionItemId === actionItemId);
    if (!currentItem) return;
    
    // Optimistic update: immediately update the UI
    const newStatus = currentItem.status === "completed" ? "pending" : "completed";
    const previousStatus = currentItem.status;
    const now = Date.now();
    
    setActionItems((prevItems) =>
      prevItems.map((prevItem) =>
        prevItem.actionItemId === actionItemId
          ? {
              ...prevItem,
              status: newStatus,
              completedAt: newStatus === "completed" ? now : null,
            }
          : prevItem
      )
    );

    try {
      await updateActionItemMutation.mutateAsync({
        contactId,
        actionItemId,
        updates: { status: newStatus },
      });

      setUpdateError(null);
      // React Query will automatically invalidate and refetch, or call callback
      if (!initialActionItems) {
        onActionItemUpdate?.();
      }
    } catch (error) {
      // Revert optimistic update on error
      setActionItems((prevItems) =>
        prevItems.map((prevItem) =>
          prevItem.actionItemId === actionItemId
            ? {
                ...prevItem,
                status: previousStatus,
                completedAt: previousStatus === "completed" ? currentItem.completedAt : null,
              }
            : prevItem
        )
      );
      
      reportException(error, {
        context: "Completing action item",
        tags: { component: "ActionItemsList", contactId, actionItemId },
      });
      setUpdateError(extractErrorMessage(error));
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (actionItemId: string) => {
    if (!confirm("Are you sure you want to delete this action item?")) {
      return;
    }

    // Optimistic update: immediately remove from UI
    const itemToDelete = actionItems.find(item => item.actionItemId === actionItemId);
    if (!itemToDelete) return;

    setActionItems((prevItems) => prevItems.filter(item => item.actionItemId !== actionItemId));
    setUpdating(actionItemId);
    setUpdateError(null);

    try {
      await deleteActionItemMutation.mutateAsync({
        contactId,
        actionItemId,
      });

      setUpdateError(null);
      // React Query will automatically invalidate and refetch, or call callback
      if (!initialActionItems) {
        onActionItemUpdate?.();
      }
    } catch (error) {
      // Revert optimistic update on error - restore the deleted item
      setActionItems((prevItems) => [...prevItems, itemToDelete]);
      
      reportException(error, {
        context: "Deleting action item",
        tags: { component: "ActionItemsList", contactId, actionItemId },
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
      // React Query will automatically invalidate and refetch, or call callback
      if (!initialActionItems) {
        onActionItemUpdate?.();
      }
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

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Loading action items...</p>
      </div>
    );
  }

  if (quotaExceeded) {
    return (
      <div className="text-center py-4">
        <ErrorMessage
          message="Database quota exceeded. Action items cannot be loaded. Please wait a few hours or upgrade your plan."
          dismissible={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Action Items
          </h3>
        </div>
        
        {/* Filter tabs - segmented control style */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1" role="tablist">
          <button
            onClick={() => setFilterStatus("all")}
            role="tab"
            aria-selected={filterStatus === "all"}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              filterStatus === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All
            <span className={`ml-1.5 ${
              filterStatus === "all" ? "text-gray-600" : "text-gray-400"
            }`}>
              ({actionItems.length})
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            role="tab"
            aria-selected={filterStatus === "pending"}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              filterStatus === "pending"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending
            <span className={`ml-1.5 ${
              filterStatus === "pending" ? "text-gray-600" : "text-gray-400"
            }`}>
              ({pendingCount})
            </span>
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            role="tab"
            aria-selected={filterStatus === "completed"}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              filterStatus === "completed"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Completed
            <span className={`ml-1.5 ${
              filterStatus === "completed" ? "text-gray-600" : "text-gray-400"
            }`}>
              ({completedCount})
            </span>
          </button>
        </div>
      </div>

      {/* Add new action item */}
      {isAdding ? (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter action item..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
            rows={2}
            disabled={saving}
          />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            placeholder="Due date (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            disabled={saving}
          />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={saving || !newText.trim()}
                loading={saving}
                variant="gradient-blue"
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
                variant="gradient-gray"
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
          variant="gradient-blue"
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
        <p className="text-sm text-gray-500 text-center py-4">
          {filterStatus === "all"
            ? "No action items yet"
            : `No ${filterStatus} action items`}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            // Pre-compute values if we have initialContact, otherwise let ActionItemCard compute
            const contactForUtils: Contact = initialContact || {
              contactId: contactId,
              firstName: contactFirstName,
              lastName: contactLastName,
              primaryEmail: contactEmail || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            const displayName = contactName || getDisplayName(contactForUtils);
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
                contactName={contactName}
                contactEmail={contactEmail}
                contactFirstName={contactFirstName}
                contactLastName={contactLastName}
                onComplete={() => handleComplete(item.actionItemId)}
                onDelete={() => handleDelete(item.actionItemId)}
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
  );
}

