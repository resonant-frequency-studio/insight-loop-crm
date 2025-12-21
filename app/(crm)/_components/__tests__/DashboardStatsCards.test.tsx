import { screen } from "@testing-library/react";
import DashboardStatsCards from "../DashboardStatsCards";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { DashboardStats } from "../../../../hooks/useDashboardStats";
import { Contact } from "@/types/firestore";

// Mock useDashboardStatsRealtime hook
jest.mock("../../../../hooks/useDashboardStatsRealtime", () => ({
  useDashboardStatsRealtime: jest.fn(),
}));

import { useDashboardStatsRealtime } from "../../../../hooks/useDashboardStatsRealtime";

const mockUseDashboardStatsRealtime = useDashboardStatsRealtime as jest.MockedFunction<typeof useDashboardStatsRealtime>;

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

    const { container } = renderWithProviders(<DashboardStatsCards contacts={mockContacts} />);
    // Each card has 3 skeleton elements (title, value, description), so 3 cards = 9 skeletons
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(9);
    // Verify we have 3 card containers
    const cardContainers = container.querySelectorAll(".bg-card-highlight-light.rounded-xl");
    expect(cardContainers.length).toBe(3);
  });

  it("renders all three stat cards when data is available", () => {
    renderWithProviders(<DashboardStatsCards contacts={mockContacts} />);
    expect(screen.getByText("Total Contacts")).toBeInTheDocument();
    expect(screen.getByText("Active Threads")).toBeInTheDocument();
    expect(screen.getByText("Avg Engagement")).toBeInTheDocument();
  });

  it("displays correct stat values", () => {
    renderWithProviders(<DashboardStatsCards contacts={mockContacts} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });
});

