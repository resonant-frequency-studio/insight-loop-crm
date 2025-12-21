import { screen } from "@testing-library/react";
import ChartCard from "../ChartCard";
import { renderWithProviders } from "@/components/__tests__/test-utils";
import { DashboardStats } from "../../../../hooks/useDashboardStats";
import { Contact } from "@/types/firestore";

// Mock useDashboardStatsRealtime hook
jest.mock("../../../../hooks/useDashboardStatsRealtime", () => ({
  useDashboardStatsRealtime: jest.fn(),
}));

import { useDashboardStatsRealtime } from "../../../../hooks/useDashboardStatsRealtime";

const mockUseDashboardStatsRealtime = useDashboardStatsRealtime as jest.MockedFunction<typeof useDashboardStatsRealtime>;

describe("ChartCard", () => {
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

  describe("Rendering", () => {
    it("renders title", () => {
      renderWithProviders(
        <ChartCard contacts={mockContacts} title="Segment Distribution">
          {() => <div>Chart Content</div>}
        </ChartCard>
      );
      expect(screen.getByText("Segment Distribution")).toBeInTheDocument();
    });

    it("renders children (chart)", () => {
      renderWithProviders(
        <ChartCard contacts={mockContacts} title="Chart Title">
          {() => <div data-testid="chart-content">Chart Content</div>}
        </ChartCard>
      );
      expect(screen.getByTestId("chart-content")).toBeInTheDocument();
    });

    it("applies Card wrapper", () => {
      const { container } = renderWithProviders(
        <ChartCard contacts={mockContacts} title="Chart Title">
          {() => <div>Chart</div>}
        </ChartCard>
      );
      // Card should have base card styles
      const card = container.querySelector(".bg-card-light.rounded-sm");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton when data is not available", () => {
      mockUseDashboardStatsRealtime.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { container } = renderWithProviders(
        <ChartCard contacts={mockContacts} title="Chart Title">
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
        <ChartCard contacts={mockContacts} title="Chart Title">
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

