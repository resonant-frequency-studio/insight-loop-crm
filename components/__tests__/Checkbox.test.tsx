/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import Checkbox from "../Checkbox";

describe("Checkbox", () => {
  describe("Rendering", () => {
    it("renders checkbox input", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("renders with label when provided", () => {
      render(<Checkbox label="Check me" />);
      const checkbox = screen.getByLabelText("Check me");
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByText("Check me")).toBeInTheDocument();
    });

    it("renders without label when label prop is not provided", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      // No label text should be visible
      const label = checkbox.closest("label");
      expect(label?.textContent?.trim()).toBe("");
    });
  });

  describe("Checked state", () => {
    it("renders unchecked by default", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it("renders checked when checked prop is true", () => {
      render(<Checkbox checked onChange={jest.fn()} />);
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("handles onChange events", () => {
      const handleChange = jest.fn();
      render(<Checkbox onChange={handleChange} />);
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("Props forwarding", () => {
    it("forwards all standard checkbox props", () => {
      render(
        <Checkbox
          name="agree"
          id="agree-checkbox"
          disabled
          required
          value="yes"
        />
      );
      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox).toHaveAttribute("name", "agree");
      expect(checkbox).toHaveAttribute("id", "agree-checkbox");
      expect(checkbox).toBeDisabled();
      expect(checkbox).toBeRequired();
      expect(checkbox).toHaveAttribute("value", "yes");
    });
  });

  describe("Styling", () => {
    it("applies base checkbox styles", () => {
      render(<Checkbox />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("w-4", "h-4", "sm:w-5", "sm:h-5", "text-blue-600", "border-gray-300", "rounded");
    });

    it("merges custom className correctly", () => {
      render(<Checkbox className="custom-class" />);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveClass("custom-class");
    });

    it("merges custom labelClassName correctly", () => {
      render(<Checkbox label="Test" labelClassName="custom-label-class" />);
      const label = screen.getByText("Test").closest("label");
      expect(label).toHaveClass("custom-label-class");
    });

    it("label has correct base classes", () => {
      render(<Checkbox label="Test" />);
      const label = screen.getByText("Test").closest("label");
      expect(label).toHaveClass("flex", "items-start", "gap-2", "sm:gap-3", "cursor-pointer");
    });
  });

  describe("Accessibility", () => {
    it("label is associated with checkbox", () => {
      render(<Checkbox label="Accept terms" />);
      const checkbox = screen.getByLabelText("Accept terms");
      expect(checkbox).toBeInTheDocument();
    });

    it("label is clickable and toggles checkbox", () => {
      const handleChange = jest.fn();
      render(<Checkbox label="Click me" onChange={handleChange} />);
      const label = screen.getByText("Click me");
      fireEvent.click(label);
      expect(handleChange).toHaveBeenCalledTimes(1);
    });
  });
});
