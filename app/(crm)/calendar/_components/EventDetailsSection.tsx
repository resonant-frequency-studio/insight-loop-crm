"use client";

import { CalendarEvent } from "@/types/firestore";

interface EventDetailsSectionProps {
  event: CalendarEvent;
  startTime: Date;
  endTime: Date;
}

// Parse date from Firestore timestamp
function parseDate(timestamp: unknown): Date {
  if (timestamp instanceof Date) return timestamp;
  if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (typeof timestamp === "string") {
    return new Date(timestamp);
  }
  return new Date();
}

export default function EventDetailsSection({
  event,
  startTime,
  endTime,
}: EventDetailsSectionProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Check if this is an all-day event
  const startUTC = new Date(startTime.toISOString());
  const endUTC = new Date(endTime.toISOString());
  const startIsMidnightUTC = startUTC.getUTCHours() === 0 && startUTC.getUTCMinutes() === 0 && startUTC.getUTCSeconds() === 0;
  const endIsEndOfDayUTC = endUTC.getUTCHours() === 23 && endUTC.getUTCMinutes() === 59 && endUTC.getUTCSeconds() === 59;
  
  const isAllDay = startIsMidnightUTC && endIsEndOfDayUTC;

  // Extract UTC date components for all-day events
  const startYear = startUTC.getUTCFullYear();
  const startMonth = startUTC.getUTCMonth();
  const startDay = startUTC.getUTCDate();
  const endYear = endUTC.getUTCFullYear();
  const endMonth = endUTC.getUTCMonth();
  const endDay = endUTC.getUTCDate();

  // Check if multi-day all-day event
  const isMultiDayAllDay =
    isAllDay &&
    (startYear !== endYear || startMonth !== endMonth || startDay !== endDay);

  // Display date (use local date for all-day events)
  const displayDate = isAllDay
    ? new Date(startYear, startMonth, startDay, 0, 0, 0, 0)
    : startTime;

  // Google Calendar link
  const googleCalendarLink = event.googleEventId
    ? `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.googleEventId)}`
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-theme-medium mt-0.5 shrink-0"
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
        <div className="min-w-0 flex-1">
          <p className="text-theme-darkest font-medium wrap-break-word">
            {isMultiDayAllDay
              ? `${formatDate(displayDate)} - ${formatDate(new Date(endYear, endMonth, endDay, 0, 0, 0, 0))}`
              : formatDate(displayDate)}
          </p>
          {!isAllDay && (
            <p className="text-theme-dark text-sm wrap-break-word">
              {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          )}
          {isAllDay && (
            <p className="text-theme-dark text-sm">All day</p>
          )}
        </div>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 text-theme-medium mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-theme-dark text-sm wrap-break-word">{event.location}</p>
        </div>
      )}

      {/* Google Calendar link */}
      {googleCalendarLink && (
        <div className="flex items-center gap-2">
          <a
            href={googleCalendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm flex items-center gap-1 focus:outline-none"
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open in Google Calendar
          </a>
        </div>
      )}
    </div>
  );
}

