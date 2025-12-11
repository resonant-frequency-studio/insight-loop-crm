import { screen } from "@testing-library/react";
import StatCard from "../StatCard";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { UseQueryResult } from "@tanstack/react-query";
import { DashboardStats } from "../../../../hooks/useDashboardStats";

// Mock useDashboardStats hook
jest.mock("../../../../hooks/useDashboardStats", () => ({
  useDashboardStats: jest.fn(),
}));

import { useDashboardStats } from "../../../../hooks/useDashboardStats";

const mockUseDashboardStats = useDashboardStats as jest.MockedFunction<typeof useDashboardStats>;

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

  const mockProps = {
    userId: "user-1",
    title: "Total Contacts",
    description: "All contacts in your CRM",
    icon: <div data-testid="icon">📊</div>,
    iconBgColor: "bg-blue-100",
    getValue: (stats: DashboardStats) => stats.totalContacts,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders title and description", () => {
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      renderWithProviders(<StatCard {...mockProps} />);
      expect(screen.getByText("Total Contacts")).toBeInTheDocument();
      expect(screen.getByText("All contacts in your CRM")).toBeInTheDocument();
    });

    it("icon displays with correct background color", () => {
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      renderWithProviders(<StatCard {...mockProps} />);
      const iconContainer = screen.getByTestId("icon").parentElement;
      expect(iconContainer).toHaveClass("bg-blue-100");
    });
  });

  describe("Suspense", () => {
    it("shows loading skeleton when data is not available", () => {
      mockUseDashboardStats.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("StatValue shows loading skeleton when data is not available", () => {
      mockUseDashboardStats.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      // Should show skeleton in StatValue
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Data Display", () => {
    it("StatValue displays when data is available", () => {
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      renderWithProviders(<StatCard {...mockProps} />);
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("getValue function is called with stats data", () => {
      const mockGetValue = jest.fn((stats: DashboardStats) => stats.totalContacts);
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      renderWithProviders(
        <StatCard
          {...mockProps}
          getValue={mockGetValue}
        />
      );
      expect(mockGetValue).toHaveBeenCalledWith(mockStats);
    });

    it("displays different values for different getValue functions", () => {
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

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
      mockUseDashboardStats.mockReturnValue({
        data: mockStats,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      const { container } = renderWithProviders(<StatCard {...mockProps} />);
      // Card should have base card styles
      const card = container.querySelector(".bg-card-light.rounded-xl");
      expect(card).toBeInTheDocument();
    });
  });
});

