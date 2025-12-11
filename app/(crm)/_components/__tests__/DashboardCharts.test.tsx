import { screen } from "@testing-library/react";
import DashboardCharts from "../DashboardCharts";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { UseQueryResult } from "@tanstack/react-query";
import { DashboardStats } from "../../../../hooks/useDashboardStats";

// Mock useDashboardStats hook
jest.mock("../../../../hooks/useDashboardStats", () => ({
  useDashboardStats: jest.fn(),
}));

import { useDashboardStats } from "../../../../hooks/useDashboardStats";

const mockUseDashboardStats = useDashboardStats as jest.MockedFunction<typeof useDashboardStats>;

describe("DashboardCharts", () => {
  const mockStats: DashboardStats = {
    totalContacts: 100,
    contactsWithEmail: 80,
    contactsWithThreads: 25,
    averageEngagementScore: 75,
    segmentDistribution: { Enterprise: 50, SMB: 30 },
    leadSourceDistribution: { Website: 40, Referral: 35 },
    tagDistribution: { VIP: 20, Priority: 15 },
    sentimentDistribution: { Positive: 60, Neutral: 30 },
    engagementLevels: {
      high: 20,
      medium: 30,
      low: 25,
      none: 25,
    },
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

  it("renders loading skeleton when data is not available", () => {
    mockUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as UseQueryResult<DashboardStats, Error>);

    const { container } = renderWithProviders(<DashboardCharts userId="user-1" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders all chart cards when data is available", () => {
    renderWithProviders(<DashboardCharts userId="user-1" />);
    expect(screen.getByText("Segment Distribution")).toBeInTheDocument();
    expect(screen.getByText("Lead Source Distribution")).toBeInTheDocument();
    expect(screen.getByText("Engagement Levels")).toBeInTheDocument();
    expect(screen.getByText("Top Tags")).toBeInTheDocument();
    expect(screen.getByText("Sentiment Distribution")).toBeInTheDocument();
  });

  it("renders chart components with correct data", () => {
    const { container } = renderWithProviders(<DashboardCharts userId="user-1" />);
    // Charts should be rendered (check for chart containers)
    const chartCards = container.querySelectorAll(".bg-card-light.rounded-xl");
    expect(chartCards.length).toBeGreaterThan(0);
  });
});

