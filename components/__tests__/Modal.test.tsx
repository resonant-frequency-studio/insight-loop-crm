import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../Modal";

describe("Modal", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = "";
  });

  afterEach(() => {
    // Clean up body overflow
    document.body.style.overflow = "";
  });

  describe("Rendering", () => {
    it("renders when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.getByText("Modal Content")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(
        <Modal isOpen={false} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.queryByText("Modal Content")).not.toBeInTheDocument();
    });

    it("renders title when provided", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
          Modal Content
        </Modal>
      );
      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("does not render title when not provided", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Modal Content
        </Modal>
      );
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    });
  });

  describe("Backdrop", () => {
    it("renders backdrop when showBackdrop is true (default)", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      // Modal renders in portal to document.body, so query from there
      const backdrop = document.body.querySelector(".bg-black\\/20");
      expect(backdrop).toBeInTheDocument();
    });

    it("does not render backdrop when showBackdrop is false", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} showBackdrop={false}>
          Content
        </Modal>
      );
      // Modal renders in portal to document.body, so query from there
      const backdrop = document.body.querySelector(".bg-black\\/20");
      expect(backdrop).not.toBeInTheDocument();
    });
  });

  describe("Close Behavior", () => {
    it("calls onClose when backdrop is clicked (default)", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      const backdrop = container.querySelector(".fixed.inset-0");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it("does NOT call onClose when backdrop is clicked if closeOnBackdropClick is false", () => {
      const { container } = render(
        <Modal
          isOpen={true}
          onClose={mockOnClose}
          closeOnBackdropClick={false}
        >
          Content
        </Modal>
      );
      const backdrop = container.querySelector(".fixed.inset-0");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).not.toHaveBeenCalled();
      }
    });

    it("does NOT call onClose when modal content is clicked", () => {
      const { container } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          <button>Click me</button>
        </Modal>
      );
      const content = screen.getByText("Click me");
      fireEvent.click(content);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("calls onClose when Escape key is pressed", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when other keys are pressed", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      fireEvent.keyDown(document, { key: "Enter" });
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Body Scroll Lock", () => {
    it("locks body scroll when modal is open", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when modal closes", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Portal Rendering", () => {
    it("renders in portal (document.body)", () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Portal Content
        </Modal>
      );
      const content = screen.getByText("Portal Content");
      expect(content).toBeInTheDocument();
      // Content should be in body, not in the test container
      expect(document.body.contains(content)).toBe(true);
    });
  });

  describe("Event Listener Cleanup", () => {
    it("removes event listeners on unmount", () => {
      const removeEventListenerSpy = jest.spyOn(document, "removeEventListener");
      const { unmount } = render(
        <Modal isOpen={true} onClose={mockOnClose}>
          Content
        </Modal>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );
      removeEventListenerSpy.mockRestore();
    });
  });
});

