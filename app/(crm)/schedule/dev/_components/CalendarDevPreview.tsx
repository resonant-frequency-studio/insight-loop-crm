"use client";

import { useState, useMemo } from "react";
import { View } from "react-big-calendar";
import { startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth, addDays, addHours } from "date-fns";
import CalendarView from "../../_components/CalendarView";
import CalendarFilterBar, { CalendarFilters } from "../../_components/CalendarFilterBar";
import { CalendarEvent } from "@/types/firestore";
import Card from "@/components/Card";

// Create fixture events for all event types
function createFixtureEvents(): CalendarEvent[] {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const events: CalendarEvent[] = [];

  // Session events (coaching sessions)
  events.push({
    eventId: "dev-session-1",
    googleEventId: "dev-session-1",
    userId: "dev-user",
    title: "Coaching Session - John Doe",
    description: "Quarterly review and goal setting",
    startTime: addHours(today, 10), // 10 AM today
    endTime: addHours(today, 11), // 11 AM today
    location: "Zoom",
    lastSyncedAt: now,
    sourceOfTruth: "google",
    matchedContactId: "dev-contact-1",
    contactSnapshot: {
      name: "John Doe",
      segment: "VIP",
      tags: ["coaching", "quarterly"],
      primaryEmail: "john@example.com",
      snapshotUpdatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-session-2",
    googleEventId: "dev-session-2",
    userId: "dev-user",
    title: "Coaching Call - Jane Smith",
    description: "Weekly check-in",
    startTime: addHours(today, 14), // 2 PM today
    endTime: addHours(today, 15), // 3 PM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    matchedContactId: "dev-contact-2",
    contactSnapshot: {
      name: "Jane Smith",
      segment: "Customer",
      tags: ["weekly"],
      primaryEmail: "jane@example.com",
      snapshotUpdatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Follow-up events (touchpoints)
  events.push({
    eventId: "dev-followup-1",
    googleEventId: "dev-followup-1",
    userId: "dev-user",
    title: "Follow-up with Client",
    description: "Touchpoint scheduled",
    startTime: addHours(tomorrow, 9), // 9 AM tomorrow
    endTime: addHours(tomorrow, 9.5), // 9:30 AM tomorrow
    lastSyncedAt: now,
    sourceOfTruth: "crm_touchpoint",
    matchedContactId: "dev-contact-3",
    contactSnapshot: {
      name: "Bob Johnson",
      segment: "Prospect",
      tags: ["follow-up"],
      primaryEmail: "bob@example.com",
      snapshotUpdatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });

  // Prep events
  events.push({
    eventId: "dev-prep-1",
    googleEventId: "dev-prep-1",
    userId: "dev-user",
    title: "Prep for Client Session",
    description: "Review notes and prepare agenda",
    startTime: addHours(today, 9), // 9 AM today
    endTime: addHours(today, 9.5), // 9:30 AM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-prep-2",
    googleEventId: "dev-prep-2",
    userId: "dev-user",
    title: "Review and Reflection",
    description: "Weekly review of coaching sessions",
    startTime: addHours(tomorrow, 16), // 4 PM tomorrow
    endTime: addHours(tomorrow, 17), // 5 PM tomorrow
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  // Admin events
  events.push({
    eventId: "dev-admin-1",
    googleEventId: "dev-admin-1",
    userId: "dev-user",
    title: "Admin - Team Standup",
    description: "Weekly team meeting",
    startTime: addHours(today, 8), // 8 AM today
    endTime: addHours(today, 8.5), // 8:30 AM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-admin-2",
    googleEventId: "dev-admin-2",
    userId: "dev-user",
    title: "Internal Ops Meeting",
    description: "Process improvements",
    startTime: addHours(nextWeek, 10), // 10 AM next week
    endTime: addHours(nextWeek, 11), // 11 AM next week
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  // Focus events
  events.push({
    eventId: "dev-focus-1",
    googleEventId: "dev-focus-1",
    userId: "dev-user",
    title: "Focus Time - Deep Work",
    description: "Writing and strategic thinking",
    startTime: addHours(today, 13), // 1 PM today
    endTime: addHours(today, 15), // 3 PM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-focus-2",
    googleEventId: "dev-focus-2",
    userId: "dev-user",
    title: "Writing Block",
    description: "Content creation",
    startTime: addHours(tomorrow, 13), // 1 PM tomorrow
    endTime: addHours(tomorrow, 15), // 3 PM tomorrow
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  // Hold events
  events.push({
    eventId: "dev-hold-1",
    googleEventId: "dev-hold-1",
    userId: "dev-user",
    title: "Hold - Tentative",
    description: "Placeholder for potential meeting",
    startTime: addHours(today, 16), // 4 PM today
    endTime: addHours(today, 17), // 5 PM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-hold-2",
    googleEventId: "dev-hold-2",
    userId: "dev-user",
    title: "TBD - Block",
    description: "Time blocked, details TBD",
    startTime: addHours(tomorrow, 11), // 11 AM tomorrow
    endTime: addHours(tomorrow, 12), // 12 PM tomorrow
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  // Overlapping scenario
  events.push({
    eventId: "dev-overlap-1",
    googleEventId: "dev-overlap-1",
    userId: "dev-user",
    title: "Overlapping Event A",
    description: "This overlaps with Event B",
    startTime: addHours(today, 11), // 11 AM today
    endTime: addHours(today, 12.5), // 12:30 PM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  events.push({
    eventId: "dev-overlap-2",
    googleEventId: "dev-overlap-2",
    userId: "dev-user",
    title: "Overlapping Event B",
    description: "This overlaps with Event A",
    startTime: addHours(today, 12), // 12 PM today
    endTime: addHours(today, 13), // 1 PM today
    lastSyncedAt: now,
    sourceOfTruth: "google",
    createdAt: now,
    updatedAt: now,
  });

  return events;
}

export default function CalendarDevPreview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>("week");

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
        min = startOfWeek(currentDate, { weekStartsOn: 0 });
        max = endOfWeek(currentDate, { weekStartsOn: 0 });
        break;
      case "month":
      default:
        min = startOfMonth(currentDate);
        max = endOfMonth(currentDate);
        break;
    }
    
    return { timeMin: min, timeMax: max };
  }, [currentDate, currentView]);

  // Use fixture events
  const events = useMemo(() => createFixtureEvents(), []);

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
      if (filters.segment) {
        if (event.contactSnapshot?.segment !== filters.segment) {
          return false;
        }
      }

      if (filters.tags && filters.tags.length > 0) {
        const eventTags = event.contactSnapshot?.tags || [];
        if (!filters.tags.every((tag) => eventTags.includes(tag))) {
          return false;
        }
      }

      if (filters.onlyLinked) {
        if (!event.matchedContactId) {
          return false;
        }
      }

      if (filters.onlyTouchpoints) {
        if (event.sourceOfTruth !== "crm_touchpoint") {
          return false;
        }
      }

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

  return (
    <div className="space-y-6 crm-calendar">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-theme-darkest mb-2">Schedule Dev Preview</h1>
          <p className="text-theme-dark text-lg">
            Preview all event types and states. This page is only available in development mode.
          </p>
        </div>
      </div>

      {/* Event Type Legend */}
      <Card padding="md">
        <h2 className="text-lg font-semibold text-theme-darkest mb-4">Event Types</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: "#3b82f6" }}></div>
            <span className="text-sm font-semibold">Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: "#10b981" }}></div>
            <span className="text-sm">Follow-up</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: "#8b5cf6" }}></div>
            <span className="text-sm">Prep</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: "#f59e0b" }}></div>
            <span className="text-sm">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4" style={{ borderLeftColor: "#6366f1" }}></div>
            <span className="text-sm">Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-dashed" style={{ borderLeftColor: "#6b7280" }}></div>
            <span className="text-sm">Hold</span>
          </div>
        </div>
      </Card>

      {/* Calendar Filter Bar */}
      <CalendarFilterBar
        events={events}
        filters={filters}
        onFiltersChange={setFilters}
        disabled={false}
      />

      {/* Calendar View */}
      <CalendarView
        events={filteredEvents}
        currentDate={currentDate}
        onNavigate={(date) => setCurrentDate(date)}
        onViewChange={(view) => setCurrentView(view)}
        initialView={currentView}
      />
    </div>
  );
}

