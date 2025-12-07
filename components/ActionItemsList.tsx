"use client";

import { useState, useEffect } from "react";
import { ActionItem } from "@/types/firestore";
import ActionItemCard from "./ActionItemCard";
import { Button } from "./Button";
import { ErrorMessage, extractApiError, extractErrorMessage } from "./ErrorMessage";
import { reportException, reportMessage, ErrorLevel } from "@/lib/error-reporting";

interface ActionItemsListProps {
  userId: string;
  contactId: string;
  onActionItemUpdate?: () => void;
}

type FilterStatus = "all" | "pending" | "completed";

export default function ActionItemsList({
  userId,
  contactId,
  onActionItemUpdate,
}: ActionItemsListProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!userId || !contactId) {
      setLoading(false);
      return;
    }

    // Don't fetch if quota is already exceeded - prevents repeated failed requests
    if (quotaExceeded) {
      setLoading(false);
      return;
    }

    // Fetch action items via API route (uses session auth)
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
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          text: newText.trim(),
          dueDate: newDueDate || null,
        }),
      });

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }

      setNewText("");
      setNewDueDate("");
      setIsAdding(false);
      setAddError(null);
      onActionItemUpdate?.();
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
    try {
      const response = await fetch(
        `/api/action-items?contactId=${contactId}&actionItemId=${actionItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        }
      );

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }

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

  const handleDelete = async (actionItemId: string) => {
    if (!confirm("Are you sure you want to delete this action item?")) {
      return;
    }

    setUpdating(actionItemId);
    setUpdateError(null);
    try {
      const response = await fetch(
        `/api/action-items?contactId=${contactId}&actionItemId=${actionItemId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }

      setUpdateError(null);
      onActionItemUpdate?.();
    } catch (error) {
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
      const response = await fetch(
        `/api/action-items?contactId=${contactId}&actionItemId=${actionItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            dueDate: dueDate || null,
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await extractApiError(response);
        throw new Error(errorMessage);
      }

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Action Items
          </h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            onClick={() => setFilterStatus("all")}
            variant={filterStatus === "all" ? "primary" : "ghost"}
            size="sm"
            className={`text-xs ${
              filterStatus === "all"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            All ({actionItems.length})
          </Button>
          <Button
            onClick={() => setFilterStatus("pending")}
            variant={filterStatus === "pending" ? "primary" : "ghost"}
            size="sm"
            className={`text-xs ${
              filterStatus === "pending"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            onClick={() => setFilterStatus("completed")}
            variant={filterStatus === "completed" ? "primary" : "ghost"}
            size="sm"
            className={`text-xs ${
              filterStatus === "completed"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Done ({completedCount})
          </Button>
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
                variant="primary"
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
          variant="outline"
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
          {filteredItems.map((item) => (
            <ActionItemCard
              key={item.actionItemId}
              actionItem={item}
              onComplete={() => handleComplete(item.actionItemId)}
              onDelete={() => handleDelete(item.actionItemId)}
              onEdit={(text, dueDate) =>
                handleEdit(item.actionItemId, text, dueDate ?? null)
              }
              disabled={updating === item.actionItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

