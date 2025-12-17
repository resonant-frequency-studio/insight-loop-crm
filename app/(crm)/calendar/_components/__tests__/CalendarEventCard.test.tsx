import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CalendarEventCard from "../CalendarEventCard";
import { CalendarEvent, Contact } from "@/types/firestore";

// Mock the onClose function
const mockOnClose = jest.fn();

// Mock hooks
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "test-user" }, loading: false }),
}));

jest.mock("@/hooks/useCalendarEvents", () => ({
  useLinkEventToContact: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useUnlinkEventFromContact: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useGenerateEventContext: () => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
  useUpdateCalendarEvent: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useDeleteCalendarEvent: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useCreateCalendarEvent: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock("@/hooks/useContacts", () => ({
  useContacts: () => ({
    data: [],
  }),
}));

// Helper to render with QueryClientProvider
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("CalendarEventCard", () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render event title", () => {
    renderWithProviders(<CalendarEventCard event={baseEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Test Event")).toBeInTheDocument();
  });

  it("should display linked contact indicator when event is linked", () => {
    const linkedEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
      contactSnapshot: {
        name: "John Doe",
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: "2025-01-01T09:00:00Z",
      },
    };
    renderWithProviders(<CalendarEventCard event={linkedEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Linked")).toBeInTheDocument();
  });

  it("should not display linked indicator when event is not linked", () => {
    renderWithProviders(<CalendarEventCard event={baseEvent} onClose={mockOnClose} />);
    expect(screen.queryByText("Linked")).not.toBeInTheDocument();
  });

  it("should display segment pill when contact has a segment", () => {
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
    renderWithProviders(<CalendarEventCard event={segmentEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Prospect")).toBeInTheDocument();
  });

  it("should not display segment pill when contact has no segment", () => {
    const noSegmentEvent: CalendarEvent = {
      ...baseEvent,
      matchedContactId: "c1",
      contactSnapshot: {
        name: "John Doe",
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: "2025-01-01T09:00:00Z",
      },
    };
    renderWithProviders(<CalendarEventCard event={noSegmentEvent} onClose={mockOnClose} />);
    expect(screen.queryByText("Prospect")).not.toBeInTheDocument();
  });

  it("should display touchpoint badge when event is a touchpoint", () => {
    const touchpointEvent: CalendarEvent = {
      ...baseEvent,
      sourceOfTruth: "crm_touchpoint",
    };
    renderWithProviders(<CalendarEventCard event={touchpointEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Touchpoint")).toBeInTheDocument();
  });

  it("should not display touchpoint badge when event is not a touchpoint", () => {
    renderWithProviders(<CalendarEventCard event={baseEvent} onClose={mockOnClose} />);
    expect(screen.queryByText("Touchpoint")).not.toBeInTheDocument();
  });

  it("should display all indicators together when applicable", () => {
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
    renderWithProviders(<CalendarEventCard event={fullEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Linked")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Touchpoint")).toBeInTheDocument();
  });

  it("should render event date and time for timed events", () => {
    renderWithProviders(<CalendarEventCard event={baseEvent} onClose={mockOnClose} />);
    // The date formatting will vary by locale, so we just check that date/time info is present
    expect(screen.getByText(/January|Jan/)).toBeInTheDocument();
  });

  it("should render all-day indicator for all-day events", () => {
    // All-day events have startTime at 00:00:00 UTC and endTime at 23:59:59.999 UTC
    const allDayEvent: CalendarEvent = {
      ...baseEvent,
      startTime: "2025-01-01T00:00:00Z",
      endTime: "2025-01-01T23:59:59.999Z",
    };
    renderWithProviders(<CalendarEventCard event={allDayEvent} onClose={mockOnClose} />);
    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("should display Join Info accordion when Zoom/Meet links are present", () => {
    const eventWithZoomLink: CalendarEvent = {
      ...baseEvent,
      description: "Join the meeting: https://zoom.us/j/123456789",
    };
    renderWithProviders(<CalendarEventCard event={eventWithZoomLink} onClose={mockOnClose} />);
    expect(screen.getByText("Join Info")).toBeInTheDocument();
  });

  it("should display Linked Contact section", () => {
    renderWithProviders(<CalendarEventCard event={baseEvent} onClose={mockOnClose} />);
    expect(screen.getByText("Linked Contact")).toBeInTheDocument();
  });

  it("should display sync metadata when lastSyncedAt is present", () => {
    const eventWithSync: CalendarEvent = {
      ...baseEvent,
      lastSyncedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };
    renderWithProviders(<CalendarEventCard event={eventWithSync} onClose={mockOnClose} />);
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
  });
});

