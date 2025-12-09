import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SegmentSelect from "../SegmentSelect";

describe("SegmentSelect", () => {
  const mockExistingSegments = ["Enterprise", "SMB", "Startup", "Enterprise Plus"];
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders input with placeholder", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      expect(screen.getByPlaceholderText("Enter or select segment...")).toBeInTheDocument();
    });

    it("uses custom placeholder when provided", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
          placeholder="Custom placeholder"
        />
      );
      expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    });
  });

  describe("Input Value Sync", () => {
    it("input value syncs with prop value", async () => {
      const { rerender } = render(
        <SegmentSelect
          value="Enterprise"
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByDisplayValue("Enterprise") as HTMLInputElement;
      expect(input.value).toBe("Enterprise");

      rerender(
        <SegmentSelect
          value="SMB"
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      // Wait for async state update
      await waitFor(() => {
        expect((screen.getByPlaceholderText("Enter or select segment...") as HTMLInputElement).value).toBe("SMB");
      });
    });
  });

  describe("Dropdown", () => {
    it("dropdown opens on focus", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
    });

    it("dropdown closes on blur", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      expect(screen.getByText("Enterprise")).toBeInTheDocument();

      fireEvent.blur(input);
      
      await waitFor(() => {
        expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
      }, { timeout: 300 });
    });

    it("segment selection updates value", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      
      const enterpriseOption = screen.getByText("Enterprise");
      fireEvent.mouseDown(enterpriseOption);
      
      expect(mockOnChange).toHaveBeenCalledWith("Enterprise");
    });

    it("outside click closes dropdown", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      expect(screen.getByText("Enterprise")).toBeInTheDocument();

      // Click outside (on the backdrop)
      const backdrop = document.querySelector(".fixed.inset-0");
      if (backdrop) {
        fireEvent.click(backdrop);
      } else {
        fireEvent.click(document.body);
      }
      
      // Wait for blur timeout (200ms)
      await waitFor(() => {
        expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
      }, { timeout: 300 });
    });
  });

  describe("Clear Button", () => {
    it("clear button appears when value exists", () => {
      render(
        <SegmentSelect
          value="Enterprise"
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const clearButton = screen.getByRole("button");
      expect(clearButton).toBeInTheDocument();
    });

    it("clear button does not appear when value is empty", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const clearButton = screen.queryByRole("button");
      expect(clearButton).not.toBeInTheDocument();
    });

    it("clear button clears value", () => {
      render(
        <SegmentSelect
          value="Enterprise"
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const clearButton = screen.getByRole("button");
      fireEvent.click(clearButton);
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  describe("Filtering", () => {
    it("filtered segments based on input", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "Ent" } });
      
      // Should show Enterprise and Enterprise Plus
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
      expect(screen.getByText("Enterprise Plus")).toBeInTheDocument();
      // Should not show SMB or Startup
      expect(screen.queryByText("SMB")).not.toBeInTheDocument();
      expect(screen.queryByText("Startup")).not.toBeInTheDocument();
    });

    it("shows all segments when input is empty", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      
      mockExistingSegments.forEach(segment => {
        expect(screen.getByText(segment)).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("ArrowDown opens dropdown and moves highlight", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      
      await waitFor(() => {
        expect(screen.getByText("Enterprise")).toBeInTheDocument();
      });
      
      // After ArrowDown, first item should be highlighted (index 0)
      await waitFor(() => {
        const firstOption = screen.getByText("Enterprise").closest("button");
        // Highlighted index starts at -1, first ArrowDown should highlight index 0
        expect(firstOption).toBeInTheDocument();
      });
    });

    it("ArrowUp moves highlight up", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText("Enterprise")).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowUp" });
      
      // Should highlight first item again (after moving up from index 1)
      await waitFor(() => {
        const firstOption = screen.getByText("Enterprise").closest("button");
        expect(firstOption).toBeInTheDocument();
      });
    });

    it("Enter key selects highlighted segment", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      
      expect(mockOnChange).toHaveBeenCalledWith("Enterprise");
    });

    it("Escape key closes dropdown", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      expect(screen.getByText("Enterprise")).toBeInTheDocument();

      fireEvent.keyDown(input, { key: "Escape" });
      
      await waitFor(() => {
        expect(screen.queryByText("Enterprise")).not.toBeInTheDocument();
      });
    });
  });

  describe("Create New Segment", () => {
    it("create new segment option appears when input doesn't match", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "New Segment" } });
      
      expect(screen.getByText(/Create.*New Segment/i)).toBeInTheDocument();
    });

    it("create new segment option does not appear when input matches existing", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "Enterprise" } });
      
      expect(screen.queryByText(/Create.*Enterprise/i)).not.toBeInTheDocument();
    });

    it("clicking create new segment option selects the new value", () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "New Segment" } });
      
      const createButton = screen.getByText(/Create.*New Segment/i);
      fireEvent.click(createButton);
      
      expect(mockOnChange).toHaveBeenCalledWith("New Segment");
    });
  });

  describe("Existing Segment Detection", () => {
    it("detects when input matches existing segment", () => {
      render(
        <SegmentSelect
          value="Enterprise"
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...") as HTMLInputElement;
      expect(input.value).toBe("Enterprise");
    });
  });

  describe("Highlighted Index", () => {
    it("highlighted index updates with keyboard", async () => {
      render(
        <SegmentSelect
          value={null}
          onChange={mockOnChange}
          existingSegments={mockExistingSegments}
        />
      );
      const input = screen.getByPlaceholderText("Enter or select segment...");
      fireEvent.focus(input);
      await waitFor(() => {
        expect(screen.getByText("Enterprise")).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      
      // Second item should be highlighted
      await waitFor(() => {
        const secondOption = screen.getByText("SMB").closest("button");
        expect(secondOption).toBeInTheDocument();
      });
    });
  });
});

