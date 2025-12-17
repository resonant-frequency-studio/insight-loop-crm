"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import { TimelineItem, TimelineItemType } from "@/types/firestore";
import { formatDistanceToNow } from "date-fns";

interface ContactTimelineCardProps {
  contactId: string;
  userId: string;
}

type TimelineFilter = "all" | "calendar_event" | "touchpoint" | "action_item" | "email";

export default function ContactTimelineCard({
  contactId,
  userId,
}: ContactTimelineCardProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: timelineItems = [], isLoading } = useQuery({
    queryKey: ["contact-timeline", userId, contactId],
    queryFn: async () => {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}/timeline?limit=50`);
      if (!response.ok) {
        throw new Error("Failed to fetch timeline");
      }
      const data = await response.json();
      return data.timelineItems as TimelineItem[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Filter timeline items based on selected filter
  const filteredItems = filter === "all"
    ? timelineItems
    : timelineItems.filter((item) => item.type === filter);

  const getItemIcon = (type: TimelineItemType) => {
    switch (type) {
      case "calendar_event":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "touchpoint":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "action_item":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case "email":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          // For now, just log
          console.log("View email thread:", item.threadId);
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

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-theme-darkest">Timeline</h2>
        <div className="flex gap-2">
          {(["all", "calendar_event", "touchpoint", "action_item", "email"] as TimelineFilter[]).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
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
      <p className="text-sm text-theme-dark mb-6">
        View all interactions, meetings, touchpoints, and action items in chronological order.
      </p>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No timeline items found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
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
                className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {getItemTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(item.timestamp)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-theme-darkest mb-1">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {item.type === "calendar_event" && item.location && (
                        <p className="text-xs text-gray-500 mb-2">
                          📍 {item.location}
                        </p>
                      )}
                      {item.type === "calendar_event" && item.attendees && item.attendees.length > 0 && (
                        <p className="text-xs text-gray-500">
                          👥 {item.attendees.length} attendee{item.attendees.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex gap-2">
                      {item.type === "calendar_event" && (
                        <button
                          onClick={() => handleQuickAction(item, "view-event")}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          View Event
                        </button>
                      )}
                      {item.type === "action_item" && item.status === "pending" && (
                        <button
                          onClick={() => handleQuickAction(item, "complete-action")}
                          className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100"
                        >
                          Complete
                        </button>
                      )}
                      {item.type === "email" && (
                        <button
                          onClick={() => handleQuickAction(item, "view-email")}
                          className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                        >
                          View Email
                        </button>
                      )}
                      <button
                        onClick={() => handleQuickAction(item, "create-touchpoint")}
                        className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                      >
                        Follow-up
                      </button>
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

