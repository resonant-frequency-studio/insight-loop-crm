import { screen } from "@testing-library/react";
import ChartCard from "../ChartCard";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { UseQueryResult } from "@tanstack/react-query";
import { DashboardStats } from "../../../../hooks/useDashboardStats";

// Mock useDashboardStats hook
jest.mock("../../../../hooks/useDashboardStats", () => ({
  useDashboardStats: jest.fn(),
}));

import { useDashboardStats } from "../../../../hooks/useDashboardStats";

const mockUseDashboardStats = useDashboardStats as jest.MockedFunction<typeof useDashboardStats>;

describe("ChartCard", () => {
  const mockStats = {
    totalContacts: 100,
    activeThreads: 25,
    averageEngagementScore: 75,
    upcomingTouchpoints: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<DashboardStats, Error>);
  });

  describe("Rendering", () => {
    it("renders title", () => {
      renderWithProviders(
        <ChartCard userId="user-1" title="Segment Distribution">
          {() => <div>Chart Content</div>}
        </ChartCard>
      );
      expect(screen.getByText("Segment Distribution")).toBeInTheDocument();
    });

    it("renders children (chart)", () => {
      renderWithProviders(
        <ChartCard userId="user-1" title="Chart Title">
          {() => <div data-testid="chart-content">Chart Content</div>}
        </ChartCard>
      );
      expect(screen.getByTestId("chart-content")).toBeInTheDocument();
    });

    it("applies Card wrapper", () => {
      const { container } = renderWithProviders(
        <ChartCard userId="user-1" title="Chart Title">
          {() => <div>Chart</div>}
        </ChartCard>
      );
      // Card should have base card styles
      const card = container.querySelector(".bg-white.rounded-xl");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Suspense", () => {
    it("shows loading skeleton when data is not available", () => {
      mockUseDashboardStats.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult<DashboardStats, Error>);

      const { container } = renderWithProviders(
        <ChartCard userId="user-1" title="Chart Title">
          {() => <div>Chart</div>}
        </ChartCard>
      );
      // Use container querySelector to find the skeleton by class
      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Children Function", () => {
    it("passes stats to children function", () => {
      renderWithProviders(
        <ChartCard userId="user-1" title="Chart Title">
          {(stats) => (
            <div data-testid="chart-content">
              {stats ? `Contacts: ${stats.totalContacts}` : "Loading"}
            </div>
          )}
        </ChartCard>
      );
      expect(screen.getByText("Contacts: 100")).toBeInTheDocument();
    });
  });
});

