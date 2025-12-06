"use client";

import { useState, useEffect } from "react";
import { ActionItem } from "@/types/firestore";
import ActionItemCard from "./ActionItemCard";

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

  useEffect(() => {
    if (!userId || !contactId) {
      setLoading(false);
      return;
    }

    // Fetch action items via API route (uses session auth)
    const fetchActionItems = async () => {
      try {
        const response = await fetch(
          `/api/action-items?contactId=${encodeURIComponent(contactId)}`
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch action items");
        }
        const data = await response.json();
        setActionItems(data.actionItems || []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching action items:", error);
        // Don't show error if it's a permissions issue - just show empty list
        if (error instanceof Error && error.message.includes("permission")) {
          console.warn("Action items require proper authentication. Please ensure you're logged in.");
        }
        setActionItems([]);
        setLoading(false);
      }
    };

    fetchActionItems();

    // Refresh action items after create/update/delete operations
    // Poll for updates every 10 seconds (less frequent than before)
    const interval = setInterval(fetchActionItems, 10000);

    return () => clearInterval(interval);
  }, [userId, contactId]);

  const handleAdd = async () => {
    if (!newText.trim()) return;

    setSaving(true);
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
        throw new Error("Failed to create action item");
      }

      setNewText("");
      setNewDueDate("");
      setIsAdding(false);
      onActionItemUpdate?.();
    } catch (error) {
      console.error("Error adding action item:", error);
      alert("Failed to add action item. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (actionItemId: string) => {
    setUpdating(actionItemId);
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
        throw new Error("Failed to complete action item");
      }

      onActionItemUpdate?.();
    } catch (error) {
      console.error("Error completing action item:", error);
      alert("Failed to complete action item. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (actionItemId: string) => {
    if (!confirm("Are you sure you want to delete this action item?")) {
      return;
    }

    setUpdating(actionItemId);
    try {
      const response = await fetch(
        `/api/action-items?contactId=${contactId}&actionItemId=${actionItemId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete action item");
      }

      onActionItemUpdate?.();
    } catch (error) {
      console.error("Error deleting action item:", error);
      alert("Failed to delete action item. Please try again.");
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
        throw new Error("Failed to update action item");
      }

      onActionItemUpdate?.();
    } catch (error) {
      console.error("Error updating action item:", error);
      alert("Failed to update action item. Please try again.");
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
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-2 py-1 text-xs font-medium rounded ${
              filterStatus === "all"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            All ({actionItems.length})
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-2 py-1 text-xs font-medium rounded ${
              filterStatus === "pending"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-2 py-1 text-xs font-medium rounded ${
              filterStatus === "completed"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Done ({completedCount})
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
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newText.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewText("");
                setNewDueDate("");
              }}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
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
          Add Action Item
        </button>
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
                handleEdit(item.actionItemId, text, dueDate)
              }
              disabled={updating === item.actionItemId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

