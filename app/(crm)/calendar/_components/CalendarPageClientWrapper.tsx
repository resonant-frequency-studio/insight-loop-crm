"use client";

import { useState, useMemo } from "react";
import { View } from "react-big-calendar";
import { startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarEventsRealtime } from "@/hooks/useCalendarEventsRealtime";
import { useContactsRealtime } from "@/hooks/useContactsRealtime";
import { useCalendarSyncStatusRealtime } from "@/hooks/useCalendarSyncStatusRealtime";
import { formatRelativeTime } from "@/util/time-utils";
import CalendarView from "./CalendarView";
import CalendarFilterBar, { CalendarFilters } from "./CalendarFilterBar";
import CreateEventModal from "./CreateEventModal";
import { ErrorMessage } from "@/components/ErrorMessage";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/Button";
import Card from "@/components/Card";
import { CalendarEvent } from "@/types/firestore";

const CALENDAR_VIEW_STORAGE_KEY = "insight-loop-calendar-view";

export default function CalendarPageClientWrapper() {
  const { user, loading: authLoading } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalPrefill, setCreateModalPrefill] = useState<{ startTime?: Date; endTime?: Date; contactId?: string } | null>(null);
  
  // Get userId from auth (no longer passed as prop from SSR)
  const effectiveUserId = !authLoading && user?.uid ? user.uid : null;
  
  // Initialize view from localStorage
  const [currentView, setCurrentView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
      if (savedView && ["month", "week", "day", "agenda"].includes(savedView)) {
        return savedView as View;
      }
    }
    return "month" as View;
  });

  // Calendar sync status
  const { lastSync, loading: syncStatusLoading } = useCalendarSyncStatusRealtime(effectiveUserId);

  // Calculate date range based on current view
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Calculate date range based on view type
  const { timeMin, timeMax } = useMemo(() => {
    let min: Date;
    let max: Date;
    
    switch (currentView) {
      case "day":
        min = startOfDay(currentDate);
        max = endOfDay(currentDate);
        break;
      case "week":
        min = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
        max = endOfWeek(currentDate, { weekStartsOn: 0 }); // Saturday
        break;
      case "month":
      default:
        min = startOfMonth(currentDate);
        max = endOfMonth(currentDate);
        break;
    }
    
    return { timeMin: min, timeMax: max };
  }, [currentDate, currentView]);

  // Use Firebase real-time listeners
  const { events = [], loading: isLoading, error, hasConfirmedNoEvents } = useCalendarEventsRealtime(
    effectiveUserId,
    timeMin,
    timeMax
  );

  // Fetch contacts for event card suggestions
  const { contacts = [] } = useContactsRealtime(effectiveUserId);
  
  // For error handling, check if error exists
  const isError = error !== null;

  // Filter state
  const [filters, setFilters] = useState<CalendarFilters>({
    segment: undefined,
    tags: undefined,
    onlyLinked: false,
    onlyTouchpoints: false,
    search: undefined,
  });

  // Filter events client-side
  const filteredEvents = useMemo(() => {
    return events.filter((event: CalendarEvent) => {
      // Segment filter
      if (filters.segment) {
        if (event.contactSnapshot?.segment !== filters.segment) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const eventTags = event.contactSnapshot?.tags || [];
        if (!filters.tags.every((tag) => eventTags.includes(tag))) {
          return false;
        }
      }

      // Only linked events
      if (filters.onlyLinked) {
        if (!event.matchedContactId) {
          return false;
        }
      }

      // Only touchpoints
      if (filters.onlyTouchpoints) {
        if (event.sourceOfTruth !== "crm_touchpoint") {
          return false;
        }
      }

      // Search filter
      if (filters.search && filters.search.trim().length > 0) {
        const searchLower = filters.search.toLowerCase().trim();
        const titleMatch = event.title.toLowerCase().includes(searchLower);
        const contactNameMatch = event.contactSnapshot?.name
          ?.toLowerCase()
          .includes(searchLower);
        if (!titleMatch && !contactNameMatch) {
          return false;
        }
      }

      return true;
    });
  }, [events, filters]);

  // Prepare error message and helpers if there is an error (but still render static content below)
  const errorMessage = isError && error instanceof Error ? error.message : (isError ? "Failed to load calendar events" : null);
  const needsReconnect = errorMessage ? (
    errorMessage.includes("Calendar access not granted") || 
    errorMessage.includes("reconnect your Google account with Calendar") ||
    errorMessage.includes("Calendar scope")
  ) : false;
  
  const needsApiEnabled = errorMessage ? (
    errorMessage.includes("Google Calendar API has not been used") ||
    errorMessage.includes("calendar-json.googleapis.com") ||
    errorMessage.includes("Enable it by visiting")
  ) : false;

  // Show empty state only after loading completes AND there's no data
  // Don't show empty state while loading - let the calendar view handle loading state

  return (
    <div className="space-y-6">
      {/* Header - Mobile: stacked, Desktop: row with buttons on right */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Calendar</h1>
          <p className="text-theme-dark text-lg">View and manage your calendar events</p>
        </div>
        {/* Buttons - Mobile: below header, Desktop: right side */}
        <div className="flex flex-col items-stretch sm:items-end gap-3 xl:shrink-0 w-full sm:w-auto">
          <Button
            onClick={() => {
              setCreateModalPrefill(null);
              setShowCreateModal(true);
            }}
            size="sm"
            fullWidth
            className="whitespace-nowrap shadow-sm"
          >
            New Event
          </Button>
        </div>
      </div>

      {/* Last Synced Display with link to sync page */}
      {!syncStatusLoading && (
        <div className="flex items-center gap-2 text-theme-dark text-sm">
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>
            Last synced: {lastSync?.finishedAt ? formatRelativeTime(lastSync.finishedAt) : "Never synced"}
          </span>
          <span className="text-theme-medium">•</span>
          <a
            href="/sync"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Manage sync settings
          </a>
        </div>
      )}

      {/* Error Message - show if there's an error */}
      {isError && errorMessage && (
        <>
          <ErrorMessage 
            message={errorMessage}
            dismissible={false}
          />
          {needsApiEnabled && (
            <Card padding="md" className="bg-yellow-50 border-yellow-200">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-theme-darkest mb-2">
                    Google Calendar API Not Enabled
                  </h3>
                  <p className="text-theme-dark mb-4">
                    The Google Calendar API needs to be enabled in your Google Cloud Console before you can sync calendar events.
                  </p>
                  <div className="bg-white p-3 rounded border border-yellow-300 mb-4">
                    <p className="text-sm text-theme-darkest font-mono break-all">
                      {errorMessage}
                    </p>
                  </div>
                  <p className="text-sm text-theme-dark mb-4">
                    <strong>To fix this:</strong>
                  </p>
                  <ol className="text-sm text-theme-dark list-decimal list-inside space-y-2 mb-4">
                    <li>Open the Google Cloud Console</li>
                    <li>Navigate to APIs & Services → Library</li>
                    <li>Search for &quot;Google Calendar API&quot;</li>
                    <li>Click &quot;Enable&quot;</li>
                    <li>Wait a few minutes for the API to be fully enabled</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      // Extract the URL from the error message if present
                      const urlMatch = errorMessage.match(/https:\/\/[^\s]+/);
                      if (urlMatch) {
                        window.open(urlMatch[0], '_blank');
                      } else {
                        window.open('https://console.cloud.google.com/apis/library/calendar-json.googleapis.com', '_blank');
                      }
                    }}
                  >
                    Open Google Cloud Console
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {needsReconnect && !needsApiEnabled && (
            <Card padding="md" className="bg-blue-50 border-blue-200">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-theme-darkest mb-2">
                    Calendar Access Required
                  </h3>
                  <p className="text-theme-dark mb-4">
                    Your Google account needs to be reconnected with Calendar permissions to view your events.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {!needsReconnect && !needsApiEnabled && (
            <Button onClick={() => window.location.reload()}>Retry</Button>
          )}
        </>
      )}

      {/* Calendar Filter Bar - ALWAYS render - enable as soon as cached data is available */}
      <CalendarFilterBar
        events={events}
        filters={filters}
        onFiltersChange={setFilters}
        disabled={!effectiveUserId || events.length === 0}
      />

      {/* Empty State - only show when both cache and server confirm no events */}
      {hasConfirmedNoEvents && (
        <EmptyState
          message="No calendar events"
          description={`No events found for ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Try navigating to a different month or sync your calendar.`}
          showActions={false}
          wrapInCard={true}
          size="lg"
        />
      )}

      {/* Calendar View - ALWAYS render */}
      <CalendarView
        events={filteredEvents}
        currentDate={currentDate}
        onNavigate={(date) => setCurrentDate(date)}
        contacts={contacts}
        onSlotSelect={(start, end) => {
          setCreateModalPrefill({ startTime: start, endTime: end });
          setShowCreateModal(true);
        }}
        onViewChange={(view) => {
          setCurrentView(view);
          // Also save to localStorage (CalendarView does this too, but we want to keep state in sync)
          if (typeof window !== "undefined") {
            localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
          }
        }}
        initialView={currentView}
      />

      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateModalPrefill(null);
        }}
        prefillStartTime={createModalPrefill?.startTime}
        prefillEndTime={createModalPrefill?.endTime}
        prefillContactId={createModalPrefill?.contactId}
        contacts={contacts}
      />
    </div>
  );
}

