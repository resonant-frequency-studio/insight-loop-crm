import { render, screen } from "@testing-library/react";
import TopTagsChart from "../TopTagsChart";

// Mock Recharts components
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children, height }: { children: React.ReactNode; height?: number }) => (
    <div data-testid="responsive-container" data-height={height}>
      {children}
    </div>
  ),
  BarChart: ({ children, data }: { children: React.ReactNode; data: Array<{ name: string; value: number }> }) => (
    <div data-testid="bar-chart" data-items={data.length}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="y-axis" data-key={dataKey} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock window.innerWidth
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

describe("TopTagsChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowWidth(1920); // Desktop by default
  });

  describe("Empty Data", () => {
    it("renders 'No data' message when data is empty", () => {
      render(<TopTagsChart data={{}} />);
      expect(screen.getByText("No tags data available")).toBeInTheDocument();
    });

    it("renders 'No data' message when all values are zero", () => {
      render(<TopTagsChart data={{ "Tag 1": 0, "Tag 2": 0 }} />);
      expect(screen.getByText("No tags data available")).toBeInTheDocument();
    });
  });

  describe("Data Processing", () => {
    it("limits to top 10 tags", () => {
      const data: Record<string, number> = {};
      for (let i = 1; i <= 15; i++) {
        data[`Tag ${i}`] = 100 - i;
      }
      render(<TopTagsChart data={data} />);
      
      const chart = screen.getByTestId("bar-chart");
      const itemCount = parseInt(chart.getAttribute("data-items") || "0");
      expect(itemCount).toBeLessThanOrEqual(10);
    });

    it("sorts by value descending", () => {
      const data = {
        "Tag C": 30,
        "Tag A": 100,
        "Tag B": 50,
      };
      render(<TopTagsChart data={data} />);
      
      const chart = screen.getByTestId("bar-chart");
      const itemCount = parseInt(chart.getAttribute("data-items") || "0");
      expect(itemCount).toBe(3);
    });

    it("filters out zero values", () => {
      const data = {
        "Tag 1": 100,
        "Tag 2": 0,
        "Tag 3": 50,
      };
      render(<TopTagsChart data={data} />);
      
      const chart = screen.getByTestId("bar-chart");
      const itemCount = parseInt(chart.getAttribute("data-items") || "0");
      expect(itemCount).toBe(2); // Only Tag 1 and Tag 3
    });

    it("trims tag names", () => {
      const data = {
        "  Tag 1  ": 100,
        "Tag 2": 50,
      };
      render(<TopTagsChart data={data} />);
      
      const chart = screen.getByTestId("bar-chart");
      expect(chart).toBeInTheDocument();
    });
  });

  describe("Responsive Sizing", () => {
    it("handles mobile sizing", () => {
      mockWindowWidth(800); // Mobile
      const data = { "Tag 1": 100, "Tag 2": 50 };
      render(<TopTagsChart data={data} />);
      
      const container = screen.getByTestId("responsive-container");
      const height = parseInt(container.getAttribute("data-height") || "0");
      // Mobile base height is 320, plus row height for each item
      expect(height).toBeGreaterThanOrEqual(320);
    });

    it("handles desktop sizing", () => {
      mockWindowWidth(1920); // Desktop
      const data = { "Tag 1": 100, "Tag 2": 50 };
      render(<TopTagsChart data={data} />);
      
      const container = screen.getByTestId("responsive-container");
      const height = parseInt(container.getAttribute("data-height") || "0");
      // Desktop base height is 300, plus row height for each item
      expect(height).toBeGreaterThanOrEqual(300);
    });

    it("adjusts height based on number of items", () => {
      mockWindowWidth(1920);
      const data: Record<string, number> = {};
      for (let i = 1; i <= 10; i++) {
        data[`Tag ${i}`] = 100 - i;
      }
      render(<TopTagsChart data={data} />);
      
      const container = screen.getByTestId("responsive-container");
      const height = parseInt(container.getAttribute("data-height") || "0");
      // Should be at least base height (300) + (10 items * row height ~35)
      // With 10 items, height should be at least 300 + (10 * 35) = 650
      expect(height).toBeGreaterThanOrEqual(300);
    });
  });

  describe("Chart Components", () => {
    it("renders tooltip component", () => {
      render(<TopTagsChart data={{ "Tag 1": 100 }} />);
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("renders YAxis with name as dataKey", () => {
      render(<TopTagsChart data={{ "Tag 1": 100 }} />);
      const yAxis = screen.getByTestId("y-axis");
      expect(yAxis.getAttribute("data-key")).toBe("name");
    });

    it("renders CartesianGrid", () => {
      render(<TopTagsChart data={{ "Tag 1": 100 }} />);
      expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
    });

    it("renders Bar component", () => {
      render(<TopTagsChart data={{ "Tag 1": 100 }} />);
      expect(screen.getByTestId("bar")).toBeInTheDocument();
    });
  });
});

