import { render, screen, fireEvent } from "@testing-library/react";
import CalendarFilterBar, { CalendarFilters } from "../CalendarFilterBar";
import { CalendarEvent } from "@/types/firestore";

// Mock components
jest.mock("@/components/Card", () => {
  return function MockCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={className}>{children}</div>;
  };
});

jest.mock("@/components/Button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock("@/components/Select", () => {
  return function MockSelect({
    children,
    value,
    onChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    disabled?: boolean;
  }) {
    return (
      <select value={value} onChange={onChange} disabled={disabled}>
        {children}
      </select>
    );
  };
});

jest.mock("@/components/Input", () => {
  return function MockInput({
    value,
    onChange,
    onFocus,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus?: () => void;
    placeholder?: string;
    disabled?: boolean;
  }) {
    return (
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  };
});

jest.mock("@/components/Checkbox", () => {
  return function MockCheckbox({
    checked,
    onChange,
    label,
    disabled,
  }: {
    checked: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label?: string;
    disabled?: boolean;
  }) {
    return (
      <label>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
        {label}
      </label>
    );
  };
});

describe("CalendarFilterBar", () => {
  const mockEvents: CalendarEvent[] = [
    {
      eventId: "event1",
      googleEventId: "google1",
      userId: "user1",
      title: "Meeting with John",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchedContactId: "contact1",
      contactSnapshot: {
        name: "John Doe",
        segment: "VIP",
        tags: ["important", "client"],
        primaryEmail: "john@example.com",
        snapshotUpdatedAt: new Date().toISOString(),
      },
    },
    {
      eventId: "event2",
      googleEventId: "google2",
      userId: "user1",
      title: "Team Meeting",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceOfTruth: "crm_touchpoint",
      contactSnapshot: {
        name: "Jane Smith",
        segment: "Prospect",
        tags: ["follow-up"],
        primaryEmail: "jane@example.com",
        snapshotUpdatedAt: new Date().toISOString(),
      },
    },
  ];

  const mockFilters: CalendarFilters = {
    segment: undefined,
    tags: undefined,
    onlyLinked: false,
    onlyTouchpoints: false,
    search: undefined,
  };

  const mockOnFiltersChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render filter bar with all controls", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByText("Find what matters")).toBeInTheDocument();
    expect(screen.getByText("Group")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Client-linked only")).toBeInTheDocument();
    expect(screen.getByLabelText("Follow-ups only")).toBeInTheDocument();
  });

  it("should render when no events (but with disabled state)", () => {
    render(
      <CalendarFilterBar
        events={[]}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Component should still render, but inputs should be disabled when events.length === 0
    expect(screen.getByText("Find what matters")).toBeInTheDocument();
    const segmentSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(segmentSelect).toBeDisabled();
  });

  it("should update segment filter", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const segmentSelects = screen.getAllByRole("combobox");
    const segmentSelect = segmentSelects[0];
    fireEvent.change(segmentSelect, { target: { value: "VIP" } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      segment: "VIP",
    });
  });

  it("should update search filter", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search by title or client…");
    fireEvent.change(searchInput, { target: { value: "Meeting" } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      search: "Meeting",
    });
  });

  it("should toggle onlyLinked filter", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const onlyLinkedCheckbox = screen.getByLabelText("Client-linked only");
    fireEvent.click(onlyLinkedCheckbox);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      onlyLinked: true,
    });
  });

  it("should toggle onlyTouchpoints filter", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const onlyTouchpointsCheckbox = screen.getByLabelText("Follow-ups only");
    fireEvent.click(onlyTouchpointsCheckbox);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      onlyTouchpoints: true,
    });
  });

  it("should show clear filters button when filters are active", () => {
    const activeFilters: CalendarFilters = {
      segment: "VIP",
      tags: ["important"],
      onlyLinked: true,
      onlyTouchpoints: false,
      search: "Meeting",
    };

    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={activeFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const clearButton = screen.getByText("Clear all filters");
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      segment: undefined,
      tags: undefined,
      onlyLinked: false,
      onlyTouchpoints: false,
      search: undefined,
    });
  });

  it("should display unique segments in dropdown", () => {
    render(
      <CalendarFilterBar
        events={mockEvents}
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const segmentSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(segmentSelect).toHaveTextContent("All Groups");
    expect(segmentSelect).toHaveTextContent("Prospect");
    expect(segmentSelect).toHaveTextContent("VIP");
  });
});

