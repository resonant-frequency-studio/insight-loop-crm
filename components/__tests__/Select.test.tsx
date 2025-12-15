/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Select from "../Select";

describe("Select", () => {
  describe("Rendering", () => {
    it("renders select button", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("displays selected option text", () => {
      render(
        <Select value="1" onChange={jest.fn()}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      // Text appears in button span and in hidden option
      const buttonText = screen.getByRole("button").querySelector("span");
      expect(buttonText?.textContent).toBe("Option 1");
    });

    it("displays 'Select...' when value is empty string", () => {
      render(
        <Select value="" onChange={jest.fn()}>
          <option value="">Select...</option>
          <option value="1">Option 1</option>
        </Select>
      );
      // Text appears in button span
      const buttonText = screen.getByRole("button").querySelector("span");
      expect(buttonText?.textContent).toBe("Select...");
    });

    it("renders hidden native select for form submission", () => {
      const { container } = render(
        <Select value="1" onChange={jest.fn()}>
          <option value="1">Option 1</option>
        </Select>
      );
      const hiddenSelect = container.querySelector('select.sr-only');
      expect(hiddenSelect).toBeInTheDocument();
      expect(hiddenSelect).toHaveAttribute("aria-hidden", "true");
      expect(hiddenSelect).toHaveAttribute("tabIndex", "-1");
    });
  });

  describe("Dropdown functionality", () => {
    it("opens dropdown when button is clicked", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      fireEvent.click(button);
      
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes dropdown when button is clicked again", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      
      // Open
      fireEvent.click(button);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      
      // Close
      fireEvent.click(button);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("shows all options when dropdown is open", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
          <option value="3">Option 3</option>
        </Select>
      );
      const button = screen.getByRole("button");
      fireEvent.click(button);
      
      expect(screen.getByRole("option", { name: "Option 1" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Option 2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Option 3" })).toBeInTheDocument();
    });
  });

  describe("Option selection", () => {
    it("calls onChange when option is selected", () => {
      const handleChange = jest.fn();
      render(
        <Select value="1" onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      
      const button = screen.getByRole("button");
      fireEvent.click(button);
      
      const option2 = screen.getByRole("option", { name: "Option 2" });
      fireEvent.click(option2);
      
      expect(handleChange).toHaveBeenCalledTimes(1);
      // The onChange receives a synthetic event - verify it has target and currentTarget properties
      const callArg = handleChange.mock.calls[0][0];
      expect(callArg.target).toBeDefined();
      expect(callArg.currentTarget).toBeDefined();
      // Verify the event target is a select element
      expect(callArg.target.tagName).toBe("SELECT");
    });

    it("closes dropdown after selecting option", () => {
      const handleChange = jest.fn();
      render(
        <Select value="1" onChange={handleChange}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      
      const button = screen.getByRole("button");
      fireEvent.click(button);
      
      const option2 = screen.getByRole("option", { name: "Option 2" });
      fireEvent.click(option2);
      
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("highlights selected option", () => {
      render(
        <Select value="2" onChange={jest.fn()}>
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      );
      
      const button = screen.getByRole("button");
      fireEvent.click(button);
      
      const selectedOption = screen.getByRole("option", { name: "Option 2" });
      expect(selectedOption).toHaveAttribute("aria-selected", "true");
      expect(selectedOption).toHaveClass("font-bold");
    });
  });

  describe("Click outside behavior", () => {
    it("closes dropdown when clicking outside", () => {
      render(
        <div>
          <Select>
            <option value="1">Option 1</option>
          </Select>
          <div data-testid="outside">Outside</div>
        </div>
      );
      
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      
      const outside = screen.getByTestId("outside");
      fireEvent.mouseDown(outside);
      
      waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });

    it("closes dropdown when clicking backdrop", () => {
      const { container } = render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      
      const backdrop = container.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        waitFor(() => {
          expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });
      }
    });
  });

  describe("Accessibility", () => {
    it("has aria-haspopup attribute", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-haspopup", "listbox");
    });

    it("updates aria-expanded when dropdown opens/closes", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      
      expect(button).toHaveAttribute("aria-expanded", "false");
      
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Icon rotation", () => {
    it("rotates icon when dropdown is open", () => {
      render(
        <Select>
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      const svg = button.querySelector("svg");
      
      expect(svg).not.toHaveClass("rotate-180");
      
      fireEvent.click(button);
      expect(svg).toHaveClass("rotate-180");
    });
  });

  describe("Custom className", () => {
    it("merges custom className correctly", () => {
      render(
        <Select className="custom-class">
          <option value="1">Option 1</option>
        </Select>
      );
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });
  });
});
