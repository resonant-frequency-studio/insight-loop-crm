/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import Input from "../Input";

describe("Input", () => {
  describe("Rendering", () => {
    it("renders input element", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("renders with default value", () => {
      render(<Input defaultValue="test value" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("test value");
    });

    it("renders with placeholder", () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText("Enter text");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Props forwarding", () => {
    it("forwards all standard input props", () => {
      render(
        <Input
          type="email"
          name="email"
          id="email-input"
          required
          disabled
          readOnly
        />
      );
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input).toHaveAttribute("type", "email");
      expect(input).toHaveAttribute("name", "email");
      expect(input).toHaveAttribute("id", "email-input");
      expect(input).toBeRequired();
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute("readOnly");
    });

    it("handles onChange events", () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "new value" } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("applies base input styles", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("w-full", "px-4", "py-2", "border", "rounded-sm");
    });

    it("merges custom className correctly", () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("custom-class");
      expect(input).toHaveClass("w-full"); // Base classes still present
    });

    it("applies focus styles", () => {
      render(<Input />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("focus:ring-2", "focus:ring-blue-500", "focus:border-blue-500");
    });
  });

  describe("Accessibility", () => {
    it("can be accessed by label", () => {
      render(
        <div>
          <label htmlFor="test-input">Test Label</label>
          <Input id="test-input" />
        </div>
      );
      const input = screen.getByLabelText("Test Label");
      expect(input).toBeInTheDocument();
    });
  });
});
