/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import BulkActionsBar from "../BulkActionsBar";

describe("BulkActionsBar", () => {
  const mockActions = [
    {
      label: "Action 1",
      onClick: jest.fn(),
      variant: "primary" as const,
    },
    {
      label: "Action 2",
      onClick: jest.fn(),
      variant: "outline" as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Conditional rendering", () => {
    it("does not render when selectedCount is 0", () => {
      const { container } = render(
        <BulkActionsBar
          selectedCount={0}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders when selectedCount is greater than 0", () => {
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      expect(screen.getByText(/5 contacts selected/i)).toBeInTheDocument();
    });
  });

  describe("Selection count display", () => {
    it("displays singular form when selectedCount is 1", () => {
      render(
        <BulkActionsBar
          selectedCount={1}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      expect(screen.getByText(/1 contact selected/i)).toBeInTheDocument();
    });

    it("displays plural form when selectedCount is greater than 1", () => {
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      expect(screen.getByText(/5 contacts selected/i)).toBeInTheDocument();
    });

    it("handles different item labels", () => {
      render(
        <BulkActionsBar
          selectedCount={3}
          itemLabel="action item"
          actions={mockActions}
        />
      );
      expect(screen.getByText(/3 action items selected/i)).toBeInTheDocument();
    });
  });

  describe("Action buttons", () => {
    it("renders all action buttons", () => {
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      // Button has label twice (desktop + mobile), so accessible name is "Action 1 Action 1"
      expect(screen.getByRole("button", { name: /Action 1/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Action 2/i })).toBeInTheDocument();
    });

    it("calls onClick when action button is clicked", () => {
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={mockActions}
        />
      );
      
      // Find button by text content since it appears twice (desktop/mobile)
      const buttons = screen.getAllByText("Action 1");
      const button1 = buttons[0].closest("button")!;
      fireEvent.click(button1);
      
      expect(mockActions[0].onClick).toHaveBeenCalledTimes(1);
    });

    it("disables button when disabled prop is true", () => {
      const actions = [
        {
          label: "Disabled Action",
          onClick: jest.fn(),
          disabled: true,
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // Find button by text content since label appears twice
      const buttonText = screen.getAllByText("Disabled Action")[0];
      const button = buttonText.closest("button")!;
      expect(button).toBeDisabled();
    });

    it("shows loading state when loading prop is true", () => {
      const actions = [
        {
          label: "Loading Action",
          onClick: jest.fn(),
          loading: true,
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // When loading, Button shows "Loading..." text instead
      const button = screen.getByRole("button", { name: "Loading..." });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Mobile labels", () => {
    it("uses labelMobile on mobile when provided", () => {
      const actions = [
        {
          label: "Full Action Name",
          labelMobile: "Short",
          onClick: jest.fn(),
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // Desktop shows full label
      expect(screen.getByText("Full Action Name")).toBeInTheDocument();
      // Mobile shows short label (hidden on desktop with sm:hidden)
      const mobileText = screen.getByText("Short");
      expect(mobileText).toBeInTheDocument();
      expect(mobileText).toHaveClass("sm:hidden");
    });

    it("uses label when labelMobile is not provided", () => {
      const actions = [
        {
          label: "Action Name",
          onClick: jest.fn(),
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // Should see the label twice (desktop and mobile versions)
      const labels = screen.getAllByText("Action Name");
      expect(labels.length).toBe(2); // One for desktop, one for mobile
    });
  });

  describe("Show count in button", () => {
    it("shows count in button when showCount is true", () => {
      const actions = [
        {
          label: "Action",
          onClick: jest.fn(),
          showCount: true,
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // The count appears in a span with ml-1 font-semibold classes inside the button
      const countSpan = document.querySelector(".ml-1.font-semibold");
      expect(countSpan).toBeInTheDocument();
      expect(countSpan?.textContent).toBe("(5)");
    });

    it("does not show count when showCount is false", () => {
      const actions = [
        {
          label: "Action",
          onClick: jest.fn(),
          showCount: false,
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      // Should not have the count span
      const countSpan = document.querySelector(".ml-1.font-semibold");
      expect(countSpan).not.toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("renders icon when provided", () => {
      const TestIcon = <svg data-testid="test-icon"><path /></svg>;
      const actions = [
        {
          label: "Action",
          onClick: jest.fn(),
          icon: TestIcon,
        },
      ];
      
      render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={actions}
        />
      );
      
      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <BulkActionsBar
          selectedCount={5}
          itemLabel="contact"
          actions={mockActions}
          className="custom-class"
        />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("custom-class");
    });
  });
});
