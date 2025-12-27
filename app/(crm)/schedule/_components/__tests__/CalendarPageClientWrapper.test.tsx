import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CalendarPageClientWrapper from "../CalendarPageClientWrapper";
import { SyncJob } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

// Mock ThemeProvider
jest.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Mock hooks
jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "test-user" }, loading: false }),
}));

// Mock Firebase real-time hooks
jest.mock("@/hooks/useCalendarEventsRealtime", () => ({
  useCalendarEventsRealtime: () => ({
    events: [
      {
        eventId: "e1",
        googleEventId: "g1",
        userId: "test-user",
        title: "Test Event",
        startTime: "2025-01-15T10:00:00Z",
        endTime: "2025-01-15T11:00:00Z",
        lastSyncedAt: "2025-01-15T09:00:00Z",
        createdAt: "2025-01-15T09:00:00Z",
        updatedAt: "2025-01-15T09:00:00Z",
        sourceOfTruth: "google",
      },
    ],
    loading: false,
    error: null,
  }),
}));

jest.mock("@/hooks/useContactsRealtime", () => ({
  useContactsRealtime: () => ({
    contacts: [],
    loading: false,
    error: null,
  }),
}));

// Mock mutation hooks (still use React Query)
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCreateCalendarEvent: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
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
}));


// Mock useCalendarSyncStatusRealtime
let mockLastSync: SyncJob | null = null;
const mockUseCalendarSyncStatusRealtime = jest.fn(() => ({
  lastSync: mockLastSync as SyncJob | null,
  loading: false,
  error: null,
}));

jest.mock("@/hooks/useCalendarSyncStatusRealtime", () => ({
  useCalendarSyncStatusRealtime: () => mockUseCalendarSyncStatusRealtime(),
}));

// Mock formatRelativeTime
jest.mock("@/util/time-utils", () => ({
  formatRelativeTime: jest.fn((timestamp) => {
    if (!timestamp) return "Never synced";
    return "2 hours ago";
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

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

describe("CalendarPageClientWrapper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    // Reset mock to default
    mockLastSync = null;
    mockUseCalendarSyncStatusRealtime.mockReturnValue({
      lastSync: null,
      loading: false,
      error: null,
    });
  });

  it("should display 'Never synced' when no sync history exists", () => {
    renderWithProviders(<CalendarPageClientWrapper />);
    
    expect(screen.getByText(/Up to date as of never synced/i)).toBeInTheDocument();
  });

  it("should display last synced time when sync history exists", () => {
    const lastSync: SyncJob = {
      syncJobId: "sync123",
      userId: "test-user",
      service: "calendar",
      type: "initial",
      status: "complete",
      startedAt: Timestamp.now(),
      finishedAt: Timestamp.now(),
      processedEvents: 10,
    };

    mockLastSync = lastSync;
    mockUseCalendarSyncStatusRealtime.mockReturnValue({
      lastSync: lastSync as SyncJob | null,
      loading: false,
      error: null,
    });

    renderWithProviders(<CalendarPageClientWrapper />);
    
    expect(screen.getByText(/Up to date as of 2 hours ago/i)).toBeInTheDocument();
  });

  it("should display link to sync page", () => {
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const syncLink = screen.getByRole("link", { name: /Sync preferences/i });
    expect(syncLink).toBeInTheDocument();
    expect(syncLink).toHaveAttribute("href", "/sync");
  });

  it("should show loading state when sync status is loading", () => {
    mockUseCalendarSyncStatusRealtime.mockReturnValue({
      lastSync: null,
      loading: true,
      error: null,
    });

    renderWithProviders(<CalendarPageClientWrapper />);
    
    // Should not show sync status when loading
    expect(screen.queryByText(/Up to date as of/i)).not.toBeInTheDocument();
  });

});

