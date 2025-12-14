/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import Textarea from "../Textarea";

describe("Textarea", () => {
  describe("Rendering", () => {
    it("renders textarea element", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("renders with default value", () => {
      render(<Textarea defaultValue="test value" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("test value");
    });

    it("renders with placeholder", () => {
      render(<Textarea placeholder="Enter text" />);
      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toBeInTheDocument();
    });
  });

  describe("Props forwarding", () => {
    it("forwards all standard textarea props", () => {
      render(
        <Textarea
          name="description"
          id="description-input"
          required
          disabled
          readOnly
          rows={5}
          cols={50}
        />
      );
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea).toHaveAttribute("name", "description");
      expect(textarea).toHaveAttribute("id", "description-input");
      expect(textarea).toBeRequired();
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveAttribute("readOnly");
      expect(textarea).toHaveAttribute("rows", "5");
      expect(textarea).toHaveAttribute("cols", "50");
    });

    it("handles onChange events", () => {
      const handleChange = jest.fn();
      render(<Textarea onChange={handleChange} />);
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "new value" } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("applies base textarea styles", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("w-full", "px-4", "py-3", "border", "rounded-sm");
    });

    it("merges custom className correctly", () => {
      render(<Textarea className="custom-class" />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("custom-class");
      expect(textarea).toHaveClass("w-full"); // Base classes still present
    });

    it("applies focus styles", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("focus:ring-2", "focus:ring-blue-500", "focus:border-blue-500");
    });

    it("has resize-none class", () => {
      render(<Textarea />);
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("resize-none");
    });
  });

  describe("Accessibility", () => {
    it("can be accessed by label", () => {
      render(
        <div>
          <label htmlFor="test-textarea">Test Label</label>
          <Textarea id="test-textarea" />
        </div>
      );
      const textarea = screen.getByLabelText("Test Label");
      expect(textarea).toBeInTheDocument();
    });
  });
});
