"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, View, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";
import "./calendar.tokens.css";
import "./calendar.rbc.css";
import { CalendarEvent } from "@/types/firestore";
import { useTheme } from "@/components/ThemeProvider";
import CalendarEventCard from "./CalendarEventCard";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import { eventPropGetter, dayPropGetter, slotPropGetter } from "./rbcStyleGetters";

const CALENDAR_VIEW_STORAGE_KEY = "insight-loop-calendar-view";

// Hook to detect mobile vs desktop
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // 768px is typically the breakpoint for mobile
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}


const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onNavigate: (date: Date) => void;
  contacts?: import("@/types/firestore").Contact[]; // Optional contacts for event card
  onSlotSelect?: (start: Date, end: Date) => void; // Callback when slot is selected
  onViewChange?: (view: View) => void; // Callback when view changes
  initialView?: View; // Initial view to use
}

export default function CalendarView({ events, currentDate, onNavigate, contacts, onSlotSelect, onViewChange, initialView }: CalendarViewProps) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  
  // Compute the effective view: mobile always uses day, desktop uses saved preference or initialView
  const effectiveView = useMemo(() => {
    if (initialView) {
      return initialView;
    }
    if (isMobile) {
      return "day" as View;
    }
    // On desktop, try to load from localStorage
    if (typeof window !== "undefined") {
      const savedView = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
      if (savedView && ["month", "week", "day", "agenda"].includes(savedView)) {
        return savedView as View;
      }
    }
    return "month" as View;
  }, [isMobile, initialView]);

  const [view, setView] = useState<View>(effectiveView);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Update view when effective view changes (e.g., device type change or initialView prop)
  useEffect(() => {
    setView(effectiveView);
  }, [effectiveView]);

  // Auto-scroll to current time indicator when viewing week/day on current day
  useEffect(() => {
    // Only auto-scroll for week and day views
    if (view !== "week" && view !== "day") return;

    // Check if currentDate is today
    const today = new Date();
    const isToday = 
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getDate() === today.getDate();

    if (!isToday) return;

    // Wait for calendar to render, then scroll to current time indicator
    const scrollToCurrentTime = () => {
      // Find the current time indicator element
      const timeIndicator = document.querySelector('.rbc-current-time-indicator') as HTMLElement;
      if (timeIndicator) {
        // Find the scrollable container (usually .rbc-time-content)
        const scrollContainer = timeIndicator.closest('.rbc-time-content') as HTMLElement;
        if (scrollContainer) {
          // Calculate the position to scroll to (center the indicator in view)
          const indicatorTop = timeIndicator.offsetTop;
          const containerHeight = scrollContainer.clientHeight;
          const scrollPosition = indicatorTop - (containerHeight / 2) + (timeIndicator.offsetHeight / 2);
          
          // Smooth scroll to the current time indicator
          scrollContainer.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      }
    };

    // Use a small delay to ensure the calendar has rendered
    const timeoutId = setTimeout(scrollToCurrentTime, 100);
    
    return () => clearTimeout(timeoutId);
  }, [view, currentDate]);

  // Save view preference to localStorage when it changes (desktop only)
  const handleViewChange = (newView: View) => {
    setView(newView);
    if (!isMobile && typeof window !== "undefined") {
      localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, newView);
    }
    // Notify parent component of view change
    if (onViewChange) {
      onViewChange(newView);
    }
  };

  // Convert CalendarEvent to react-big-calendar Event format
  const calendarEvents: Event[] = useMemo(() => {
    return events.map((event) => {
      // Convert Firestore timestamp to Date
      let start: Date;
      let end: Date;

      if (event.startTime instanceof Date) {
        start = event.startTime;
      } else if (event.startTime && typeof event.startTime === "object" && "toDate" in event.startTime) {
        start = (event.startTime as { toDate: () => Date }).toDate();
      } else if (typeof event.startTime === "string") {
        start = new Date(event.startTime);
      } else {
        start = new Date();
      }

      if (event.endTime instanceof Date) {
        end = event.endTime;
      } else if (event.endTime && typeof event.endTime === "object" && "toDate" in event.endTime) {
        end = (event.endTime as { toDate: () => Date }).toDate();
      } else if (typeof event.endTime === "string") {
        end = new Date(event.endTime);
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour
      }

      // Check if this is an all-day event
      // All-day events are stored in UTC at midnight (00:00:00 UTC) for start
      // and 23:59:59.999 UTC for end (even for multi-day events)
      // When we get dates from Firestore (as ISO strings), we need to parse them correctly
      const startUTC = new Date(start.getTime ? start.getTime() : start);
      const endUTC = new Date(end.getTime ? end.getTime() : end);
      
      // Get UTC components directly from the Date objects
      const startIsMidnightUTC = startUTC.getUTCHours() === 0 && startUTC.getUTCMinutes() === 0 && startUTC.getUTCSeconds() === 0;
      const endIsEndOfDayUTC = endUTC.getUTCHours() === 23 && endUTC.getUTCMinutes() === 59 && endUTC.getUTCSeconds() === 59;
      
      // Extract UTC date components (year, month, day) - these are the actual dates
      // Use getUTCFullYear, getUTCMonth, getUTCDate to get the UTC date components
      const startYear = startUTC.getUTCFullYear();
      const startMonth = startUTC.getUTCMonth();
      const startDay = startUTC.getUTCDate();
      const endYear = endUTC.getUTCFullYear();
      const endMonth = endUTC.getUTCMonth();
      const endDay = endUTC.getUTCDate();
      
      // If start is midnight UTC and end is end of day UTC, it's an all-day event
      // This works for both single-day and multi-day all-day events
      const isAllDay = startIsMidnightUTC && endIsEndOfDayUTC;

      // For all-day events, create dates using UTC date components in local timezone
      // This preserves the correct date without timezone shifts
      // e.g., Dec 15 00:00:00 UTC should become Dec 15 00:00:00 local, not Dec 14 16:00:00 local
      // react-big-calendar expects all-day events to have:
      // - start: Date at start of first day (00:00:00 local)
      // - end: Date at start of day AFTER the last day (00:00:00 local, exclusive)
      if (isAllDay) {
        // Use UTC date components but create Date in local timezone
        // This ensures Dec 15 stays Dec 15 regardless of timezone
        start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        // For end date, react-big-calendar expects the start of the day AFTER the last day
        // Since endDay is the last day of the event, we add 1 day
        const endDate = new Date(endYear, endMonth, endDay);
        endDate.setDate(endDate.getDate() + 1); // Add one day (exclusive end)
        endDate.setHours(0, 0, 0, 0); // Set to start of that day
        end = endDate;
      }

      return {
        id: event.eventId,
        title: event.title,
        start,
        end,
        resource: event, // Store full event data
        allDay: isAllDay, // Mark as all-day for react-big-calendar
      } as Event;
    });
  }, [events]);

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event.resource as CalendarEvent);
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    if (onSlotSelect) {
      onSlotSelect(slotInfo.start, slotInfo.end);
    }
  };

  return (
    <div className="space-y-6 crm-calendar">
      <Card padding="none" className="">
        <div className="p-4">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            allDayAccessor="allDay"
            style={{ height: 600 }}
            view={view}
            onView={handleViewChange}
            date={currentDate}
            onNavigate={(date) => onNavigate(date)}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            slotPropGetter={slotPropGetter}
            className={`rbc-calendar-${resolvedTheme}`}
          />
        </div>
      </Card>

      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        closeOnBackdropClick={true}
        maxWidth="4xl"
      >
        {selectedEvent && (
          <CalendarEventCard
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            contacts={contacts}
          />
        )}
      </Modal>
    </div>
  );
}

