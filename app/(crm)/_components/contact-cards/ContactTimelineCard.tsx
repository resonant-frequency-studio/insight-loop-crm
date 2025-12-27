"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import { TimelineItem, TimelineItemType } from "@/types/firestore";
import { formatDistanceToNow, format } from "date-fns";
import { DEFAULT_TIMELINE_DAYS, MAX_TIMELINE_DAYS } from "@/lib/timeline/constants";
import { parseDescription, formatLinkPath } from "@/lib/timeline/sanitize-description";
import { groupMeetingsIntoSeries, MeetingSeries } from "@/lib/timeline/group-meetings";

interface ContactTimelineCardProps {
  contactId: string;
  userId: string;
}

type TimelineFilter = "all" | "calendar_event" | "touchpoint" | "action_item" | "email";

// Memoized component for description rendering to avoid re-parsing on every render
const DescriptionContent = React.memo(({ description }: { description: string }) => {
  const parsed = useMemo(() => parseDescription(description), [description]);
  const hasLinks = parsed.links.length > 0;
  
  // Reconstruct text without link placeholders
  const displayText = useMemo(() => {
    let text = parsed.text;
    parsed.links.forEach((_, idx) => {
      text = text.replace(`[LINK_${idx}]`, "");
    });
    return text.trim();
  }, [parsed.text, parsed.links]);
  
  return (
    <div className="mb-2">
      {displayText && (
        <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2 break-words">
          {displayText}
        </p>
      )}
      {hasLinks && (
        <div className="space-y-1 mt-2">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Documents:</p>
          {parsed.links.map((link, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs">
              <span className="text-gray-600 truncate flex-1 min-w-0">
                {link.hostname}
                {link.path && ` ${formatLinkPath(link.path, 40)}`}
              </span>
              <div className="flex gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link.url);
                    } catch (err) {
                      // Silently fail - clipboard errors are usually user permission issues
                    }
                  }}
                  className="px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-xs text-gray-600 hover:bg-gray-100 rounded whitespace-nowrap"
                  title="Copy link"
                >
                  Copy
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-xs text-blue-600 hover:bg-blue-50 rounded whitespace-nowrap"
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

DescriptionContent.displayName = "DescriptionContent";

export default function ContactTimelineCard({
  contactId,
  userId,
}: ContactTimelineCardProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [days, setDays] = useState<number>(DEFAULT_TIMELINE_DAYS);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: timelineItems = [], isLoading } = useQuery({
    queryKey: ["contact-timeline", userId, contactId, days],
    queryFn: async () => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/timeline?limit=30&days=${days}`);
      if (!response.ok) {
        throw new Error("Failed to fetch timeline");
      }
      const data = await response.json();
      return data.timelineItems as TimelineItem[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Memoize grouped items - only recompute when timelineItems changes
  const groupedItems = useMemo(() => {
    return groupMeetingsIntoSeries(timelineItems);
  }, [timelineItems]);
  
  // Memoize filtered items - only recompute when groupedItems or filter changes
  const filteredItems = useMemo(() => {
    if (filter === "all") return groupedItems;
    
    return groupedItems.filter((item) => {
      if ("items" in item) {
        // It's a MeetingSeries - show if filter is "calendar_event"
        return filter === "calendar_event";
      }
      // It's a TimelineItem
      return item.type === filter;
    });
  }, [groupedItems, filter]);

  const getItemIcon = (type: TimelineItemType) => {
    switch (type) {
      case "calendar_event":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "touchpoint":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "action_item":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case "email":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getItemTypeLabel = (type: TimelineItemType) => {
    switch (type) {
      case "calendar_event":
        return "Meeting";
      case "touchpoint":
        return "Touchpoint";
      case "action_item":
        return "Action Item";
      case "email":
        return "Email";
    }
  };

  const formatTimestamp = (timestamp: unknown): string => {
    if (!timestamp) return "";
    
    let date: Date;
    try {
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      } else if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp) {
        date = (timestamp as { toDate: () => Date }).toDate();
      } else if (typeof timestamp === "object" && timestamp !== null && "seconds" in timestamp) {
        // Firestore Timestamp format
        const ts = timestamp as { seconds: number; nanoseconds?: number };
        date = new Date(ts.seconds * 1000);
      } else {
        return "";
      }

      if (isNaN(date.getTime())) return "";
      
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };

  const handleQuickAction = (item: TimelineItem, action: string) => {
    switch (action) {
      case "create-touchpoint":
        // Navigate to contact page with touchpoint date prefilled
        let itemDate: Date;
        if (item.timestamp instanceof Date) {
          itemDate = item.timestamp;
        } else if (typeof item.timestamp === "string") {
          itemDate = new Date(item.timestamp);
        } else if (item.timestamp && typeof item.timestamp === "object" && "toDate" in item.timestamp) {
          itemDate = (item.timestamp as { toDate: () => Date }).toDate();
        } else if (item.timestamp && typeof item.timestamp === "object" && "seconds" in item.timestamp) {
          const ts = item.timestamp as { seconds: number; nanoseconds?: number };
          itemDate = new Date(ts.seconds * 1000);
        } else {
          itemDate = new Date();
        }
        if (isNaN(itemDate.getTime())) {
          itemDate = new Date();
        }
        const dateStr = itemDate.toISOString().split("T")[0];
        router.push(`/contacts/${contactId}?touchpointDate=${dateStr}`);
        break;
      case "view-event":
        if (item.eventId) {
          // Open calendar event modal or navigate to calendar
          router.push(`/calendar?eventId=${item.eventId}`);
        }
        break;
      case "view-email":
        if (item.threadId) {
          // Open email thread (if we have a route for this)
          // TODO: Implement email thread view
        }
        break;
      case "complete-action":
        if (item.actionItemId) {
          // Mark action item as complete
          fetch(`/api/action-items`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              actionItemId: item.actionItemId,
              updates: { status: "completed" },
            }),
          }).then(() => {
            // Refetch timeline
            queryClient.invalidateQueries({ queryKey: ["contact-timeline", userId, contactId] });
          });
        }
        break;
    }
  };

  if (isLoading) {
    return (
      <Card padding="md">
        <Skeleton height="h-96" width="w-full" />
      </Card>
    );
  }

  const handleLoadOlder = () => {
    // Increment by 15 days up to MAX_TIMELINE_DAYS
    const newDays = Math.min(days + 15, MAX_TIMELINE_DAYS);
    setDays(newDays);
  };

  return (
    <Card padding="md">
      <div className="mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-theme-darkest mb-3">Timeline</h2>
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {(["all", "calendar_event", "touchpoint", "action_item", "email"] as TimelineFilter[]).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-2 py-1 sm:px-3 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
                filter === filterType
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filterType === "all" ? "All" : getItemTypeLabel(filterType as TimelineItemType)}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <p className="text-xs sm:text-sm text-theme-dark mb-3">
          View all interactions, meetings, touchpoints, and action items in chronological order.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          {/* Date range selector */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2 py-1 text-xs sm:text-sm rounded-md border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value={15}>Last 15 days</option>
            <option value={30}>Last 30 days</option>
            <option value={45}>Last 45 days</option>
            <option value={60}>Last 60 days</option>
          </select>
          {days < MAX_TIMELINE_DAYS && (
            <button
              onClick={handleLoadOlder}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline text-left sm:text-right"
            >
              Load older activity
            </button>
          )}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No timeline items found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            // Check if this is a MeetingSeries
            if ("items" in item) {
              const series = item as MeetingSeries;
              const lastDate = series.lastOccurrenceDate;
              const lastDateStr = format(lastDate, "MMM d");
              
              // Determine frequency based on occurrence count and time span
              let frequency = "Recurring";
              if (series.items.length >= 2) {
                const dates = series.items.map((i) => {
                  const ts = i.timestamp;
                  if (ts instanceof Date) return ts;
                  if (typeof ts === "string") return new Date(ts);
                  if (ts && typeof ts === "object" && "toDate" in ts) {
                    return (ts as { toDate: () => Date }).toDate();
                  }
                  if (ts && typeof ts === "object" && "seconds" in ts) {
                    return new Date((ts as { seconds: number }).seconds * 1000);
                  }
                  return new Date();
                }).sort((a, b) => a.getTime() - b.getTime());
                
                if (dates.length >= 2) {
                  const timeSpan = dates[dates.length - 1].getTime() - dates[0].getTime();
                  const daysSpan = timeSpan / (1000 * 60 * 60 * 24);
                  const avgDaysBetween = daysSpan / (dates.length - 1);
                  
                  if (avgDaysBetween >= 6 && avgDaysBetween <= 8) {
                    frequency = "Weekly";
                  } else if (avgDaysBetween >= 13 && avgDaysBetween <= 15) {
                    frequency = "Bi-weekly";
                  } else if (avgDaysBetween >= 28 && avgDaysBetween <= 31) {
                    frequency = "Monthly";
                  }
                }
              }
              
              // Get the most recent event
              const mostRecentEvent = series.items[0];
              
              return (
                <div
                  key={series.seriesId}
                  className="flex gap-2 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                            Meeting
                          </span>
                          <span className="text-xs text-gray-400 hidden sm:inline">·</span>
                          <span className="text-xs sm:text-sm font-semibold text-theme-darkest break-words">
                            {series.title}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 sm:px-2 text-[10px] sm:text-xs font-medium rounded bg-purple-100 text-purple-800">
                            Recurring
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 mb-2">
                          <span className="inline-block mr-1">↳</span>
                          <span>{series.occurrenceCount} occurrences</span>
                          {frequency !== "Recurring" && (
                            <>
                              <span className="mx-1">·</span>
                              <span>{frequency}</span>
                            </>
                          )}
                          <span className="mx-1">·</span>
                          <span>Last: {lastDateStr}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-wrap gap-1.5 sm:gap-2">
                        <button
                          onClick={() => {
                            // TODO: Expand series accordion (will implement in next step)
                          }}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap"
                        >
                          View series
                        </button>
                        {mostRecentEvent?.eventId && (
                          <button
                            onClick={() => handleQuickAction(mostRecentEvent, "view-event")}
                            className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap"
                          >
                            View most recent
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Regular timeline item
            let timestamp: Date;
            try {
              if (item.timestamp instanceof Date) {
                timestamp = item.timestamp;
              } else if (typeof item.timestamp === "string") {
                timestamp = new Date(item.timestamp);
              } else if (item.timestamp && typeof item.timestamp === "object") {
                if ("toDate" in item.timestamp) {
                  timestamp = (item.timestamp as { toDate: () => Date }).toDate();
                } else if ("seconds" in item.timestamp) {
                  const ts = item.timestamp as { seconds: number; nanoseconds?: number };
                  timestamp = new Date(ts.seconds * 1000);
                } else {
                  timestamp = new Date();
                }
              } else {
                timestamp = new Date();
              }
              if (isNaN(timestamp.getTime())) {
                timestamp = new Date();
              }
            } catch {
              timestamp = new Date();
            }

            return (
              <div
                key={item.id}
                className="flex gap-2 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                          {getItemTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-theme-darkest mb-1 break-words">{item.title}</h3>
                      {item.description && <DescriptionContent description={item.description} />}
                      {item.type === "calendar_event" && item.location && (
                        <p className="text-xs text-gray-500 mb-2 break-words">
                          📍 {item.location}
                        </p>
                      )}
                      {item.type === "calendar_event" && item.attendees && item.attendees.length > 0 && (
                        <p className="text-xs text-gray-500">
                          👥 {item.attendees.length} attendee{item.attendees.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-wrap gap-1.5 sm:gap-2">
                      {item.type === "calendar_event" && (
                        <button
                          onClick={() => handleQuickAction(item, "view-event")}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap"
                        >
                          View Event
                        </button>
                      )}
                      {item.type === "action_item" && item.status === "pending" && (
                        <button
                          onClick={() => handleQuickAction(item, "complete-action")}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 whitespace-nowrap"
                        >
                          Complete
                        </button>
                      )}
                      {item.type === "email" && (
                        <button
                          onClick={() => handleQuickAction(item, "view-email")}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 whitespace-nowrap"
                        >
                          View Email
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

