/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, ButtonVariant, ButtonSize } from "../Button";

describe("Button", () => {
  describe("Rendering", () => {
    it("renders with default props (primary variant, md size)", () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole("button", { name: /click me/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("bg-blue-600");
      expect(button).toHaveClass("px-4", "py-2.5", "text-base");
    });

    it("renders all variant styles correctly", () => {
      const variants: ButtonVariant[] = [
        "primary",
        "danger",
        "secondary",
        "outline",
        "link",
      ];

      variants.forEach((variant) => {
        const { unmount } = render(
          <Button variant={variant}>{variant}</Button>
        );
        const button = screen.getByRole("button", { name: variant });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it("renders all size variants correctly", () => {
      const sizes: ButtonSize[] = ["xs", "sm", "md", "lg"];

      sizes.forEach((size) => {
        const { unmount } = render(<Button size={size}>{size}</Button>);
        const button = screen.getByRole("button", { name: size });
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it("renders xs size with correct styling", () => {
      render(<Button size="xs">Extra Small</Button>);
      const button = screen.getByRole("button", { name: /extra small/i });
      expect(button).toHaveClass("px-2", "py-1", "text-sm");
    });
  });

  describe("Loading State", () => {
    it("shows spinner and disables button when loading", () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-disabled", "true");
      // Check for spinner (animate-spin class)
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("shows loading text when no icon provided", () => {
      render(<Button loading>Loading</Button>);
      const loadingText = screen.getByText("Loading...", { selector: ".sr-only" });
      expect(loadingText).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("displays error message when error prop is provided", () => {
      render(<Button error="Something went wrong">Submit</Button>);
      const errorMessage = screen.getByText("Something went wrong");
      expect(errorMessage).toBeInTheDocument();
    });

    it("does not display error message when error is null", () => {
      render(<Button error={null}>Submit</Button>);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    const TestIcon = () => (
      <svg data-testid="test-icon">
        <path d="M0 0h24v24H0z" />
      </svg>
    );

    it("renders icon in left position by default", () => {
      render(
        <Button icon={<TestIcon />} iconPosition="left">
          With Icon
        </Button>
      );
      const button = screen.getByRole("button");
      const icon = screen.getByTestId("test-icon");
      expect(icon).toBeInTheDocument();
      // Icon should be in the button
      expect(button.contains(icon)).toBe(true);
    });

    it("renders icon in right position", () => {
      render(
        <Button icon={<TestIcon />} iconPosition="right">
          With Icon
        </Button>
      );
      const icon = screen.getByTestId("test-icon");
      expect(icon).toBeInTheDocument();
    });

    it("replaces icon with spinner when loading", () => {
      render(
        <Button icon={<TestIcon />} loading>
          Loading
        </Button>
      );
      expect(screen.queryByTestId("test-icon")).not.toBeInTheDocument();
      const button = screen.getByRole("button");
      const spinner = button.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Full Width", () => {
    it("applies full width styling when fullWidth prop is true", () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole("button");
      expect(button.parentElement).toHaveClass("w-full");
    });

    it("applies full width when className includes w-full", () => {
      render(<Button className="w-full">Full Width</Button>);
      const button = screen.getByRole("button");
      expect(button.parentElement).toHaveClass("w-full");
    });
  });

  describe("Disabled State", () => {
    it("prevents clicks and shows correct styling when disabled", () => {
      const handleClick = jest.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("is disabled when loading", () => {
      const handleClick = jest.fn();
      render(
        <Button loading onClick={handleClick}>
          Loading
        </Button>
      );
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Interactions", () => {
    it("calls onClick handler on click", () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = jest.fn();
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Custom Styling", () => {
    it("merges custom className correctly", () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });

    it("preserves active scale effect by default", () => {
      render(<Button>Button</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("active:scale-95");
    });

    it("does not add active scale when className includes active:scale", () => {
      render(<Button className="active:scale-100">Button</Button>);
      const button = screen.getByRole("button");
      expect(button).not.toHaveClass("active:scale-95");
    });
  });

  describe("Type Attribute", () => {
    it("defaults to button type", () => {
      render(<Button>Button</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });

    it("can override type attribute", () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });
  });

  describe("Accessibility", () => {
    it("has aria-busy attribute when loading", () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("has aria-disabled attribute when disabled", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    it("has aria-disabled attribute when loading", () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });
  });
});

