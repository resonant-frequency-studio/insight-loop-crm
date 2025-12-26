/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import ProcessingDrawer from "../ProcessingDrawer";

describe("ProcessingDrawer", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("does not render when isOpen is false", () => {
      render(
        <ProcessingDrawer
          isOpen={false}
          onClose={mockOnClose}
          status="pending"
          title="Test"
        />
      );
      expect(screen.queryByText("Test")).not.toBeInTheDocument();
    });

    it("renders with title when open", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="pending"
          title="Processing"
        />
      );
      expect(screen.getByText("Processing")).toBeInTheDocument();
    });

    it("renders message when provided", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Processing"
          message="This is a test message"
        />
      );
      expect(screen.getByText("This is a test message")).toBeInTheDocument();
    });
  });

  describe("Status States", () => {
    it("renders pending state with blue background", () => {
      const { container } = render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="pending"
          title="Pending"
        />
      );
      const drawer = container.querySelector(".bg-blue-50");
      expect(drawer).toBeInTheDocument();
    });

    it("renders running state with spinner", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Running"
        />
      );
      // Check for spinner (animate-spin class)
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("renders complete state with checkmark", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Complete"
        />
      );
      const drawer = document.querySelector(".bg-green-50");
      expect(drawer).toBeInTheDocument();
      // Check for checkmark path
      const checkmark = document.querySelector('path[d="M5 13l4 4L19 7"]');
      expect(checkmark).toBeInTheDocument();
    });

    it("renders error state with X icon", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="error"
          title="Error"
          errorMessage="Something went wrong"
        />
      );
      const drawer = document.querySelector(".bg-red-50");
      expect(drawer).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("Progress Bar", () => {
    it("renders progress bar when progress is provided", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Processing"
          progress={{ current: 50, total: 100 }}
        />
      );
      const progressBar = document.querySelector(".rounded-full.h-2");
      expect(progressBar).toBeInTheDocument();
    });

    it("displays progress label when provided", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Processing"
          progress={{ current: 50, total: 100, label: "Processing items..." }}
        />
      );
      expect(screen.getByText("Processing items...")).toBeInTheDocument();
    });

    it("displays current/total count", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Processing"
          progress={{ current: 50, total: 100 }}
        />
      );
      expect(screen.getByText("50 / 100")).toBeInTheDocument();
    });
  });

  describe("Details", () => {
    it("renders custom details when provided", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Complete"
          details={<div data-testid="custom-details">Custom content</div>}
        />
      );
      expect(screen.getByTestId("custom-details")).toBeInTheDocument();
    });
  });

  describe("Dismiss Button", () => {
    it("shows dismiss button when canClose is true", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Complete"
          allowCloseWhileRunning={true}
        />
      );
      const closeButton = screen.getByLabelText("Close");
      expect(closeButton).toBeInTheDocument();
    });

    it("calls onClose when dismiss button is clicked", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Complete"
          allowCloseWhileRunning={true}
        />
      );
      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("hides dismiss button when running and allowCloseWhileRunning is false", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Running"
          allowCloseWhileRunning={false}
        />
      );
      const closeButton = screen.queryByLabelText("Close");
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe("Backdrop", () => {
    it("renders backdrop when showBackdrop is true", () => {
      const { container } = render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="pending"
          title="Test"
          showBackdrop={true}
        />
      );
      const backdrop = container.querySelector(".bg-black\\/20");
      expect(backdrop).toBeInTheDocument();
    });

    it("does not render backdrop when showBackdrop is false", () => {
      const { container } = render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="pending"
          title="Test"
          showBackdrop={false}
        />
      );
      const backdrop = container.querySelector(".bg-black\\/20");
      expect(backdrop).not.toBeInTheDocument();
    });

    it("calls onClose when backdrop is clicked", () => {
      const { container } = render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Test"
          showBackdrop={true}
          allowCloseWhileRunning={true}
        />
      );
      const backdrop = container.querySelector(".bg-black\\/20");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("Background Processing Note", () => {
    it("shows background processing note when running", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="running"
          title="Processing"
        />
      );
      expect(
        screen.getByText(/You can navigate away - processing will continue in the background/i)
      ).toBeInTheDocument();
    });

    it("does not show background processing note when complete", () => {
      render(
        <ProcessingDrawer
          isOpen={true}
          onClose={mockOnClose}
          status="complete"
          title="Complete"
        />
      );
      expect(
        screen.queryByText(/You can navigate away/i)
      ).not.toBeInTheDocument();
    });
  });
});

