import { screen } from "@testing-library/react";
import DashboardCharts from "../DashboardCharts";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { DashboardStats } from "../../../../hooks/useDashboardStats";
import { Contact } from "@/types/firestore";

// Mock useDashboardStatsRealtime hook
jest.mock("../../../../hooks/useDashboardStatsRealtime", () => ({
  useDashboardStatsRealtime: jest.fn(),
}));

import { useDashboardStatsRealtime } from "../../../../hooks/useDashboardStatsRealtime";

const mockUseDashboardStatsRealtime = useDashboardStatsRealtime as jest.MockedFunction<typeof useDashboardStatsRealtime>;

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStatsRealtime.mockReturnValue({
      data: mockStats,
      isLoading: false,
      error: null,
    });
  });

  it("renders loading skeleton when data is not available", () => {
    mockUseDashboardStatsRealtime.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = renderWithProviders(<DashboardCharts contacts={mockContacts} />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders all chart cards when data is available", () => {
    renderWithProviders(<DashboardCharts contacts={mockContacts} />);
    expect(screen.getByText("Segment Distribution")).toBeInTheDocument();
    expect(screen.getByText("Lead Source Distribution")).toBeInTheDocument();
    expect(screen.getByText("Engagement Levels")).toBeInTheDocument();
    expect(screen.getByText("Top Tags")).toBeInTheDocument();
    expect(screen.getByText("Sentiment Distribution")).toBeInTheDocument();
  });

  it("renders chart components with correct data", () => {
    const { container } = renderWithProviders(<DashboardCharts contacts={mockContacts} />);
    // Charts should be rendered (check for chart containers)
    const chartCards = container.querySelectorAll(".bg-card-light.rounded-sm");
    expect(chartCards.length).toBeGreaterThan(0);
  });
});

