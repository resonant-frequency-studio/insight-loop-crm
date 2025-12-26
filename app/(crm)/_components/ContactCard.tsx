"use client";

import Link from "next/link";
import { Contact } from "@/types/firestore";
import { getDisplayName, formatContactDate } from "@/util/contact-utils";
import TouchpointStatusActions from "./TouchpointStatusActions";
import QuickTag from "./QuickTag";
import ContactMenuDropdown from "./ContactMenuDropdown";
import Avatar from "@/components/Avatar";
import { isOwnerContact } from "@/lib/contacts/owner-utils";
import { useAuth } from "@/hooks/useAuth";

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
  userId?: string; // For TouchpointStatusActions to read from React Query
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
  userId,
}: ContactCardProps) {
  const isTouchpointVariant = variant === "touchpoint-upcoming" || variant === "touchpoint-overdue";
  const { user } = useAuth();
  const isCurrentUserOwner = isOwnerContact(user?.email || null, contact.primaryEmail);
  
  const getVariantStyles = () => {
    if (isSelected) return "ring-2 ring-blue-500 bg-card-active";
    
    switch (variant) {
      case "selected":
        return "ring-2 ring-blue-500 bg-card-active";
      case "touchpoint-upcoming":
        return needsReminder ? "bg-card-upcoming border border-card-upcoming-dark" : "border border-theme-light";
      case "touchpoint-overdue":
        return "bg-card-overdue border border-card-overdue-dark";
      default:
        return "border border-theme-light";
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
      className={`rounded-sm p-4 transition-all duration-200 ${getVariantStyles()} relative`}
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
        <div className="flex-1 min-w-0 flex items-start xl:items-stretch gap-3">
          {/* Left Column - Clickable Link Area */}
          <Link
            href={`/contacts/${contact.id}`}
            className="flex items-start gap-3 flex-1 min-w-0 xl:flex-[1_1_60%] xl:max-w-[60%] group"
          >
            {/* Avatar */}
            <div className="shrink-0">
              <Avatar contact={contact} size="md" />
            </div>

            {/* Contact Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col xxl:flex-row items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <h3 className={`text-sm font-semibold group-hover:text-theme-darker transition-colors text-theme-darkest wrap-break-word`}>
                    {getDisplayName(contact)}
                  </h3>
                  {isCurrentUserOwner && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-sm whitespace-nowrap border-2 text-card-tag-text border-card-tag">
                      Owner
                    </span>
                  )}
                  {contact.company && (
                    <p className="text-xs text-theme-dark mt-0.5 wrap-break-word">
                      {contact.company}
                    </p>
                  )}
                </div>
                {/* Touchpoint Date Badges */}
                {isTouchpointVariant && (
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
                    {variant === "touchpoint-upcoming" && needsReminder && (
                      <span className="px-2 py-1 text-xs font-medium text-theme-darker border border-theme-medium rounded-sm whitespace-nowrap">
                        Due Soon
                      </span>
                    )}
                    {variant === "touchpoint-overdue" && (
                      <span className="px-2 py-1 text-xs font-medium text-theme-darker border border-theme-medium rounded-sm whitespace-nowrap">
                        Overdue
                      </span>
                    )}
                    {formatTouchpointDate() && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-sm whitespace-nowrap ${
                        variant === "touchpoint-overdue"
                          ? "text-theme-darker border border-theme-medium"
                          : daysUntil !== null && daysUntil !== undefined && daysUntil <= 3
                          ? "text-theme-darker border border-theme-medium"
                          : "text-theme-darker border border-theme-medium"
                      }`}>
                        {formatTouchpointDate()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className={`text-xs truncate mb-2 text-theme-dark`}>
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
              {!isTouchpointVariant && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 xl:hidden">
                  {contact.segment && (
                    <span className="px-2 py-1 text-xs font-medium text-theme-darkest rounded whitespace-nowrap border border-theme-dark">
                      {contact.segment}
                    </span>
                  )}
                  {/* Only show tags for non-touchpoint variants */}
                  {contact.tags && contact.tags.length > 0 && (
                    <>
                      {contact.tags.slice(0, 3).map((tag, idx) => {
                        const isOwnerTag = tag === "Owner";
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-1 text-xs font-medium border rounded-sm ${
                              isOwnerTag
                                ? "bg-chip-blue-bg border-sync-blue-border text-chip-blue-text font-semibold"
                                : "border-card-tag"
                            }`}
                            style={!isOwnerTag ? { color: 'var(--foreground)' } : undefined}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      {contact.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs font-medium text-theme-dark">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Arrow Icon - Desktop only (only for non-touchpoint variants) */}
            {showArrow && !isTouchpointVariant && (
              <div className="hidden xl:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
          </Link>

          {/* Vertical Divider - Desktop only */}
          <div className="hidden xl:flex items-stretch shrink-0 px-2">
            <div className="w-px bg-theme-light/30 my-2" />
          </div>

          {/* Right Column - Menu (Top Right), Segment and Tags (Bottom Right) - Desktop only - Outside Link */}
          <div className="hidden xl:flex flex-col items-end gap-2 shrink-0 ml-auto">
            {/* Menu Dropdown - Top Right (only for non-touchpoint variants) */}
            {!isTouchpointVariant && (
              <div className="z-10">
                <ContactMenuDropdown contact={contact} />
              </div>
            )}
            
            {/* Segment and Tags - Bottom Right */}
            <div className={`flex ${isTouchpointVariant ? 'items-center' : 'flex-col items-end'} gap-2`}>
              {contact.segment && (
                <span className={`px-2 py-1 text-xs font-medium text-theme-darkest rounded whitespace-nowrap border border-theme-dark`}>
                  {contact.segment}
                </span>
              )}
              {/* Only show tags for non-touchpoint variants */}
              {!isTouchpointVariant && (
                <div className="flex flex-wrap gap-1 justify-end items-center">
                  {/* Quick Tag component - appears directly left of existing tags */}
                  {userId && (
                    <QuickTag
                      contactId={contact.id}
                      userId={userId}
                      existingTags={contact.tags}
                    />
                  )}
                  {/* Existing tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <>
                      {contact.tags.slice(0, 2).map((tag, idx) => {
                        const isOwnerTag = tag === "Owner";
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-1 text-xs font-medium border rounded-sm ${
                              isOwnerTag
                                ? "bg-chip-blue-bg border-sync-blue-border text-chip-blue-text font-semibold"
                                : "border-card-tag"
                            }`}
                            style={!isOwnerTag ? { color: 'var(--foreground)' } : undefined}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      {contact.tags.length > 2 && (
                        <span className="px-2 py-1 text-xs font-medium text-theme-dark">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Menu Dropdown - Top Right for Mobile (only for non-touchpoint variants) */}
      {!isTouchpointVariant && (
        <div className="xl:hidden absolute top-3 right-3 z-10">
          <ContactMenuDropdown contact={contact} />
        </div>
      )}

      {/* Touchpoint Message - Outside Link to span full width */}
      {isTouchpointVariant && contact.nextTouchpointMessage && (
        <div className="mt-2 mb-3">
          <p className={`text-xs sm:text-sm rounded px-2.5 sm:px-3 py-2 sm:py-1.5 line-clamp-2 sm:line-clamp-none w-full block wrap-break-word`}>
            {contact.nextTouchpointMessage}
          </p>
        </div>
      )}

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
            userId={userId || ""}
            currentStatus={contact.touchpointStatus}
            compact={true}
            onStatusUpdate={onTouchpointStatusUpdate}
          />
        </div>
      )}
    </div>
  );
}

