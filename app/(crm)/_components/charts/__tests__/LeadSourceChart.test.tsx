import { render, screen } from "@testing-library/react";
import LeadSourceChart from "../LeadSourceChart";

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
};

describe("LeadSourceChart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindowWidth(1920); // Desktop by default
  });

  describe("Empty Data", () => {
    it("renders 'No data' message when data is empty", () => {
      render(<LeadSourceChart data={{}} />);
      expect(screen.getByText("No lead source data available")).toBeInTheDocument();
    });

    it("renders 'No data' message when all values are zero", () => {
      render(<LeadSourceChart data={{ "Source 1": 0, "Source 2": 0 }} />);
      expect(screen.getByText("No lead source data available")).toBeInTheDocument();
    });
  });

  describe("Data Processing", () => {
    it("groups small slices into 'Other'", () => {
      const data = {
        "Source 1": 100,
        "Source 2": 50,
        "Source 3": 2, // Small slice (< 3%)
        "Source 4": 1, // Small slice (< 3%)
      };
      render(<LeadSourceChart data={data} />);
      
      const pie = screen.getByTestId("pie");
      const cells = screen.getAllByTestId(/pie-cell-/);
      
      // Should have main slices + "Other" (grouped small slices)
      expect(cells.length).toBeLessThanOrEqual(7); // Limited to top 7
      const otherCell = cells.find(cell => cell.getAttribute("data-name") === "Other");
      expect(otherCell).toBeInTheDocument();
    });

    it("limits to top 7 items", () => {
      const data = {
        "Source 1": 100,
        "Source 2": 90,
        "Source 3": 80,
        "Source 4": 70,
        "Source 5": 60,
        "Source 6": 50,
        "Source 7": 40,
        "Source 8": 30, // Should be excluded
        "Source 9": 20, // Should be excluded
      };
      render(<LeadSourceChart data={data} />);
      
      const cells = screen.getAllByTestId(/pie-cell-/);
      expect(cells.length).toBeLessThanOrEqual(7);
    });

    it("sorts data by value descending", () => {
      const data = {
        "Source C": 30,
        "Source A": 100,
        "Source B": 50,
      };
      render(<LeadSourceChart data={data} />);
      
      const cells = screen.getAllByTestId(/pie-cell-/);
      const values = cells.map(cell => parseInt(cell.getAttribute("data-value") || "0"));
      
      // Check that values are in descending order
      for (let i = 0; i < values.length - 1; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i + 1]);
      }
    });

    it("handles empty string names as 'Unknown'", () => {
      const data = {
        "": 50,
        "Source 1": 100,
      };
      render(<LeadSourceChart data={data} />);
      
      const cells = screen.getAllByTestId(/pie-cell-/);
      const unknownCell = cells.find(cell => cell.getAttribute("data-name") === "Unknown");
      expect(unknownCell).toBeInTheDocument();
    });
  });

  describe("Responsive Sizing", () => {
    it("handles mobile sizing", () => {
      mockWindowWidth(800); // Mobile
      render(<LeadSourceChart data={{ "Source 1": 100 }} />);
      
      const container = screen.getByTestId("responsive-container");
      expect(container.getAttribute("data-height")).toBe("380");
    });

    it("handles desktop sizing", () => {
      mockWindowWidth(1920); // Desktop
      render(<LeadSourceChart data={{ "Source 1": 100 }} />);
      
      const container = screen.getByTestId("responsive-container");
      expect(container.getAttribute("data-height")).toBe("450");
    });
  });

  describe("Tooltip and Legend", () => {
    it("renders tooltip component", () => {
      render(<LeadSourceChart data={{ "Source 1": 100 }} />);
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("renders legend with formatter", () => {
      render(<LeadSourceChart data={{ "Source 1": 100, "Source 2": 50 }} />);
      expect(screen.getByTestId("legend")).toBeInTheDocument();
      expect(screen.getByTestId("legend-formatter")).toBeInTheDocument();
    });
  });
});

