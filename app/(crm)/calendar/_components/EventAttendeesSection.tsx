"use client";

import CollapsibleSection from "./CollapsibleSection";

interface EventAttendeesSectionProps {
  attendees: Array<{ email?: string; displayName?: string }>;
  defaultExpanded?: boolean;
}

export default function EventAttendeesSection({
  attendees,
  defaultExpanded = false,
}: EventAttendeesSectionProps) {
  const shouldCollapse = attendees.length > 2;
  const preview = shouldCollapse ? `${attendees.length} attendees` : undefined;

  const attendeesIcon = (
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
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  if (attendees.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Attendees"
      defaultExpanded={!shouldCollapse || defaultExpanded}
      preview={preview}
      icon={attendeesIcon}
    >
      <div className="space-y-2">
        {attendees.map((attendee, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
              {attendee.displayName?.[0] || attendee.email?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              {attendee.displayName && (
                <p className="text-theme-darkest text-sm font-medium truncate">
                  {attendee.displayName}
                </p>
              )}
              {attendee.email && (
                <a
                  href={`mailto:${attendee.email}`}
                  className="text-sm truncate block focus:outline-none"
                  style={{
                    color: 'var(--link)',
                    textDecorationColor: 'var(--divider)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--link-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--link)';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring)';
                    e.currentTarget.style.borderRadius = '0.25rem';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {attendee.email}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

