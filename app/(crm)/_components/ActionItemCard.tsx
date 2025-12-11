"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionItem, Contact } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";
import { getInitials, getDisplayName } from "@/util/contact-utils";
import { Button } from "@/components/Button";
import ActionItemCheckbox from "@/components/ActionItemCheckbox";
import Textarea from "@/components/Textarea";
import Input from "@/components/Input";

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
  // Pre-computed values (optional for backward compatibility)
  isOverdue?: boolean;
  displayName?: string | null; // null when contact not found (show skeleton)
  initials?: string;
  contactLoading?: boolean; // true when contacts are still loading
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
  isOverdue: preComputedIsOverdue,
  displayName: preComputedDisplayName,
  initials: preComputedInitials,
  contactLoading = false,
}: ActionItemCardProps) {
  // Use pre-computed values if provided, otherwise compute on client (for backward compatibility)
  const isOverdue =
    preComputedIsOverdue !== undefined
      ? preComputedIsOverdue
      : actionItem.status === "pending" &&
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

  // Use pre-computed values if provided, otherwise compute on client
  const displayName =
    preComputedDisplayName !== undefined
      ? preComputedDisplayName
      : contactName ||
        (() => {
          const contactForUtils: Contact = {
            contactId: contactId,
            firstName: contactFirstName,
            lastName: contactLastName,
            primaryEmail: contactEmail || "",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return getDisplayName(contactForUtils);
        })();

  const initials =
    preComputedInitials !== undefined
      ? preComputedInitials
      : (() => {
          const contactForUtils: Contact = {
            contactId: contactId,
            firstName: contactFirstName,
            lastName: contactLastName,
            primaryEmail: contactEmail || "",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return getInitials(contactForUtils);
        })();

  const email = contactEmail || "";

  const getVariantStyles = () => {
    if (actionItem.status === "completed") {
      return "bg-card-highlight-light border border-gray-200";
    }
    if (isOverdue) {
      return "bg-card-overdue border border-card-overdue-dark";
    }
    return "bg-transparent border border-gray-200";
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
    <div className={`rounded-md p-3 sm:p-4 transition-all duration-200 min-w-0 overflow-hidden ${getVariantStyles()}`}>
      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            id={`action-item-edit-text-${actionItem.actionItemId}`}
            name={`action-item-edit-text-${actionItem.actionItemId}`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="px-3 py-2"
            rows={2}
            disabled={disabled}
          />
          <Input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="px-3 py-2"
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
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
          {/* Top Row: Checkbox with label, Edit, Delete */}
          <div className="flex items-center gap-2">
            {/* Checkbox with label */}
            <ActionItemCheckbox
              checked={actionItem.status === "completed"}
              onChange={onComplete}
              disabled={disabled}
            />

            {/* Action Buttons - Edit and Delete */}
            {actionItem.status === "pending" && (
              <div className="flex gap-1 shrink-0 ml-auto">
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

          {/* Contact Info Section - Only show if not in compact mode, on its own row */}
          {!compact && (
            <Link
              href={`/contacts/${contactId}`}
              className="flex items-center gap-2 group border border-gray-300 rounded-md px-3 py-2 hover:border-gray-400 transition-colors"
            >
              {/* Avatar */}
              <div className="shrink-0">
                <div className={`w-8 h-8 ${getAvatarStyles()} rounded-full flex items-center justify-center text-white font-semibold text-xs shadow-sm`}>
                  {initials}
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                {contactLoading || displayName === null ? (
                  <div className="h-[38px] bg-gray-200 rounded w-24 animate-pulse" />
                ) : (
                  <>
                    <h3 className={`text-sm font-semibold group-hover:text-theme-darker transition-colors truncate ${
                      actionItem.status === "completed" ? "text-gray-500" : "text-theme-darkest"
                    }`}>
                      {displayName || ""}
                    </h3>
                    {email && (
                      <p className={`text-xs truncate mt-0.5 ${
                        actionItem.status === "completed" ? "text-gray-400" : "text-gray-500"
                      }`}>
                        {email}
                      </p>
                    )}
                  </>
                )}
              </div>
            </Link>
          )}

          {/* Bottom Row: Action Item Text */}
          <div className="min-w-0">
            <p
              className={`text-sm font-medium wrap-break-word mb-2 ${
                actionItem.status === "completed"
                  ? "text-gray-500 line-through"
                  : "text-theme-darkest"
              }`}
            >
              {actionItem.text}
            </p>

              {/* Date Info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {actionItem.status === "pending" && actionItem.dueDate ? (
                  <p className={`text-xs flex items-center gap-1 ${
                    isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                  }`}>
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
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
                      Due: {formatContactDate(actionItem.dueDate, { relative: true })}
                      {isOverdue ? " (Overdue)" : null}
                    </span>
                  </p>
                ) : null}
                {actionItem.status === "completed" && actionItem.completedAt ? (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
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
                      Completed: {formatContactDate(actionItem.completedAt, { relative: true })}
                    </span>
                  </p>
                ) : null}
                {actionItem.createdAt != null && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
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
                      Created: {formatContactDate(actionItem.createdAt, { relative: true })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
