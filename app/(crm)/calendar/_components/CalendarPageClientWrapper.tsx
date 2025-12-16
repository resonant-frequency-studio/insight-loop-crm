"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import CalendarView from "./CalendarView";
import CalendarSkeleton from "./CalendarSkeleton";
import { ErrorMessage } from "@/components/ErrorMessage";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/Button";
import Card from "@/components/Card";

export default function CalendarPageClientWrapper({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  
  // Prioritize userId prop from SSR (production should always have this)
  // Only fallback to client auth if userId prop is empty (E2E mode)
  const effectiveUserId = userId || (!authLoading && user?.uid ? user.uid : "");

  // Calculate date range for current month view
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { timeMin, timeMax } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const min = new Date(year, month, 1);
    const max = new Date(year, month + 1, 0, 23, 59, 59);
    return { timeMin: min, timeMax: max };
  }, [currentDate]);

  const { data: events = [], isLoading, isError, error, refetch } = useCalendarEvents(
    effectiveUserId,
    timeMin,
    timeMax,
    { enabled: !!effectiveUserId }
  );

  // Show loading if we don't have userId yet
  if (!effectiveUserId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Calendar</h1>
          <p className="text-theme-dark text-lg">View and manage your calendar events</p>
        </div>
        <CalendarSkeleton />
      </div>
    );
  }

  // Show error if there is one
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load calendar events";
    console.log('[CalendarPageClientWrapper] Error detected:', { errorMessage, error });
    const needsReconnect = errorMessage.includes("Calendar access not granted") || 
                          errorMessage.includes("reconnect your Google account with Calendar") ||
                          errorMessage.includes("Calendar scope");
    
    const needsApiEnabled = errorMessage.includes("Google Calendar API has not been used") ||
                            errorMessage.includes("calendar-json.googleapis.com") ||
                            errorMessage.includes("Enable it by visiting");
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Calendar</h1>
          <p className="text-theme-dark text-lg">View and manage your calendar events</p>
        </div>
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
                <Button variant="outline" onClick={() => refetch()}>
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
                <Button
                  onClick={() => {
                    window.location.href = "/api/oauth/gmail/start?redirect=/calendar";
                  }}
                >
                  Reconnect Google Account
                </Button>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          </Card>
        )}
        {!needsReconnect && (
          <Button onClick={() => refetch()}>Retry</Button>
        )}
      </div>
    );
  }

  // Show empty state if no events
  if (!isLoading && events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Calendar</h1>
          <p className="text-theme-dark text-lg">View and manage your calendar events</p>
        </div>
        <EmptyState
          message="No calendar events"
          description={`No events found for ${currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Try navigating to a different month or sync your calendar.`}
          showActions={false}
          wrapInCard={true}
          size="lg"
        />
        <div className="flex gap-3 justify-center">
          <Button onClick={() => refetch()} size="sm" variant="secondary">Refresh Calendar</Button>
          <Button 
            onClick={async () => {
              setSyncingCalendar(true);
              try {
                const response = await fetch('/api/calendar/sync', { 
                  method: 'POST',
                  credentials: 'include', // Include session cookie
                });
                const data = await response.json();
                console.log('Sync result:', data);
                if (data.ok) {
                  await refetch();
                } else {
                  console.error('Sync failed:', data.error);
                }
              } catch (err) {
                console.error('Sync error:', err);
              } finally {
                setSyncingCalendar(false);
              }
            }}
            disabled={syncingCalendar}
            loading={syncingCalendar}
            size="sm"
            variant="secondary"
            icon={
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
          >
            Sync Calendar
          </Button>
        </div>
      </div>
    );
  }

  // Sync Calendar button handler - shared between loading and loaded states
  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const response = await fetch('/api/calendar/sync', { 
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      console.log('Sync result:', data);
      if (data.ok) {
        await refetch();
      } else {
        console.error('Sync failed:', data.error);
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncingCalendar(false);
    }
  };

  // Sync Calendar button component - always rendered
  const syncButton = (
    <div className="flex justify-end w-full">
      <Button
        onClick={handleSyncCalendar}
        disabled={syncingCalendar}
        loading={syncingCalendar}
        size="sm"
        variant="secondary"
        icon={
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
      >
        Sync Calendar
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-theme-darkest mb-2">Calendar</h1>
        <p className="text-theme-dark text-lg">View and manage your calendar events</p>
      </div>

      {/* Sync Calendar Button - always visible */}
      {syncButton}

      {isLoading && events.length === 0 ? (
        <CalendarSkeleton />
      ) : (
        <CalendarView
          events={events}
          currentDate={currentDate}
          onNavigate={(date) => setCurrentDate(date)}
        />
      )}
    </div>
  );
}

