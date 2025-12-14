/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import HamburgerMenu from "../HamburgerMenu";

describe("HamburgerMenu", () => {
  describe("Rendering", () => {
    it("renders button element", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      const button = screen.getByRole("button", { name: /toggle menu/i });
      expect(button).toBeInTheDocument();
    });

    it("displays 'Menu' text when closed", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      expect(screen.getByText("Menu")).toBeInTheDocument();
    });

    it("displays 'Close' text when open", () => {
      render(<HamburgerMenu isOpen={true} onClick={jest.fn()} />);
      expect(screen.getByText("Close")).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("calls onClick when clicked", () => {
      const handleClick = jest.fn();
      render(<HamburgerMenu isOpen={false} onClick={handleClick} />);
      const button = screen.getByRole("button");
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has aria-label attribute", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Toggle menu");
    });

    it("has aria-expanded attribute set to false when closed", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("has aria-expanded attribute set to true when open", () => {
      render(<HamburgerMenu isOpen={true} onClick={jest.fn()} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Animations and state", () => {
    it("applies correct classes when closed", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      const menuText = screen.getByText("Menu").closest("span");
      expect(menuText).toHaveClass("translate-y-0", "opacity-100");
      
      const closeText = screen.getByText("Close").closest("span");
      expect(closeText).toHaveClass("translate-y-full", "opacity-0");
    });

    it("applies correct classes when open", () => {
      render(<HamburgerMenu isOpen={true} onClick={jest.fn()} />);
      const menuText = screen.getByText("Menu").closest("span");
      expect(menuText).toHaveClass("-translate-y-full", "opacity-0");
      
      const closeText = screen.getByText("Close").closest("span");
      expect(closeText).toHaveClass("translate-y-0", "opacity-100");
    });

    it("rotates icon when open", () => {
      render(<HamburgerMenu isOpen={true} onClick={jest.fn()} />);
      const svg = screen.getByRole("button").querySelector("svg");
      expect(svg).toHaveClass("rotate-45");
    });

    it("does not rotate icon when closed", () => {
      render(<HamburgerMenu isOpen={false} onClick={jest.fn()} />);
      const svg = screen.getByRole("button").querySelector("svg");
      expect(svg).toHaveClass("rotate-0");
    });
  });
});
