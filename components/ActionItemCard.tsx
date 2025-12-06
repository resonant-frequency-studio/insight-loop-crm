"use client";

import { useState } from "react";
import { ActionItem } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";

interface ActionItemCardProps {
  actionItem: ActionItem;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: (text: string, dueDate?: string | null) => void;
  disabled?: boolean;
}

export default function ActionItemCard({
  actionItem,
  onComplete,
  onDelete,
  onEdit,
  disabled = false,
}: ActionItemCardProps) {
  const isOverdue =
    actionItem.status === "pending" &&
    actionItem.dueDate &&
    (() => {
      const dueDate = actionItem.dueDate;
      if (!dueDate) return false;
      if (dueDate instanceof Date) return dueDate < new Date();
      if (typeof dueDate === "string") return new Date(dueDate) < new Date();
      if (typeof dueDate === "object" && "toDate" in dueDate) {
        return (dueDate as { toDate: () => Date }).toDate() < new Date();
      }
      return false;
    })();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(actionItem.text);
  const [editDueDate, setEditDueDate] = useState<string>(
    actionItem.dueDate
      ? typeof actionItem.dueDate === "string"
        ? actionItem.dueDate.split("T")[0]
        : actionItem.dueDate instanceof Date
        ? actionItem.dueDate.toISOString().split("T")[0]
        : ""
      : ""
  );

  const handleSaveEdit = () => {
    onEdit(editText, editDueDate || null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(actionItem.text);
    setEditDueDate(
      actionItem.dueDate
        ? typeof actionItem.dueDate === "string"
          ? actionItem.dueDate.split("T")[0]
          : ""
        : ""
    );
    setIsEditing(false);
  };

  return (
    <div
      className={`p-3 rounded-lg border ${
        actionItem.status === "completed"
          ? "bg-gray-50 border-gray-200"
          : isOverdue
          ? "bg-red-50 border-red-200"
          : "bg-white border-gray-200"
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
            rows={2}
            disabled={disabled}
          />
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={disabled || !editText.trim()}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={disabled}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            onClick={onComplete}
            disabled={disabled || actionItem.status === "completed"}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed ${
              actionItem.status === "completed"
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-green-500"
            }`}
            title={
              actionItem.status === "completed" ? "Completed" : "Mark as complete"
            }
          >
            {actionItem.status === "completed" && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm ${
                actionItem.status === "completed"
                  ? "text-gray-500 line-through"
                  : "text-gray-900"
              }`}
            >
              {actionItem.text}
            </p>
            {actionItem.dueDate && (
              <p
                className={`text-xs mt-1 ${
                  isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                }`}
              >
                Due: {formatContactDate(actionItem.dueDate, { relative: true })}
                {isOverdue && " (Overdue)"}
              </p>
            )}
            {actionItem.status === "completed" && actionItem.completedAt && (
              <p className="text-xs text-gray-500 mt-1">
                Completed: {formatContactDate(actionItem.completedAt, { relative: true })}
              </p>
            )}
          </div>
          {actionItem.status === "pending" && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setIsEditing(true)}
                disabled={disabled}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit"
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={onDelete}
                disabled={disabled}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

