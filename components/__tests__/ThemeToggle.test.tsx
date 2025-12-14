/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeToggle from "../ThemeToggle";

// Mock ThemeProvider
jest.mock("../ThemeProvider", () => ({
  useTheme: jest.fn(),
}));

import { useTheme } from "../ThemeProvider";

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

describe("ThemeToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders button element", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Light mode display", () => {
    it("shows 'Dark Mode' label when in light mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    it("shows sun icon when in light mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      const svg = button.querySelector("svg");
      // Check for circle element that's part of sun icon
      const circle = svg?.querySelector("circle");
      expect(circle).toBeInTheDocument();
    });
  });

  describe("Dark mode display", () => {
    it("shows 'Light Mode' label when in dark mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: jest.fn(),
        resolvedTheme: "dark",
      });

      render(<ThemeToggle />);
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    it("shows moon icon when in dark mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: jest.fn(),
        resolvedTheme: "dark",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      const svg = button.querySelector("svg");
      // Check for path element that's part of moon icon (no circle in moon icon)
      const path = svg?.querySelector("path");
      expect(path).toBeInTheDocument();
      // Moon icon should not have circle element
      const circle = svg?.querySelector("circle");
      expect(circle).not.toBeInTheDocument();
    });
  });

  describe("Theme cycling", () => {
    it("cycles from light to dark when clicked", () => {
      const mockSetTheme = jest.fn();
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("cycles from dark to light when clicked", () => {
      const mockSetTheme = jest.fn();
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
        resolvedTheme: "dark",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });
  });

  describe("Accessibility", () => {
    it("has aria-label attribute for light mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Switch to Dark Mode");
    });

    it("has aria-label attribute for dark mode", () => {
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: jest.fn(),
        resolvedTheme: "dark",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Switch to Light Mode");
    });

    it("has title attribute matching aria-label", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("title", "Switch to Dark Mode");
    });
  });

  describe("Styling", () => {
    it("applies correct button classes", () => {
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: jest.fn(),
        resolvedTheme: "light",
      });

      render(<ThemeToggle />);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("flex", "items-center", "justify-center", "w-full");
      expect(button).toHaveClass("bg-card-highlight-light", "hover:bg-theme-light");
    });
  });
});
