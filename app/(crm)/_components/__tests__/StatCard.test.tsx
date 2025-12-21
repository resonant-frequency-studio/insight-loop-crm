import { screen } from "@testing-library/react";
import StatCard from "../StatCard";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { DashboardStats } from "../../../../hooks/useDashboardStats";
import { Contact } from "@/types/firestore";

// Mock useDashboardStatsRealtime hook
jest.mock("../../../../hooks/useDashboardStatsRealtime", () => ({
  useDashboardStatsRealtime: jest.fn(),
}));

import { useDashboardStatsRealtime } from "../../../../hooks/useDashboardStatsRealtime";

const mockUseDashboardStatsRealtime = useDashboardStatsRealtime as jest.MockedFunction<typeof useDashboardStatsRealtime>;

describe("StatCard", () => {
  const mockStats: DashboardStats = {
    totalContacts: 100,
    contactsWithEmail: 80,
    contactsWithThreads: 25,
    averageEngagementScore: 75,
    segmentDistribution: {},
    leadSourceDistribution: {},
    tagDistribution: {},
    sentimentDistribution: {},
    engagementLevels: {
      high: 10,
      medium: 15,
      low: 5,
      none: 0,
    },
    upcomingTouchpoints: 10,
  };

  const mockContacts: Contact[] = [
    {
      contactId: "contact-1",
      primaryEmail: "test@example.com",
      firstName: "Test",
      lastName: "User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockProps = {
    contacts: mockContacts,
    title: "Total Contacts",
    description: "All contacts in your CRM",
    icon: <div data-testid="icon">📊</div>,
    iconBgColor: "bg-blue-100",
    getValue: (stats: DashboardStats) => stats.totalContacts,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStatsRealtime.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    });
  });

  describe("Rendering", () => {
    it("renders title and description", () => {
      renderWithProviders(<StatCard {...mockProps} />);
      expect(screen.getByText("Total Contacts")).toBeInTheDocument();
      expect(screen.getByText("All contacts in your CRM")).toBeInTheDocument();
    });

    it("icon displays with correct background color", () => {
      renderWithProviders(<StatCard {...mockProps} />);
      const iconContainer = screen.getByTestId("icon").parentElement;
      expect(iconContainer).toHaveClass("bg-blue-100");
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton when data is not available", () => {
      mockUseDashboardStatsRealtime.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("StatValue shows loading skeleton when data is not available", () => {
      mockUseDashboardStatsRealtime.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      // Should show skeleton in StatValue
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("StatValue displays when data is available", () => {
      renderWithProviders(<StatCard {...mockProps} />);
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("getValue function is called with stats data", () => {
      const mockGetValue = jest.fn((stats: DashboardStats) => stats.totalContacts);

      renderWithProviders(
        <StatCard
          {...mockProps}
          getValue={mockGetValue}
        />
      );
      expect(mockGetValue).toHaveBeenCalledWith(mockStats);
    });

    it("displays different values for different getValue functions", () => {
      const { rerender } = renderWithProviders(
        <StatCard
          {...mockProps}
          getValue={(stats) => stats.totalContacts}
        />
      );
      expect(screen.getByText("100")).toBeInTheDocument();

      rerender(
        <StatCard
          {...mockProps}
          title="Active Threads"
          getValue={(stats) => stats.contactsWithThreads}
        />
      );
      expect(screen.getByText("25")).toBeInTheDocument();
    });
  });

  describe("Card Wrapper", () => {
    it("Card component wraps content", () => {
      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      // Card should have base card styles
      const card = container.querySelector(".bg-card-light.rounded-sm");
      expect(card).toBeInTheDocument();
    });
  });
});

