import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CalendarView from "../CalendarView";
import { CalendarEvent } from "@/types/firestore";

// Mock react-big-calendar
jest.mock("react-big-calendar", () => {
  return {
    Calendar: ({ events, eventPropGetter }: { events: Array<{ title: string; className?: string }>; eventPropGetter?: (event: { title: string }) => { className?: string } }) => {
      // Test eventPropGetter by applying it to events
      const styledEvents = events.map((event) => {
        const props = eventPropGetter ? eventPropGetter(event) : {};
        return { ...event, ...props };
      });
      return (
        <div data-testid="calendar">
          {styledEvents.map((event, idx: number) => (
            <div key={idx} data-testid={`event-${idx}`} className={event.className || ""}>
              {event.title}
            </div>
          ))}
        </div>
      );
    },
    dateFnsLocalizer: jest.fn(() => ({})),
  };
});

// Mock ThemeProvider
jest.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

describe("CalendarView", () => {
  const baseEvent: CalendarEvent = {
    eventId: "e1",
    googleEventId: "g1",
    userId: "u1",
    title: "Test Event",
    startTime: "2025-01-01T10:00:00Z",
    endTime: "2025-01-01T11:00:00Z",
    lastSyncedAt: "2025-01-01T09:00:00Z",
    createdAt: "2025-01-01T09:00:00Z",
    updatedAt: "2025-01-01T09:00:00Z",
    sourceOfTruth: "google",
  };

  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
    // Mock window.innerWidth for mobile detection
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });
  });

  it("should apply linked class to linked events", () => {
    const linkedEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
    };
    render(
      <CalendarView
        events={[linkedEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    expect(eventElement).toHaveClass("rbc-event-linked");
  });

  it("should apply touchpoint class to touchpoint events", () => {
    const touchpointEvent: CalendarEvent = {
      ...baseEvent,
      sourceOfTruth: "crm_touchpoint",
    };
    render(
      <CalendarView
        events={[touchpointEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    expect(eventElement).toHaveClass("rbc-event-touchpoint");
  });

  it("should apply segment class when contact has a segment", () => {
    const segmentEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
      contactSnapshot: {
        name: "John Doe",
        segment: "Prospect",
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: "2025-01-01T09:00:00Z",
      },
    };
    render(
      <CalendarView
        events={[segmentEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    expect(eventElement).toHaveClass("rbc-event-segment-prospect");
  });

  it("should apply multiple classes when event has multiple properties", () => {
    const fullEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
      sourceOfTruth: "crm_touchpoint",
      contactSnapshot: {
        name: "John Doe",
        segment: "Customer",
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: "2025-01-01T09:00:00Z",
      },
    };
    render(
      <CalendarView
        events={[fullEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    expect(eventElement).toHaveClass("rbc-event-linked");
    expect(eventElement).toHaveClass("rbc-event-touchpoint");
    expect(eventElement).toHaveClass("rbc-event-segment-customer");
  });

  it("should not apply any special classes to unlinked, non-touchpoint events", () => {
    render(
      <CalendarView
        events={[baseEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    expect(eventElement).not.toHaveClass("rbc-event-linked");
    expect(eventElement).not.toHaveClass("rbc-event-touchpoint");
  });

  it("should handle segment names with spaces and special characters", () => {
    const segmentEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
      contactSnapshot: {
        name: "John Doe",
        segment: "VIP Client",
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: "2025-01-01T09:00:00Z",
      },
    };
    render(
      <CalendarView
        events={[segmentEvent]}
        currentDate={new Date("2025-01-01")}
        onNavigate={mockOnNavigate}
      />
    );
    const eventElement = screen.getByTestId("event-0");
    // Segment "VIP Client" should become "vip-client"
    expect(eventElement).toHaveClass("rbc-event-segment-vip-client");
  });
});

