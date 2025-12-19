"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";
import OverflowMenu from "./OverflowMenu";
import { ConflictData } from "./ConflictResolutionModal";

interface EventModalHeaderProps {
  event: CalendarEvent;
  linkedContact: Contact | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  conflictData?: ConflictData | null;
}

// Parse date from Firestore timestamp
function parseDate(timestamp: unknown): Date | null {
  if (timestamp instanceof Date) return timestamp;
  if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  }
  return null;
}

// Get follow-up status
function getFollowUpStatus(contact: Contact | null): "scheduled" | "none" | "overdue" {
  if (!contact?.nextTouchpointDate) return "none";
  const touchpointDate = parseDate(contact.nextTouchpointDate);
  if (!touchpointDate) return "none";
  const now = new Date();
  if (touchpointDate < now) return "overdue";
  return "scheduled";
}

export default function EventModalHeader({
  event,
  linkedContact,
  onClose,
  onEdit,
  onDelete,
  conflictData,
}: EventModalHeaderProps) {
  const followUpStatus = getFollowUpStatus(linkedContact);
  const syncMetadata = event.lastSyncedAt
    ? formatContactDate(event.lastSyncedAt, { relative: true })
    : null;

  // Get contact name
  const contactName = linkedContact
    ? linkedContact.firstName || linkedContact.lastName
      ? `${linkedContact.firstName || ""} ${linkedContact.lastName || ""}`.trim()
      : linkedContact.primaryEmail
    : null;

  // Get segment and tags from contact or snapshot
  const segment = linkedContact?.segment || event.contactSnapshot?.segment;
  const tags = linkedContact?.tags || event.contactSnapshot?.tags || [];

  // Event title
  const eventTitle = event.title;

  const overflowMenuItems = [
    {
      label: "Edit",
      onClick: onEdit,
      danger: false,
    },
    {
      label: "Delete",
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <div className="flex items-start justify-between mb-4 gap-2 shrink-0">
      <div className="flex-1 min-w-0">
        {/* Title */}
        <h2 className="text-2xl font-bold text-theme-darkest mb-2 wrap-break-word">
          {eventTitle}
        </h2>

        {/* Subtitle with contact info */}
        {contactName && (
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-theme-dark text-sm">with {contactName}</span>
            {segment && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {segment}
              </span>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-theme-dark bg-theme-light px-1.5 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="text-xs text-theme-dark">+{tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status chip and sync metadata */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Follow-up status chip */}
          {followUpStatus === "scheduled" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <span className="w-2 h-2 rounded-full bg-green-600"></span>
              Follow-up scheduled
            </span>
          )}
          {followUpStatus === "none" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-600"></span>
              No follow-up yet
            </span>
          )}
          {followUpStatus === "overdue" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              Follow-up overdue
            </span>
          )}

          {/* Conflict badge */}
          {conflictData && (
            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-md">
              Conflict
            </span>
          )}

          {/* Sync metadata */}
          {syncMetadata && (
            <span className="text-theme-dark text-xs">
              Synced: {syncMetadata}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <OverflowMenu items={overflowMenuItems} />
        <button
          onClick={onClose}
          className="p-1 rounded-sm transition-colors focus:outline-none"
          style={{
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          aria-label="Close event details"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

