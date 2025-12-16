"use client";

import { CalendarEvent } from "@/types/firestore";
import { useMemo } from "react";

interface CalendarEventCardProps {
  event: CalendarEvent;
  onClose: () => void;
}

export default function CalendarEventCard({ event, onClose }: CalendarEventCardProps) {
  // Convert Firestore timestamp to Date
  const getDate = (timestamp: unknown): Date => {
    if (timestamp instanceof Date) return timestamp;
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    if (typeof timestamp === "string") {
      return new Date(timestamp);
    }
    return new Date();
  };

  const startTime = getDate(event.startTime);
  const endTime = getDate(event.endTime);

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
  // All-day events are stored in UTC at midnight (00:00:00 UTC) for start
  // and 23:59:59.999 UTC for end (even for multi-day events)
  const startUTC = new Date(startTime.toISOString());
  const endUTC = new Date(endTime.toISOString());
  const startIsMidnightUTC = startUTC.getUTCHours() === 0 && startUTC.getUTCMinutes() === 0 && startUTC.getUTCSeconds() === 0;
  const endIsEndOfDayUTC = endUTC.getUTCHours() === 23 && endUTC.getUTCMinutes() === 59 && endUTC.getUTCSeconds() === 59;
  
  // Extract UTC date components (year, month, day) - these are the actual dates
  const startYear = startUTC.getUTCFullYear();
  const startMonth = startUTC.getUTCMonth();
  const startDay = startUTC.getUTCDate();
  const endYear = endUTC.getUTCFullYear();
  const endMonth = endUTC.getUTCMonth();
  const endDay = endUTC.getUTCDate();
  
  // If start is midnight UTC and end is end of day UTC, it's an all-day event
  const isAllDay = startIsMidnightUTC && endIsEndOfDayUTC;

  // For all-day events, use UTC date components to create display date in local timezone
  // This preserves the correct date without timezone shifts
  const displayDate = isAllDay 
    ? new Date(startYear, startMonth, startDay, 0, 0, 0, 0)
    : startTime;
  
  // For multi-day all-day events, show the date range
  const isMultiDayAllDay = isAllDay && (startYear !== endYear || startMonth !== endMonth || startDay !== endDay);

  // Parse description to convert URLs to links and handle HTML content
  const parseDescription = useMemo(() => {
    if (!event.description) return null;

    const description = event.description;

    // Check if description contains HTML
    const hasHTML = /<[a-z][\s\S]*>/i.test(description);

    if (hasHTML) {
      // Process HTML content: ensure all links have target="_blank" and rel="noopener noreferrer"
      let processedHTML = description;

      // Update existing <a> tags to ensure they open in new tabs
      processedHTML = processedHTML.replace(
        /<a\s+([^>]*?)>/gi,
        (match, attributes) => {
          // Check if target and rel are already present
          const hasTarget = /target\s*=/i.test(attributes);
          const hasRel = /rel\s*=/i.test(attributes);

          let newAttributes = attributes;

          if (!hasTarget) {
            newAttributes += ' target="_blank"';
          } else {
            newAttributes = newAttributes.replace(
              /target\s*=\s*["']?([^"'\s>]+)["']?/gi,
              'target="_blank"'
            );
          }

          if (!hasRel) {
            newAttributes += ' rel="noopener noreferrer"';
          } else {
            newAttributes = newAttributes.replace(
              /rel\s*=\s*["']?([^"'\s>]+)["']?/gi,
              (relMatch, relValue) => {
                const relParts = relValue.split(/\s+/);
                if (!relParts.includes('noopener')) relParts.push('noopener');
                if (!relParts.includes('noreferrer')) relParts.push('noreferrer');
                return `rel="${relParts.join(' ')}"`;
              }
            );
          }

          // Add styling class if not present
          if (!/class\s*=/i.test(newAttributes)) {
            newAttributes += ' class="text-blue-600 dark:text-blue-400 underline break-all"';
          } else {
            // Add break-all class to existing class
            newAttributes = newAttributes.replace(
              /class\s*=\s*["']([^"']+)["']/gi,
              (classMatch, classValue) => {
                const classes = classValue.split(/\s+/);
                if (!classes.includes('break-all')) classes.push('break-all');
                if (!classes.includes('underline')) classes.push('underline');
                return `class="${classes.join(' ')}"`;
              }
            );
          }

          return `<a ${newAttributes}>`;
        }
      );

      // Also find plain text URLs that are not already inside <a> tags and convert them to links
      // We need to process text nodes that are outside of HTML tags
      // Strategy: split by HTML tags, process text parts, then reassemble
      const htmlTagRegex = /<[^>]+>/g;
      const parts: Array<{ text: string; isHTML: boolean }> = [];
      let lastIndex = 0;
      let tagMatch;

      while ((tagMatch = htmlTagRegex.exec(processedHTML)) !== null) {
        // Add text before tag
        if (tagMatch.index > lastIndex) {
          const textBefore = processedHTML.substring(lastIndex, tagMatch.index);
          if (textBefore.trim()) {
            parts.push({ text: textBefore, isHTML: false });
          }
        }
        // Add HTML tag
        parts.push({ text: tagMatch[0], isHTML: true });
        lastIndex = tagMatch.index + tagMatch[0].length;
      }

      // Add remaining text
      if (lastIndex < processedHTML.length) {
        const textAfter = processedHTML.substring(lastIndex);
        if (textAfter.trim()) {
          parts.push({ text: textAfter, isHTML: false });
        }
      }

      // Process text parts to convert URLs to links
      const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
      const finalParts: string[] = [];

      parts.forEach((part) => {
        if (part.isHTML) {
          finalParts.push(part.text);
        } else {
          // Convert URLs in text to HTML links
          const text = part.text;
          const urlMatches: Array<{ index: number; url: string }> = [];

          // Collect all URL matches (reset regex for each text part)
          const textUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;
          let urlMatch;
          while ((urlMatch = textUrlRegex.exec(text)) !== null) {
            urlMatches.push({
              index: urlMatch.index,
              url: urlMatch[0],
            });
          }

          // Build HTML string with URLs converted to links
          let processedText = '';
          let currentIndex = 0;

          urlMatches.forEach((urlMatch) => {
            // Add text before URL
            processedText += text.substring(currentIndex, urlMatch.index);
            // Add link for URL
            processedText += `<a href="${urlMatch.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline break-all" style="word-break: break-all;">${urlMatch.url}</a>`;
            currentIndex = urlMatch.index + urlMatch.url.length;
          });

          // Add remaining text
          processedText += text.substring(currentIndex);
          finalParts.push(processedText);
        }
      });

      return { __html: finalParts.join('') };
    } else {
      // Plain text - convert URLs to links
      const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      let match;
      let keyCounter = 0;

      while ((match = urlRegex.exec(description)) !== null) {
        // Add text before URL
        if (match.index > lastIndex) {
          parts.push(description.substring(lastIndex, match.index));
        }

        // Add link for URL
        const url = match[0];
        parts.push(
          <a
            key={`url-${keyCounter++}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline break-all"
            style={{ wordBreak: 'break-all' }}
          >
            {url}
          </a>
        );

        lastIndex = match.index + url.length;
      }

      // Add remaining text
      if (lastIndex < description.length) {
        parts.push(description.substring(lastIndex));
      }

      return parts.length > 0 ? parts : description;
    }
  }, [event.description]);

  return (
    <div className="w-full max-w-full overflow-hidden calendar-event-card flex flex-col">
      <div className="flex items-start justify-between mb-6 gap-2 flex-shrink-0 relative">
        <h2 className="text-2xl font-bold text-theme-darkest flex-shrink-0">Event Details</h2>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-sm hover:bg-theme-light transition-colors text-theme-medium hover:text-theme-darkest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

      <div className="space-y-4 min-w-0 flex-1 overflow-y-auto">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-theme-darkest mb-2 break-words overflow-wrap-anywhere word-break-break-word">
            {event.title}
          </h3>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <svg
              className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
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
              <p className="text-theme-darkest font-medium break-words">
                {isMultiDayAllDay 
                  ? `${formatDate(displayDate)} - ${formatDate(new Date(endYear, endMonth, endDay, 0, 0, 0, 0))}`
                  : formatDate(displayDate)
                }
              </p>
              {!isAllDay && (
                <p className="text-theme-dark text-sm break-words">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </p>
              )}
              {isAllDay && (
                <p className="text-theme-dark text-sm">
                  {isMultiDayAllDay ? "All day (multi-day)" : "All day"}
                </p>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
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
              <p className="text-theme-darkest break-words overflow-wrap-anywhere word-break-break-word min-w-0 flex-1">{event.location}</p>
            </div>
          )}

          {event.description && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
              <div className="min-w-0 flex-1">
                {parseDescription && typeof parseDescription === 'object' && '__html' in parseDescription ? (
                  <div
                    className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={parseDescription}
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  />
                ) : parseDescription ? (
                  <p className="text-theme-darkest whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word">
                    {Array.isArray(parseDescription) ? (
                      parseDescription.map((part, index) => (
                        <span key={index}>{part}</span>
                      ))
                    ) : (
                      parseDescription
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-2 min-w-0">
              <svg
                className="w-5 h-5 text-theme-medium mt-0.5 flex-shrink-0"
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
              <div className="min-w-0 flex-1">
                <p className="text-theme-darkest font-medium mb-1">Attendees</p>
                <ul className="space-y-1">
                  {event.attendees.map((attendee, index) => (
                    <li key={index} className="text-theme-dark text-sm break-words overflow-wrap-anywhere">
                      {attendee.displayName || attendee.email}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

