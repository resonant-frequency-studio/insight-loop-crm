"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionItem } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Button } from "./Button";

interface ActionItemCardProps {
  actionItem: ActionItem;
  contactId: string;
  contactName?: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: (text: string, dueDate?: string | null) => void;
  disabled?: boolean;
  compact?: boolean; // If true, hide contact info (for use on contact detail page)
}

export default function ActionItemCard({
  actionItem,
  contactId,
  contactName,
  contactEmail,
  contactFirstName,
  contactLastName,
  onComplete,
  onDelete,
  onEdit,
  disabled = false,
  compact = false,
}: ActionItemCardProps) {
  const isOverdue =
    actionItem.status === "pending" &&
    actionItem.dueDate
      ? (() => {
          const dueDate = actionItem.dueDate;
          if (!dueDate) return false;
          if (dueDate instanceof Date) return dueDate < new Date();
          if (typeof dueDate === "string") return new Date(dueDate) < new Date();
          if (typeof dueDate === "object" && "toDate" in dueDate) {
            return (dueDate as { toDate: () => Date }).toDate() < new Date();
          }
          return false;
        })()
      : false;

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

  // Create a contact-like object for utility functions
  const contactForUtils = {
    firstName: contactFirstName,
    lastName: contactLastName,
    primaryEmail: contactEmail || "",
  };

  const displayName = contactName || getDisplayName(contactForUtils);
  const initials = getInitials(contactForUtils);
  const email = contactEmail || "";

  const getVariantStyles = () => {
    if (actionItem.status === "completed") {
      return "bg-gray-50 border border-gray-200";
    }
    if (isOverdue) {
      return "bg-red-50 border border-red-200";
    }
    return "bg-gray-50 border border-gray-200";
  };

  const getAvatarStyles = () => {
    if (actionItem.status === "completed") {
      return "bg-gradient-to-br from-gray-400 to-gray-500";
    }
    if (isOverdue) {
      return "bg-gradient-to-br from-red-600 to-red-700";
    }
    return "bg-gradient-to-br from-blue-500 to-purple-600";
  };

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
    <div className={`rounded-lg p-4 transition-all duration-200 ${getVariantStyles()}`}>
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
            <Button
              onClick={handleSaveEdit}
              disabled={disabled || !editText.trim()}
              variant="primary"
              size="sm"
            >
              Save
            </Button>
            <Button
              onClick={handleCancelEdit}
              disabled={disabled}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onComplete}
            disabled={disabled}
            className={`mt-0.5 w-5 h-5 p-0 rounded border-2 flex items-center justify-center shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              actionItem.status === "completed"
                ? "bg-green-500 border-green-500 hover:bg-green-600"
                : "border-gray-300 hover:border-green-500 bg-transparent"
            }`}
            title={
              actionItem.status === "completed" ? "Mark as pending" : "Mark as complete"
            }
            aria-label={actionItem.status === "completed" ? "Mark as pending" : "Mark as complete"}
          >
            {actionItem.status === "completed" && (
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>

          {/* Contact Info Section - Only show if not in compact mode */}
          <div className="flex-1 min-w-0">
            {!compact && (
              <Link
                href={`/contacts/${contactId}`}
                className="block group"
              >
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    <div className={`w-10 h-10 ${getAvatarStyles()} rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
                      {initials}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold group-hover:text-gray-700 transition-colors ${
                      actionItem.status === "completed" ? "text-gray-500" : "text-gray-900"
                    }`}>
                      {displayName}
                    </h3>
                    {email && (
                      <p className={`text-xs truncate mt-0.5 ${
                        actionItem.status === "completed" ? "text-gray-400" : "text-gray-500"
                      }`}>
                        {email}
                      </p>
                    )}
                  </div>

                  {/* Arrow Icon */}
                  <div className="hidden lg:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            )}

            {/* Action Item Content */}
            <div className={compact ? "" : "ml-0 lg:ml-13"}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p
                  className={`text-sm font-medium flex-1 ${
                    actionItem.status === "completed"
                      ? "text-gray-500 line-through"
                      : "text-gray-900"
                  }`}
                >
                  {actionItem.text}
                </p>
                {actionItem.status === "pending" && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      onClick={() => setIsEditing(true)}
                      disabled={disabled}
                      variant="ghost"
                      size="sm"
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      }
                    >
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      onClick={onDelete}
                      disabled={disabled}
                      variant="ghost"
                      size="sm"
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      }
                    >
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Date Info */}
              <div className="flex flex-col gap-0.5">
                {actionItem.dueDate ? (
                  <p
                    className={`text-xs flex items-center gap-1 ${
                      isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                    }`}
                  >
                    <svg
                      className="w-3 h-3 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>
                      Due: {String(formatContactDate(actionItem.dueDate, { relative: true }))}
                      {isOverdue ? " (Overdue)" : null}
                    </span>
                  </p>
                ) : null}
                {actionItem.status === "completed" && actionItem.completedAt ? (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <svg
                      className="w-3 h-3 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      Completed: {String(formatContactDate(actionItem.completedAt, { relative: true }))}
                    </span>
                  </p>
                ) : null}
                {actionItem.createdAt && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <svg
                      className="w-3 h-3 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      Created: {String(formatContactDate(actionItem.createdAt, { relative: true }))}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
