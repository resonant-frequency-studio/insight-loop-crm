import { render, screen } from "@testing-library/react";
import SavingIndicator from "../SavingIndicator";

describe("SavingIndicator", () => {
  describe("Status Rendering", () => {
    it("renders nothing when status is idle", () => {
      const { container } = render(<SavingIndicator status="idle" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders 'Saving...' with spinner when status is saving", () => {
      render(<SavingIndicator status="saving" />);
      expect(screen.getByText("Saving...")).toBeInTheDocument();
      const spinner = screen.getByText("Saving...").previousElementSibling;
      expect(spinner).toBeInTheDocument();
      expect(spinner?.tagName).toBe("svg");
      expect(spinner?.classList.contains("animate-spin")).toBe(true);
    });

    it("renders 'Saved' with checkmark when status is saved", () => {
      render(<SavingIndicator status="saved" />);
      expect(screen.getByText("Saved")).toBeInTheDocument();
      const checkmark = screen.getByText("Saved").previousElementSibling;
      expect(checkmark).toBeInTheDocument();
      expect(checkmark?.tagName).toBe("svg");
    });

    it("renders 'Error' with X icon when status is error", () => {
      render(<SavingIndicator status="error" />);
      expect(screen.getByText("Error")).toBeInTheDocument();
      const errorIcon = screen.getByText("Error").previousElementSibling;
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon?.tagName).toBe("svg");
    });
  });

  describe("Styling", () => {
    it("applies correct color classes for each status", () => {
      const { rerender } = render(<SavingIndicator status="saving" />);
      const savingContainer = screen.getByText("Saving...").parentElement;
      expect(savingContainer?.classList.contains("text-blue-600")).toBe(true);

      rerender(<SavingIndicator status="saved" />);
      const savedContainer = screen.getByText("Saved").parentElement;
      expect(savedContainer?.classList.contains("text-green-600")).toBe(true);

      rerender(<SavingIndicator status="error" />);
      const errorContainer = screen.getByText("Error").parentElement;
      expect(errorContainer?.classList.contains("text-red-600")).toBe(true);
    });
  });
});

