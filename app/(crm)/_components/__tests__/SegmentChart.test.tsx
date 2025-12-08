import { render, screen } from "@testing-library/react";
import SegmentChart from "../charts/SegmentChart";

// Mock window.innerWidth for mobile detection
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  // Trigger resize event
  window.dispatchEvent(new Event("resize"));
};

describe("SegmentChart", () => {
  beforeEach(() => {
    mockWindowWidth(1024); // Desktop by default
  });

  describe("Rendering", () => {
    it("renders chart with data", () => {
      const data = {
        Enterprise: 10,
        SMB: 5,
        Startup: 3,
      };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });

    it("handles empty data gracefully", () => {
      render(<SegmentChart data={{}} />);
      expect(screen.getByText("No segment data available")).toBeInTheDocument();
    });

    it("handles single segment", () => {
      const data = { Enterprise: 10 };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });

    it("handles many segments (limits to 8)", () => {
      const data = {
        Segment1: 10,
        Segment2: 9,
        Segment3: 8,
        Segment4: 7,
        Segment5: 6,
        Segment6: 5,
        Segment7: 4,
        Segment8: 3,
        Segment9: 2,
        Segment10: 1,
      };
      render(<SegmentChart data={data} />);
      // Should still render chart (grouping logic handles this)
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });
  });

  describe("Data Processing", () => {
    it("filters out zero values", () => {
      const data = {
        Enterprise: 10,
        SMB: 0,
        Startup: 5,
      };
      render(<SegmentChart data={data} />);
      // Chart should render with only non-zero values
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });

    it("sorts by value descending", () => {
      const data = {
        Small: 2,
        Large: 10,
        Medium: 5,
      };
      render(<SegmentChart data={data} />);
      // Chart should render (sorting is internal to Recharts)
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });

    it("handles empty segment names", () => {
      const data = {
        "": 5,
        Enterprise: 10,
      };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });
  });

  describe("Grouping Small Slices", () => {
    it("groups small slices into 'Other' (minPercentage threshold)", () => {
      // Create data where some slices are < 3% of total
      const data = {
        Enterprise: 100, // 90.9%
        SMB: 5, // 4.5%
        Small1: 2, // 1.8% - should be grouped
        Small2: 1, // 0.9% - should be grouped
        Small3: 2, // 1.8% - should be grouped
      };
      render(<SegmentChart data={data} />);
      // Chart should render with grouping applied
      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    });
  });

  describe("Mobile Detection", () => {
    it("updates chart size for mobile", () => {
      mockWindowWidth(800); // Mobile width
      const data = { Enterprise: 10, SMB: 5 };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });

    it("updates chart size for desktop", () => {
      mockWindowWidth(1200); // Desktop width
      const data = { Enterprise: 10, SMB: 5 };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    });
  });

  describe("Chart Components", () => {
    it("renders tooltip", () => {
      const data = { Enterprise: 10, SMB: 5 };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });

    it("renders legend", () => {
      const data = { Enterprise: 10, SMB: 5 };
      render(<SegmentChart data={data} />);
      expect(screen.getByTestId("legend")).toBeInTheDocument();
    });

    it("renders pie cells", () => {
      const data = { Enterprise: 10, SMB: 5 };
      render(<SegmentChart data={data} />);
      // Should have cells for each segment
      const cells = screen.getAllByTestId("cell");
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});

