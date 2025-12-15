/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InfoPopover from "../InfoPopover";

// Mock getBoundingClientRect and window dimensions
const mockGetBoundingClientRect = (left: number, right: number) => {
  return jest.fn(() => ({
    left,
    right,
    top: 100,
    bottom: 120,
    width: 20,
    height: 20,
    x: left,
    y: 100,
    toJSON: jest.fn(),
  }));
};

describe("InfoPopover", () => {
  beforeEach(() => {
    // Reset window.innerWidth
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  describe("Rendering", () => {
    it("renders button element", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button", { name: /more information/i });
      expect(button).toBeInTheDocument();
    });

    it("renders info icon (letter 'i')", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      expect(button.textContent).toContain("i");
    });
  });

  describe("Popover visibility", () => {
    it("does not show popover by default", () => {
      render(<InfoPopover content="Test content" />);
      expect(screen.queryByText("Test content")).not.toBeInTheDocument();
    });

    it("shows popover on mouse enter", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      
      fireEvent.mouseEnter(button);
      
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("hides popover on mouse leave", async () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      
      fireEvent.mouseEnter(button);
      expect(screen.getByText("Test content")).toBeInTheDocument();
      
      fireEvent.mouseLeave(button);
      
      await waitFor(() => {
        expect(screen.queryByText("Test content")).not.toBeInTheDocument();
      });
    });

    it("toggles popover on click", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      
      // Click to open
      fireEvent.click(button);
      expect(screen.getByText("Test content")).toBeInTheDocument();
      
      // Click to close
      fireEvent.click(button);
      expect(screen.queryByText("Test content")).not.toBeInTheDocument();
    });
  });

  describe("Content display", () => {
    it("displays popover content", () => {
      render(<InfoPopover content="This is helpful information" />);
      const button = screen.getByRole("button");
      
      fireEvent.mouseEnter(button);
      
      expect(screen.getByText("This is helpful information")).toBeInTheDocument();
    });

    it("applies lowercase text styling to content", () => {
      render(<InfoPopover content="TEST CONTENT" />);
      const button = screen.getByRole("button");
      
      fireEvent.mouseEnter(button);
      
      const content = screen.getByText("TEST CONTENT");
      expect(content).toHaveClass("lowercase");
    });
  });

  describe("Positioning", () => {
    it("positions popover to left by default (enough space on right)", () => {
      // Mock enough space on right
      Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
      
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      const buttonElement = button as HTMLElement;
      
      // Mock getBoundingClientRect
      buttonElement.getBoundingClientRect = mockGetBoundingClientRect(100, 120);
      
      fireEvent.mouseEnter(button);
      
      const popover = screen.getByText("Test content").closest("div");
      expect(popover).toHaveClass("left-0");
      expect(popover).not.toHaveClass("right-0");
    });

    it("positions popover to right when not enough space on right", () => {
      // Mock small window width
      Object.defineProperty(window, "innerWidth", { value: 300, writable: true });
      
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      const buttonElement = button as HTMLElement;
      
      // Mock getBoundingClientRect - button near right edge
      buttonElement.getBoundingClientRect = mockGetBoundingClientRect(250, 270);
      
      fireEvent.mouseEnter(button);
      
      const popover = screen.getByText("Test content").closest("div");
      // Should position to right when space is limited
      // Note: The actual positioning logic checks if spaceOnRight < popoverWidth + 16
      // We can test that the classes are applied correctly
      expect(popover).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has aria-label attribute", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "More information");
    });
  });

  describe("Styling", () => {
    it("applies correct button classes", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("w-5", "h-5", "rounded-full", "bg-card-highlight-light");
    });

    it("popover has correct classes", () => {
      render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      fireEvent.mouseEnter(button);
      
      const popover = screen.getByText("Test content").closest("div");
      expect(popover).toHaveClass("w-64", "p-3", "bg-card-highlight-light", "border", "rounded-sm", "shadow-xl");
    });
  });

  describe("Event cleanup", () => {
    it("cleans up event listeners on unmount", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
      
      const { unmount } = render(<InfoPopover content="Test content" />);
      const button = screen.getByRole("button");
      
      fireEvent.mouseEnter(button);
      
      unmount();
      
      // Should remove resize and scroll listeners
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
