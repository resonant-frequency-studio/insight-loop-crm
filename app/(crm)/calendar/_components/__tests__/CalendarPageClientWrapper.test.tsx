import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// Mock Select component to render options
jest.mock("@/components/Select", () => {
  return function MockSelect({
    children,
    value,
    onChange,
    id,
  }: {
    children: React.ReactNode;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    id?: string;
  }) {
    return (
      <select id={id} value={value} onChange={onChange} aria-label="Sync range">
        {children}
      </select>
    );
  };
});

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
    
    expect(screen.getByText(/Last synced: Never synced/i)).toBeInTheDocument();
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
    
    expect(screen.getByText(/Last synced: 2 hours ago/i)).toBeInTheDocument();
  });

  it("should display range selector with default value of 60 days", () => {
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    expect(rangeSelect).toBeInTheDocument();
    expect(rangeSelect).toHaveValue("60");
  });

  it("should persist range selection to localStorage", () => {
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    fireEvent.change(rangeSelect, { target: { value: "90" } });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "calendar-sync-range-days",
      "90"
    );
  });

  it("should restore range from localStorage on mount", () => {
    localStorageMock.setItem("calendar-sync-range-days", "180");
    
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    expect(rangeSelect).toHaveValue("180");
  });

  it("should use default range if localStorage value is invalid", () => {
    localStorageMock.setItem("calendar-sync-range-days", "999"); // Invalid value
    
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    expect(rangeSelect).toHaveValue("60"); // Should default to 60
  });

  it("should pass range parameter to sync API when sync button is clicked", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, synced: 5 }),
    });
    global.fetch = mockFetch;

    renderWithProviders(<CalendarPageClientWrapper />);
    
    // Change range to 90 days
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    fireEvent.change(rangeSelect, { target: { value: "90" } });
    
    // Click sync button (get first one if multiple)
    const syncButtons = screen.getAllByText(/Sync Calendar/i);
    const syncButton = syncButtons[0];
    fireEvent.click(syncButton);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/calendar/sync?range=90"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });
  });

  it("should show loading state when sync status is loading", () => {
    mockUseCalendarSyncStatusRealtime.mockReturnValue({
      lastSync: null,
      loading: true,
      error: null,
    });

    renderWithProviders(<CalendarPageClientWrapper />);
    
    // Should not show "Never synced" when loading
    expect(screen.queryByText(/Last synced:/i)).not.toBeInTheDocument();
  });

  it("should display range selector with all options", () => {
    renderWithProviders(<CalendarPageClientWrapper />);
    
    const rangeSelects = screen.getAllByRole("combobox", { name: /sync range/i });
    const rangeSelect = rangeSelects[0]; // Get first one
    expect(rangeSelect).toBeInTheDocument();
    // Check that select has the expected options by checking value can be changed
    fireEvent.change(rangeSelect, { target: { value: "30" } });
    expect(rangeSelect).toHaveValue("30");
    fireEvent.change(rangeSelect, { target: { value: "90" } });
    expect(rangeSelect).toHaveValue("90");
    fireEvent.change(rangeSelect, { target: { value: "180" } });
    expect(rangeSelect).toHaveValue("180");
  });
});

