"use client";

import Link from "next/link";
import { Contact } from "@/types/firestore";
import { getInitials, getDisplayName, formatContactDate } from "@/util/contact-utils";
import TouchpointStatusActions from "@/components/TouchpointStatusActions";

interface ContactWithId extends Contact {
  id: string;
}

interface ContactCardProps {
  contact: ContactWithId;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelectChange?: (contactId: string) => void;
  variant?: "default" | "selected" | "touchpoint-upcoming" | "touchpoint-overdue";
  showArrow?: boolean;
  // Touchpoint-specific props
  touchpointDate?: Date | null;
  daysUntil?: number | null;
  needsReminder?: boolean;
  showTouchpointActions?: boolean;
  onTouchpointStatusUpdate?: () => void;
}

export default function ContactCard({
  contact,
  showCheckbox = false,
  isSelected = false,
  onSelectChange,
  variant = "default",
  showArrow = true,
  touchpointDate,
  daysUntil,
  needsReminder = false,
  showTouchpointActions = false,
  onTouchpointStatusUpdate,
}: ContactCardProps) {
  const isTouchpointVariant = variant === "touchpoint-upcoming" || variant === "touchpoint-overdue";
  
  const getVariantStyles = () => {
    if (isSelected) return "ring-2 ring-blue-500 bg-blue-50";
    
    switch (variant) {
      case "selected":
        return "ring-2 ring-blue-500 bg-blue-50";
      case "touchpoint-upcoming":
        return needsReminder ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200";
      case "touchpoint-overdue":
        return "bg-red-50 border border-red-200";
      default:
        return "bg-gray-50 border border-gray-200";
    }
  };

  const getAvatarStyles = () => {
    switch (variant) {
      case "touchpoint-overdue":
        return "bg-linear-to-br from-red-600 to-red-700";
      case "touchpoint-upcoming":
        return "bg-linear-to-br from-gray-600 to-gray-700";
      default:
        return "bg-linear-to-br from-blue-500 to-purple-600";
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "touchpoint-overdue":
        return "text-red-900";
      case "touchpoint-upcoming":
        return "text-gray-900";
      default:
        return "text-gray-900";
    }
  };

  const getEmailColor = () => {
    switch (variant) {
      case "touchpoint-overdue":
        return "text-red-600";
      case "touchpoint-upcoming":
        return "text-gray-600";
      default:
        return "text-gray-500";
    }
  };

  const formatTouchpointDate = () => {
    if (!touchpointDate || daysUntil === null || daysUntil === undefined) return null;
    
    if (variant === "touchpoint-overdue") {
      return daysUntil < 0 ? `Overdue ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? "s" : ""}` : "Overdue";
    }
    
    if (daysUntil === 0) return "Today";
    if (daysUntil === 1) return "Tomorrow";
    return formatContactDate(touchpointDate, { relative: true });
  };

  return (
    <div
      className={`rounded-lg p-4 transition-all duration-200 ${
        isSelected ? "ring-2 ring-blue-500 bg-blue-50" : getVariantStyles()
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {showCheckbox && (
          <label className="flex items-center pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelectChange?.(contact.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </label>
        )}

        {/* Contact Card Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/contacts/${contact.id}`}
            className="block group"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="shrink-0">
                <div className={`w-10 h-10 ${getAvatarStyles()} rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
                  {getInitials(contact)}
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className={`text-sm font-semibold group-hover:text-gray-700 transition-colors ${getTextColor()}`}>
                    {getDisplayName(contact)}
                  </h3>
                  {/* Touchpoint Date Badges */}
                  {isTouchpointVariant && (
                    <div className="flex items-center gap-2 shrink-0">
                      {variant === "touchpoint-upcoming" && needsReminder && (
                        <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-md">
                          Due Soon
                        </span>
                      )}
                      {variant === "touchpoint-overdue" && (
                        <span className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-md">
                          Overdue
                        </span>
                      )}
                      {formatTouchpointDate() && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${
                          variant === "touchpoint-overdue"
                            ? "text-red-700 bg-red-100"
                            : daysUntil !== null && daysUntil !== undefined && daysUntil <= 3
                            ? "text-amber-700 bg-amber-100"
                            : "text-gray-700 bg-gray-200"
                        }`}>
                          {formatTouchpointDate()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className={`text-xs truncate mb-2 ${getEmailColor()}`}>
                  {contact.primaryEmail}
                </p>

                {/* Date Info - Only show for non-touchpoint variants */}
                {!isTouchpointVariant && (
                  <div className="flex flex-col gap-0.5 mb-2">
                    {contact.lastEmailDate != null && (
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate">Last email: {formatContactDate(contact.lastEmailDate, { relative: true })}</span>
                      </p>
                    )}
                    {contact.updatedAt != null && (
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
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        <span className="truncate">Updated: {formatContactDate(contact.updatedAt, { relative: true })}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Segment and Tags - Mobile: show below */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 lg:hidden">
                  {contact.segment && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {contact.segment}
                    </span>
                  )}
                  {/* Only show tags for non-touchpoint variants */}
                  {!isTouchpointVariant && contact.tags && contact.tags.length > 0 && (
                    <>
                      {contact.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-xs font-medium text-gray-500">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Segment and Tags - Desktop: show on right */}
              <div className={`hidden lg:flex ${isTouchpointVariant ? 'items-center' : 'flex-col items-end'} gap-2 shrink-0 ${isTouchpointVariant ? 'ml-2' : 'max-w-[250px]'}`}>
                {contact.segment && (
                  <span className={`px-2 ${isTouchpointVariant ? 'py-1' : 'py-1'} text-xs font-medium bg-gray-100 text-gray-700 rounded whitespace-nowrap`}>
                    {contact.segment}
                  </span>
                )}
                {/* Only show tags for non-touchpoint variants */}
                {!isTouchpointVariant && contact.tags && contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {contact.tags.slice(0, 2).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                    {contact.tags.length > 2 && (
                      <span className="px-2 py-1 text-xs font-medium text-gray-500">
                        +{contact.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow Icon - Desktop only (only for non-touchpoint variants) */}
              {showArrow && !isTouchpointVariant && (
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
              )}
            </div>
          </Link>

          {/* Touchpoint Message - Outside Link to span full width */}
          {isTouchpointVariant && contact.nextTouchpointMessage && (
            <div className="w-full mt-2 mb-3">
              <p className={`text-xs rounded px-2 py-1.5 line-clamp-2 w-full block ${
                variant === "touchpoint-overdue"
                  ? "text-red-900 bg-red-100"
                  : needsReminder
                  ? "text-amber-900 bg-amber-100"
                  : "text-gray-900 bg-gray-100"
              }`}>
                {contact.nextTouchpointMessage}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Touchpoint Status Actions */}
      {showTouchpointActions && (
        <div className={`pt-3 border-t ${
          variant === "touchpoint-overdue"
            ? "border-red-200"
            : needsReminder
            ? "border-amber-200"
            : "border-gray-200"
        }`}>
          <TouchpointStatusActions
            contactId={contact.id}
            contactName={getDisplayName(contact)}
            currentStatus={contact.touchpointStatus}
            compact={true}
            onStatusUpdate={onTouchpointStatusUpdate}
          />
        </div>
      )}
    </div>
  );
}

