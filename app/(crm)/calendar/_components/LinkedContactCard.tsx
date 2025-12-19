"use client";

import { CalendarEvent, Contact } from "@/types/firestore";
import { formatContactDate } from "@/util/contact-utils";
import Link from "next/link";
import { Button } from "@/components/Button";
import Input from "@/components/Input";
import OverflowMenu from "./OverflowMenu";

interface ContactSuggestion {
  contact: Contact;
  reason: string;
}

interface LinkedContactCardProps {
  event: CalendarEvent;
  linkedContact: Contact | null;
  contactSuggestions: ContactSuggestion[];
  onLink: (contactId: string) => void;
  onUnlink: () => void;
  onViewContact: () => void;
  contacts: Contact[];
  showContactSearch: boolean;
  contactSearchQuery: string;
  onToggleSearch: () => void;
  onSearchQueryChange: (query: string) => void;
  isLinking: boolean;
  isLinkedToTouchpoint: boolean;
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

// Calculate days ago
function getDaysAgo(date: Date | null): number | null {
  if (!date) return null;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Get segment color class
function getSegmentColor(segment: string): string {
  const colors: Record<string, string> = {
    "High Potential Prospect": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "Active Client": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Past Client": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[segment] || "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
}

export default function LinkedContactCard({
  event,
  linkedContact,
  contactSuggestions,
  onLink,
  onUnlink,
  onViewContact,
  contacts,
  showContactSearch,
  contactSearchQuery,
  onToggleSearch,
  onSearchQueryChange,
  isLinking,
  isLinkedToTouchpoint,
}: LinkedContactCardProps) {
  // Calculate days since last email
  const lastEmailDate = linkedContact?.lastEmailDate ? parseDate(linkedContact.lastEmailDate) : null;
  const daysSinceLastEmail = getDaysAgo(lastEmailDate);

  // Calculate days since last touchpoint (if exists)
  // Note: We don't have lastTouchpointDate in Contact type, so we'll skip this for now
  // const daysSinceLastTouchpoint = null;

  // Next touchpoint date
  const nextTouchpointDate = linkedContact?.nextTouchpointDate
    ? parseDate(linkedContact.nextTouchpointDate)
    : null;

  // Get segment and tags
  const segment = linkedContact?.segment || event.contactSnapshot?.segment;
  const tags = linkedContact?.tags || event.contactSnapshot?.tags || [];

  // Filter contacts for search
  const filteredContacts = contacts.filter((contact) => {
    if (!contactSearchQuery.trim()) return true;
    const query = contactSearchQuery.toLowerCase();
    const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim().toLowerCase();
    const email = contact.primaryEmail?.toLowerCase() || "";
    return (
      fullName.includes(query) ||
      email.includes(query) ||
      contact.firstName?.toLowerCase().includes(query) ||
      contact.lastName?.toLowerCase().includes(query)
    );
  });

  if (linkedContact) {
    const overflowMenuItems = [
      {
        label: "Unlink",
        onClick: onUnlink,
        danger: true,
      },
    ];

    return (
      <div 
        className="rounded-sm p-4 space-y-3"
        style={{
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-panel)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-theme-darkest font-medium flex items-center gap-2">
            <svg
              className="w-5 h-5 text-theme-medium"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Linked Contact
          </h4>
          <OverflowMenu items={overflowMenuItems} />
        </div>

        {/* Contact Info */}
        <Link
          href={`/contacts/${linkedContact.contactId}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
            {linkedContact.firstName?.[0] || linkedContact.lastName?.[0] || linkedContact.primaryEmail[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-theme-darkest font-medium">
                {linkedContact.firstName || linkedContact.lastName
                  ? `${linkedContact.firstName || ""} ${linkedContact.lastName || ""}`.trim()
                  : linkedContact.primaryEmail}
              </p>
              {isLinkedToTouchpoint && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-md">
                  Touchpoint
                </span>
              )}
            </div>
            <p className="text-theme-dark text-sm">{linkedContact.primaryEmail}</p>
          </div>
        </Link>

        {/* Segment and Tags */}
        {(segment || tags.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {segment && (
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${getSegmentColor(segment)}`}>
                {segment}
              </span>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="text-xs text-theme-dark bg-theme-light px-1.5 py-0.5 rounded">
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

        {/* Engagement Score */}
        {linkedContact.engagementScore !== null && linkedContact.engagementScore !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-theme-dark text-sm">Engagement:</span>
            <div className="flex-1 bg-theme-light rounded-full h-2 max-w-32">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, linkedContact.engagementScore)}%` }}
              />
            </div>
            <span className="text-theme-dark text-sm">{linkedContact.engagementScore}</span>
          </div>
        )}

        {/* Last Email */}
        {daysSinceLastEmail !== null && (
          <p className="text-theme-dark text-sm">
            Last email: {daysSinceLastEmail === 0 ? "today" : `${daysSinceLastEmail} day${daysSinceLastEmail !== 1 ? "s" : ""} ago`}
          </p>
        )}

        {/* Next Touchpoint */}
        {nextTouchpointDate && (
          <p className="text-theme-dark text-sm">
            Next touchpoint: {formatContactDate(nextTouchpointDate)}
          </p>
        )}

      </div>
    );
  }

  // Unlinked state
  return (
    <div 
      className="rounded-sm p-4 space-y-3"
      style={{
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--surface-panel)',
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-theme-darkest font-medium flex items-center gap-2">
          <svg
            className="w-5 h-5 text-theme-medium"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          Link Contact
        </h4>
      </div>

      {/* Suggested Contacts */}
      {contactSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-theme-dark text-sm font-medium">Suggested contacts:</p>
          {contactSuggestions.map((suggestion) => (
            <div
              key={suggestion.contact.contactId}
              className="flex items-center justify-between p-2 rounded-sm transition-colors"
              style={{
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Link
                href={`/contacts/${suggestion.contact.contactId}`}
                className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
              >
                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {suggestion.contact.firstName?.[0] || suggestion.contact.lastName?.[0] || suggestion.contact.primaryEmail[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-theme-darkest text-sm font-medium truncate">
                    {suggestion.contact.firstName || suggestion.contact.lastName
                      ? `${suggestion.contact.firstName || ""} ${suggestion.contact.lastName || ""}`.trim()
                      : suggestion.contact.primaryEmail}
                  </p>
                  <p className="text-theme-dark text-xs truncate">{suggestion.contact.primaryEmail}</p>
                </div>
                <span className="text-xs text-theme-dark shrink-0 ml-2">
                  {suggestion.reason === "Email match" ? `Matched by attendee email: ${suggestion.contact.primaryEmail}` : suggestion.reason}
                </span>
              </Link>
              <Button
                onClick={() => onLink(suggestion.contact.contactId)}
                disabled={isLinking}
                variant="outline"
                size="sm"
                className="ml-2 shrink-0"
              >
                Link
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        {!showContactSearch ? (
          <Button
            onClick={onToggleSearch}
            variant="outline"
            size="sm"
            fullWidth
          >
            {contactSuggestions.length > 0 ? "Search for Different Contact" : "Search for Contact"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={contactSearchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full"
            />
            <div 
              className="max-h-48 overflow-y-auto space-y-1 rounded-sm p-2"
              style={{
                border: '1px solid var(--border-subtle)',
              }}
            >
              {filteredContacts.slice(0, 10).map((contact) => (
                <div
                  key={contact.contactId}
                  className="flex items-center justify-between p-2 rounded-sm transition-colors cursor-pointer"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => onLink(contact.contactId)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
                      {contact.firstName?.[0] || contact.lastName?.[0] || contact.primaryEmail[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-theme-darkest text-sm font-medium truncate">
                        {contact.firstName || contact.lastName
                          ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
                          : contact.primaryEmail}
                      </p>
                      <p className="text-theme-dark text-xs truncate">{contact.primaryEmail}</p>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLink(contact.contactId);
                    }}
                    disabled={isLinking}
                    variant="outline"
                    size="sm"
                    className="ml-2 shrink-0"
                  >
                    Link
                  </Button>
                </div>
              ))}
              {filteredContacts.length === 0 && (
                <p className="text-theme-dark text-sm text-center py-2">No contacts found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {contactSuggestions.length === 0 && !showContactSearch && (
        <p className="text-theme-dark text-sm">No contact linked. No suggestions available.</p>
      )}
    </div>
  );
}

