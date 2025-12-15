import { screen } from "@testing-library/react";
import DashboardStatsCards from "../DashboardStatsCards";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { UseQueryResult } from "@tanstack/react-query";
import { DashboardStats } from "../../../../hooks/useDashboardStats";

// Mock useDashboardStats hook
jest.mock("../../../../hooks/useDashboardStats", () => ({
  useDashboardStats: jest.fn(),
}));

import { useDashboardStats } from "../../../../hooks/useDashboardStats";

const mockUseDashboardStats = useDashboardStats as jest.MockedFunction<typeof useDashboardStats>;

describe("DashboardStatsCards", () => {
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

    const { container } = renderWithProviders(<DashboardStatsCards userId="user-1" />);
    // Each card has 3 skeleton elements (title, value, description), so 3 cards = 9 skeletons
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(9);
    // Verify we have 3 card containers
    const cardContainers = container.querySelectorAll(".bg-card-highlight-light.rounded-xl");
    expect(cardContainers.length).toBe(3);
  });

  it("renders all three stat cards when data is available", () => {
    renderWithProviders(<DashboardStatsCards userId="user-1" />);
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    expect(screen.getByText("Active Threads")).toBeInTheDocument();
    expect(screen.getByText("Avg Engagement")).toBeInTheDocument();
  });

  it("displays correct stat values", () => {
    renderWithProviders(<DashboardStatsCards userId="user-1" />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });
});

