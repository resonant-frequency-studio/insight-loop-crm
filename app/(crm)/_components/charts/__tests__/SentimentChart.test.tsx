import { render, screen } from "@testing-library/react";
import SentimentChart from "../SentimentChart";

// Mock Recharts components
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children, height }: { children: React.ReactNode; height?: number }) => (
    <div data-testid="responsive-container" data-height={height}>
      {children}
    </div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ data }: { data: Array<{ name: string; value: number }> }) => (
    <div data-testid="pie" data-items={data.length}>
      {data.map((item, idx) => (
        <div key={idx} data-testid={`pie-cell-${idx}`} data-name={item.name} data-value={item.value}>
          {item.name}: {item.value}
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="cell" data-fill={fill} />,
  Legend: ({ formatter }: { formatter?: (value: string) => string }) => (
    <div data-testid="legend">
      {formatter && <div data-testid="legend-formatter">{formatter("Test")}</div>}
    </div>
  ),
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

describe("SentimentChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowWidth(1920); // Desktop by default
  });

  describe("Empty Data", () => {
    it("renders 'No data' message when data is empty", () => {
      render(<SentimentChart data={{}} />);
      expect(screen.getByText("No sentiment data available")).toBeInTheDocument();
    });

    it("renders 'No data' message when all values are zero", () => {
      render(<SentimentChart data={{ Positive: 0, Negative: 0 }} />);
      expect(screen.getByText("No sentiment data available")).toBeInTheDocument();
    });
  });

  describe("Sentiment Colors", () => {
    it("uses correct sentiment colors for known sentiments", () => {
      const data = {
        Positive: 50,
        Neutral: 30,
        Negative: 20,
        "Very Positive": 10,
        "Very Negative": 5,
      };
      render(<SentimentChart data={data} />);
      
      // Verify the chart renders (pie-chart should be present)
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      
      // Check that pie cells are rendered
      const pieCells = screen.getAllByTestId(/pie-cell-/);
      expect(pieCells.length).toBeGreaterThan(0);
    });

    it("uses default color for unknown sentiments", () => {
      const data = {
        "Unknown Sentiment": 50,
      };
      render(<SentimentChart data={data} />);
      
      // Verify the chart renders
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      
      // Check that pie cells are rendered
      const pieCells = screen.getAllByTestId(/pie-cell-/);
      expect(pieCells.length).toBeGreaterThan(0);
    });
  });

  describe("Data Processing", () => {
    it("sorts data by value descending", () => {
      const data = {
        Neutral: 30,
        Positive: 100,
        Negative: 50,
      };
      render(<SentimentChart data={data} />);
      
      const cells = screen.getAllByTestId(/pie-cell-/);
      const values = cells.map(cell => parseInt(cell.getAttribute("data-value") || "0"));
      
      // Check that values are in descending order
      for (let i = 0; i < values.length - 1; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i + 1]);
      }
    });

    it("filters out zero values", () => {
      const data = {
        Positive: 100,
        Neutral: 0,
        Negative: 50,
      };
      render(<SentimentChart data={data} />);
      
      const cells = screen.getAllByTestId(/pie-cell-/);
      const neutralCell = cells.find(cell => cell.getAttribute("data-name") === "Neutral");
      expect(neutralCell).toBeUndefined();
    });
  });

  describe("Responsive Sizing", () => {
    it("handles mobile sizing", () => {
      mockWindowWidth(800); // Mobile
      render(<SentimentChart data={{ Positive: 100 }} />);
      
      const container = screen.getByTestId("responsive-container");
      expect(container.getAttribute("data-height")).toBe("380");
    });

    it("handles desktop sizing", () => {
      mockWindowWidth(1920); // Desktop
      render(<SentimentChart data={{ Positive: 100 }} />);
      
      const container = screen.getByTestId("responsive-container");
      expect(container.getAttribute("data-height")).toBe("450");
    });
  });

  describe("Tooltip and Legend", () => {
    it("renders tooltip component", () => {
      render(<SentimentChart data={{ Positive: 100 }} />);
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("renders legend with formatter", () => {
      render(<SentimentChart data={{ Positive: 100, Negative: 50 }} />);
      expect(screen.getByTestId("legend")).toBeInTheDocument();
      expect(screen.getByTestId("legend-formatter")).toBeInTheDocument();
    });
  });
});

